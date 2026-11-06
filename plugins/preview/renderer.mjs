import { formatShaderLog } from "../../packages/shader-ir/diagnostics.mjs";
import { validatePreviewParameters } from "./parameters.mjs";
/** 单一离屏上下文，异步只用于准备资源，同步绘图期间不会交叉改写 GL 状态。 */
export function createWebGLRenderer({ compile, identity }) {
  const surface = document.createElement("canvas"),
    gl = surface.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
    });
  const programs = new Map(),
    textures = new Map(),
    resolved = new WeakMap(),
    decoders = new Set();
  let live = true,
    generation = 0,
    draws = 0,
    hits = 0,
    warmFrames = 0, pixelsDrawn = 0,
    pixelLimit = 0,
    misses = 0,
    queued = 0,
    quad = null,
    lost = false,
    queue = Promise.resolve();
  const limits = {
    programs: 128,
    programBytes: 16 * 1024 * 1024,
    textures: 24,
    textureBytes: 64 * 1024 * 1024,
    pending: 64,
  };
  const bytes = (items) =>
    [...items.values()].reduce((sum, v) => sum + v.bytes, 0);
  function trim() {
    for (const [items, count, budget, remove] of [
      [
        programs,
        limits.programs,
        limits.programBytes,
        (v) => gl.deleteProgram(v.program),
      ],
      [
        textures,
        limits.textures,
        limits.textureBytes,
        (v) => gl.deleteTexture(v.id),
      ],
    ]) {
      let size = bytes(items);
      for (const [key, value] of items) {
        if (items.size <= count && size <= budget) break;
        remove(value);
        items.delete(key);
        size -= value.bytes;
      }
    }
  }
  function contextLost(event) {
    event.preventDefault();
    lost = true;
    generation++;
    for (const cancel of decoders) cancel();
    quad = null;
    programs.clear();
    textures.clear();
  }
  function contextRestored() {
    if (!live) return;
    lost = false;
    pixelLimit = 0;
    quad = gl.createBuffer();
  }
  function dropWorkspace() {
    generation++;
    for (const cancel of decoders) cancel();
    if (gl && !lost) {
      gl.useProgram(null);
      for (const v of programs.values()) gl.deleteProgram(v.program);
      for (const v of textures.values()) gl.deleteTexture(v.id);
    }
    programs.clear();
    textures.clear();
    surface.width = surface.height = 1;
  }
  if (gl) {
    quad = gl.createBuffer();
    surface.addEventListener("webglcontextlost", contextLost);
    surface.addEventListener("webglcontextrestored", contextRestored);
  }
  const check = (epoch) => {
    if (!live || lost || epoch !== generation)
      throw Error("GPU 预览已停用、上下文丢失或请求过期");
  };
  function program(compiled) {
    const shaders = [];
    let p = null;
    try {
      const shader = (type, result, stage) => {
        if (!result?.ok) throw Error("编译后端未返回有效源码");
        const id = gl.createShader(type);
        shaders.push(id);
        gl.shaderSource(id, result.source);
        gl.compileShader(id);
        if (!gl.getShaderParameter(id, gl.COMPILE_STATUS))
          throw Error(
            formatShaderLog(gl.getShaderInfoLog(id), result.sourceMap, stage),
          );
        return id;
      };
      const v = shader(gl.VERTEX_SHADER, compiled.vertex, "vertex"),
        f = shader(gl.FRAGMENT_SHADER, compiled.fragment, "fragment");
      p = gl.createProgram();
      gl.attachShader(p, v);
      gl.attachShader(p, f);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(p) || "GLSL 链接失败");
      gl.detachShader(p, v);
      gl.detachShader(p, f);
      return p;
    } catch (e) {
      if (p) gl.deleteProgram(p);
      throw e;
    } finally {
      shaders.forEach((s) => gl.deleteShader(s));
    }
  }
  async function texture(nodeId, dataUrl, epoch) {
    const key = nodeId + ":" + dataUrl;
    if (textures.has(key)) {
      const value = textures.get(key);
      textures.delete(key);
      textures.set(key, value);
      return value;
    }
    let image = null;
    if (dataUrl) {
      if (!/^data:image\//.test(dataUrl))
        throw Error("纹理预览只读取工作流内的图像");
      image = await new Promise((resolve, reject) => {
        const img = new Image();
        function finish() {
          img.onload = img.onerror = null;
          decoders.delete(cancel);
        }
        function cancel() {
          finish();
          img.removeAttribute("src");
          reject(Error("预览纹理请求已过期"));
        }
        decoders.add(cancel);
        img.onload = () => { finish(); resolve(img); };
        img.onerror = () => { finish(); reject(Error("纹理预览图无法解码")); };
        img.src = dataUrl;
      });
      check(epoch);
    }
    if (textures.has(key)) return textures.get(key);
    const id = gl.createTexture();
    try {
      gl.bindTexture(gl.TEXTURE_2D, id);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (image) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image,
          );
        } finally {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        }
      } else
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([255, 255, 255, 255]),
        );
    } catch (error) {
      gl.deleteTexture(id);
      throw error;
    }
    const entry = {
      id,
      width: image?.naturalWidth || 1,
      height: image?.naturalHeight || 1,
      bytes:
        2 * key.length +
        (image?.naturalWidth || 1) * (image?.naturalHeight || 1) * 4,
    };
    textures.set(key, entry);
    return entry;
  }
  function upload(p, input, value = input.defaultValue) {
    const location = gl.getUniformLocation(p, input.name);
    if (location === null) return;
    const type = input.type,
      numeric = () =>
        Array.isArray(value)
          ? value.map(Number)
          : String(value)
              .split(/[\s,]+/)
              .filter(Boolean)
              .map(Number);
    if (type === "BOOL")
      gl.uniform1i(
        location,
        value === true || String(value) === "true" ? 1 : 0,
      );
    else if (type === "INT") gl.uniform1i(location, Number(value));
    else if (type === "UINT") gl.uniform1ui(location, Number(value));
    else if (/^[IU]?VEC[234]$/.test(type)) {
      const size = Number(type.at(-1)),
        v = numeric();
      gl[
        "uniform" +
          size +
          (type.startsWith("I") ? "iv" : type.startsWith("U") ? "uiv" : "fv")
      ](
        location,
        Array.from({ length: size }, (_, i) => v[i] ?? v[0] ?? 0),
      );
    } else if (/^BVEC[234]$/.test(type)) {
      const values = Array.isArray(value)
        ? value
        : String(value).split(/[\s,]+/);
      gl["uniform" + type.at(-1) + "iv"](
        location,
        values.map((v) => (v === true || String(v) === "true" ? 1 : 0)),
      );
    } else if (/^MAT[234]$/.test(type))
      gl["uniformMatrix" + type.at(-1) + "fv"](location, false, numeric());
    else gl.uniform1f(location, Number(value));
  }
  async function render(request, epoch, { isWanted, clip }) {
    if (!gl) throw Error("当前浏览器不支持 WebGL2");
    function checkRequest() {
      check(epoch);
      if (isWanted && !isWanted()) throw Error("预览请求已过期");
    }
    checkRequest();
    const {
      document: doc,
      stage = "fragment",
      nodeId,
      socket,
      width = 1024,
      height = 1024,
      time = 0,
    } = request;
    const limit = pixelLimit ||= Math.min(
      4096,
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      ...gl.getParameter(gl.MAX_VIEWPORT_DIMS),
    );
    if (
      ![width, height].every(
        (n) => Number.isInteger(n) && n > 0 && n <= limit,
      ) ||
      !Number.isFinite(time)
    )
      throw Error("预览像素尺寸或时间无效，当前最大 " + limit);
    // 身份包含当前实际节点提供者和编译会话，不受无关插件的登记影响。
    const input = {
      document: doc,
      stage,
      ...(nodeId ? { nodeId, socket } : {}),
    };
    // 协调器为同一修订复用不可变文档。动态编译提供者变动会使目录修订失效。
    // 单独调用渲染器、可变输入、程序被淘汰或上下文丢失时，仍走完整身份校验。
    const stable = request.catalogRevision !== undefined;
    let memo = stable ? resolved.get(doc) : null;
    if (stable && (!memo || memo.revision !== request.catalogRevision)) {
      memo = { revision: request.catalogRevision, keys: new Map() };
      resolved.set(doc, memo);
    }
    const target = JSON.stringify([stage, nodeId, socket]);
    const known = memo?.keys.get(target);
    const warm = !!known && programs.get(known.key)?.serial === known.serial;
    const key = warm ? known.key : (await identity(input)).key;
    checkRequest();
    let entry = programs.get(key);
    if (entry) {
      hits++;
      programs.delete(key);
      programs.set(key, entry);
    }
    if (!entry) {
      misses++;
      const compiled = await compile(input);
      checkRequest();
      entry = programs.get(key);
      if (!entry) {
        entry = {
          serial: misses,
          program: program(compiled),
          compiled,
          bytes: 2 * (key.length + JSON.stringify(compiled).length),
        };
        programs.set(key, entry);
      }
    }
    const metadata = entry.compiled;
    if (!entry.prepared) {
      validatePreviewParameters(
        metadata.inputs || [],
        metadata.textures || [],
        (n) => "u_textureAspect_" + n,
      );
      metadata.inputs = (metadata.inputs || []).filter(
        (p, i, all) => all.findIndex((v) => v.name === p.name) === i,
      );
      metadata.textures = (metadata.textures || []).filter(
        (p, i, all) => all.findIndex((v) => v.name === p.name) === i,
      );
      entry.position = gl.getAttribLocation(entry.program, "position");
      entry.time = gl.getUniformLocation(entry.program, "u_time");
      entry.prepared = true;
    }
    const imageData = (t) =>
      (t.stage === "vertex" ? doc.geometry.graph : doc.fragment).nodes.find(
        (n) => n.id === t.nodeId && n.typeId === "input.texture",
      )?.properties.previewDataUrl || "";
    const loaded = await Promise.allSettled(
      (metadata.textures || []).map((t) =>
        texture(t.stage + ":" + t.nodeId, imageData(t), epoch),
      ),
    );
    const failure = loaded.find((item) => item.status === "rejected");
    if (failure) throw failure.reason;
    const images = loaded.map((item) => item.value);
    checkRequest();
    if (!warm && (await identity(input)).key !== key)
      throw Error("节点提供者已变化，预览程序已过期");
    checkRequest();
    if (!warm && memo) memo.keys.set(target, {key, serial: entry.serial});
    if (warm) warmFrames++;
    const p = entry.program;
    if (surface.width !== width) surface.width = width;
    if (surface.height !== height) surface.height = height;
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    // 使用完整画布计算坐标，只清除和绘制当前可见的像素，MCP 单帧继续绘制整图。
    let region;
    if (clip) {
      const x = Math.floor(clip.left * width), y = Math.floor(clip.top * height);
      const w = Math.ceil(clip.right * width) - x, h = Math.ceil(clip.bottom * height) - y;
      region = { x, y, w, h };
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x, height - y - h, w, h);
    } else gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const vertices = nodeId
      ? [-1, -1, 1, -1, -1, 1, 1, 1]
      : doc.geometry.vertices.flat();
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const location = entry.position;
    if (location >= 0) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    }
    const timeUniform = entry.time;
    gl.uniform1f(timeUniform, time);
    (metadata.textures || []).forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, images[i].id);
      gl.uniform1i(gl.getUniformLocation(p, t.name), i);
      gl.uniform2f(
        gl.getUniformLocation(p, "u_textureAspect_" + t.name),
        images[i].width,
        images[i].height,
      );
    });
    const inputs = metadata.inputs || [];
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (nodeId) {
      inputs.forEach((input) => upload(p, input));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      const {
        count = 8,
        selected = 1,
        overrides = {},
      } = request.geometry || {};
      if (
        !Number.isInteger(count) ||
        count < 1 ||
        count > 64 ||
        !Number.isInteger(selected) ||
        selected < 1 ||
        selected > count
      )
        throw Error("预览实例范围无效");
      const cols = Math.ceil(Math.sqrt((count * width) / height)),
        rows = Math.ceil(count / cols),
        w = Math.floor(width / cols),
        h = Math.floor(height / rows),
        extent = Math.max(220, ...doc.geometry.vertices.flat().map(Math.abs));
      if (w < 1 || h < 1) throw Error("几何预览尺寸不足以显示当前实例数");
      gl.uniform2f(
        gl.getUniformLocation(p, "wf_preview_extent"),
        extent * Math.max(1, w / h),
        extent * Math.max(1, h / w),
      );
      for (let i = 0; i < count; i++) {
        inputs.forEach((input) =>
          upload(
            p,
            input,
            (input.scope === "shared" || i === selected - 1) &&
              Object.hasOwn(overrides, input.name)
              ? overrides[input.name]
              : input.defaultValue,
          ),
        );
        gl.viewport((i % cols) * w, Math.floor(i / cols) * h, w, h);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    draws++;
    pixelsDrawn += region ? region.w * region.h : width * height;
    return { surface, width, height, region, usesTime: timeUniform !== null };
  }
  // 资源准备、绘图及复制同属一个队列项，调用者必须在 receive 中同步取图，避免共享画布被下一帧覆盖。
  return {
    resetWorkspace: dropWorkspace,
    releaseFrame() {
      surface.width = surface.height = 1;
    },
    render(request, receive, options = {}) {
      if (!live || queued >= limits.pending)
        return Promise.reject(Error("GPU 预览已停用或请求过多，请稍后重试"));
      const epoch = generation;
      queued++;
      const pending = queue.then(async () => {
        try {
          return receive(await render(request, epoch, options));
        } finally {
          queued--;
          if (gl && live && !lost) trim();
        }
      });
      // 队尾只保存执行顺序，避免最后一张 PNG 被 Promise 持有到下一次请求。
      queue = pending.then(() => undefined, () => undefined);
      return pending;
    },
    status: () => ({
      available: !!gl && live && !lost,
      textureDecoders: decoders.size,
      scratchPixels: surface.width * surface.height,
      programs: programs.size,
      textures: textures.size,
      draws,
      hits,
      misses,
      warmFrames,
      pixelsDrawn,
      pending: queued,
      programBytes: bytes(programs),
      textureBytes: bytes(textures),
      limits: { ...limits },
    }),
    dispose() {
      if (!live) return;
      live = false;
      surface.removeEventListener?.("webglcontextlost", contextLost);
      surface.removeEventListener?.("webglcontextrestored", contextRestored);
      dropWorkspace();
      if (gl && !lost) {
        gl.deleteBuffer(quad);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      quad = null;
    },
  };
}

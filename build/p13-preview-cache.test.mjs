// 开发者资源边界模拟，真实 GPU 像素由公开 MCP 验证。
import test from "node:test";
import assert from "node:assert/strict";
import { createWebGLRenderer } from "../plugins/preview/renderer.mjs";
function fixture(options = {}) {
  const deleted = [],
    compiled = [],
    methods = {
      getParameter: (key) =>
        key === "MAX_VIEWPORT_DIMS" ? [4096, 4096] : 4096,
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      createBuffer: () => ({}),
      createShader: () => ({}),
      createProgram: () => ({}),
      createTexture: () => ({}),
      deleteProgram: (p) => deleted.push(p),
      deleteTexture: (t) => deleted.push(t),
      getUniformLocation: () => null,
      getAttribLocation: () => -1,
      ...options.gl,
    };
  const gl = new Proxy(methods, {
    get: (o, k) =>
      k in o
        ? o[k]
        : typeof k === "string" && k.toUpperCase() === k
          ? k
          : () => {},
  });
  const oldDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({ getContext: () => gl, addEventListener() {} }),
  };
  const renderer = createWebGLRenderer({
    identity: options.identity || (async (r) => ({ key: r.document.config.id })),
    compile: async (r) => {
      compiled.push(r);
      return options.compile
        ? options.compile(r)
        : {
            vertex: { ok: true, source: "void main(){}" },
            fragment: { ok: true, source: "void main(){}" },
            inputs: [],
            textures: [],
          };
    },
  });
  const request = (id) => ({
    document: {
      config: { id },
      fragment: { nodes: [] },
      geometry: {
        vertices: [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ],
      },
    },
    nodeId: "color",
    stage: "fragment",
    width: 64,
    height: 64,
  });
  return {
    renderer,
    compiled,
    deleted,
    request,
    async draw(id) {
      return renderer.render(request(id), () => true);
    },
    dispose() {
      renderer.dispose();
      globalThis.document = oldDocument;
    },
  };
}
test("GPU 程序按 LRU 条目上限回收，被淘汰的请求重新编译，每次命中仍绘制", async () => {
  const f = fixture();
  try {
    await f.draw("first");
    await f.draw("first");
    assert.equal(f.compiled.length, 1);
    assert.equal(f.renderer.status().draws, 2);
    for (let i = 0; i < 129; i++) await f.draw("key" + i);
    assert.equal(f.renderer.status().programs, 128);
    assert.ok(f.deleted.length >= 2);
    const before = f.compiled.length;
    await f.draw("first");
    assert.equal(f.compiled.length, before + 1);
    assert.ok(
      f.renderer.status().programBytes <=
        f.renderer.status().limits.programBytes,
    );
  } finally {
    f.dispose();
  }
});
test("GPU 程序超大源码不保留，失败绘制同样裁剪缓存", async () => {
  const f = fixture({
    compile: () => ({
      vertex: { ok: true, source: "x".repeat(9 * 1024 * 1024) },
      fragment: { ok: true, source: "" },
      inputs: [],
      textures: [],
    }),
  });
  try {
    await f.draw("huge");
    assert.equal(f.renderer.status().programs, 0);
    assert.equal(f.deleted.length, 1);
    const r = f.request("failed");
    delete r.nodeId;
    r.geometry = { count: 0 };
    await assert.rejects(
      f.renderer.render(r, () => true),
      /实例范围/,
    );
    assert.equal(f.renderer.status().programs, 0);
    assert.equal(f.deleted.length, 2);
  } finally {
    f.dispose();
  }
});
test("GPU 在途请求有上限，停用拒绝全部排队结果并归零", async () => {
  let release, entered;
  const start = new Promise((r) => (entered = r)),
    gate = new Promise((r) => (release = r));
  const f = fixture({
    compile: async () => {
      entered();
      await gate;
      return {
        vertex: { ok: true, source: "" },
        fragment: { ok: true, source: "" },
        inputs: [],
        textures: [],
      };
    },
  });
  try {
    const calls = Array.from({ length: 64 }, (_, i) => f.draw(String(i)));
    const settled = Promise.allSettled(calls);
    await start;
    await assert.rejects(f.draw("extra"), /请求过多/);
    f.renderer.dispose();
    release();
    assert.ok((await settled).every((r) => r.status === "rejected"));
    assert.equal(f.renderer.status().pending, 0);
    assert.equal(f.renderer.status().programs, 0);
  } finally {
    f.dispose();
  }
});

test("同一节点的动画复用身份解析，目录修订或文档改变后重新校验", async () => {
  let checks = 0;
  const f = fixture({identity: async r => (checks++, {key:r.document.config.id})});
  try {
    const req = {...f.request("one"),catalogRevision:1};
    await f.renderer.render(req, () => {});
    const first = checks;
    assert.ok(first >= 2);
    for (const time of [0.1,0.2,0.3]) await f.renderer.render({...req,time}, () => {});
    assert.equal(checks,first);
    assert.equal(f.renderer.status().warmFrames,3);
    assert.equal(f.renderer.status().pixelsDrawn,4*64*64);
    await f.renderer.render({...req,catalogRevision:2}, () => {});
    assert.ok(checks > first);
    await f.renderer.render({...req,document:f.request("two").document}, () => {});
    assert.equal(f.compiled.length,2);
  } finally { f.dispose(); }
});

test("高清视口只着色相交像素，切换工作流释放程序并拒绝旧队列", async () => {
  const scissors=[];
  const f=fixture({gl:{scissor:(...args)=>scissors.push(args)}});
  try {
    const request=f.request("crop");
    const clip={left:0.25,top:0.125,right:0.75,bottom:0.5};
    const region=await f.renderer.render(request,frame=>frame.region,{clip});
    assert.deepEqual(region,{x:16,y:8,w:32,h:24});
    assert.deepEqual(scissors,[[16,32,32,24]]);
    assert.equal(f.renderer.status().pixelsDrawn,32*24);
    const stale=f.renderer.render(request,()=>true);
    f.renderer.resetWorkspace();
    await assert.rejects(stale,/过期/);
    assert.equal(f.renderer.status().programs,0);
    assert.equal(f.renderer.status().scratchPixels,1);
    assert.equal(f.renderer.status().pending,0);
    assert.equal(f.deleted.length,1);
    await f.draw("new");
    assert.equal(f.renderer.status().pixelsDrawn,32*24+64*64);
  } finally {f.dispose();}
});

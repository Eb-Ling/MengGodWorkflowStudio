const { BrowserWindow, session, ipcMain } = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { randomUUID } = require("node:crypto");
const moduleRoot = path.dirname(require.resolve("./electron-runner.cjs"));
const { guardProcess } = require('./resource-guard.cjs');

/** 独立 Electron 沙箱渲染进程。内核激活时创建，内核清理时销毁。 */
async function createExtensionRunner(
  bundle,
  {
    timeoutMs = 4000,
    onFault = () => {},
    onApiCall = () => Promise.reject(Error("宿主未连接远程 API")),
    availableApis = Object.keys(bundle.manifest.requiredApis),
  } = {},
) {
  const origin = "https://workflow-plugin.local",
    partition = "workflow-extension-" + randomUUID(),
    ses = session.fromPartition(partition);
  const allowed = new Map();
  const {
    EXTENSION_PROTOCOL,
    extensionJson,
    readExtensionMessage,
    validateRemoteCall,
  } = await import("../plugin-sdk/extension-protocol.mjs");
  const apiChannel = "extension:api:" + partition;
  for (const file of [
    "ir.mjs",
    "schema.mjs",
    "schema-definition.mjs",
    "errors.mjs",
    "plugin-activation.mjs",
    "ports.mjs",
    "extension-protocol.mjs",
    "drawing.mjs",
    "extension-platform.mjs",
  ])
    allowed.set(
      "/packages/plugin-sdk/" + file,
      await fs.readFile(path.join(moduleRoot, "../plugin-sdk", file), "utf8"),
    );
  allowed.set(
    "/packages/extension-host/runner.mjs",
    await fs.readFile(path.join(moduleRoot, "runner.mjs"), "utf8"),
  );
  allowed.set(
    "/packages/extension-host/runtime.mjs",
    await fs.readFile(path.join(moduleRoot, "runtime.mjs"), "utf8"),
  );
  // 隔离进程只加载上下文适配器，不开放插件管理入口或内核模块。
  allowed.set(
    "/packages/plugin-runtime/context.mjs",
    await fs.readFile(path.join(moduleRoot, "../plugin-runtime/context.mjs"), "utf8"),
  );
  for (const [name, source] of Object.entries(bundle.files))
    allowed.set("/plugin/" + name, source);
  const nativeWindow = bundle.manifest.isolation?.window;
  const policy =
    "default-src 'none'; script-src 'self'; connect-src 'none'; img-src data:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
  const html =
    '<!doctype html><html><head><script type="importmap">' +
    JSON.stringify({
      imports: {
        "@workflow/plugin-sdk/ir": origin + "/packages/plugin-sdk/ir.mjs",
        "@workflow/plugin-sdk/schema":
          origin + "/packages/plugin-sdk/schema.mjs",
        "@workflow/plugin-sdk/ports": origin + "/packages/plugin-sdk/ports.mjs",
        "@workflow/plugin-sdk/drawing": origin + "/packages/plugin-sdk/drawing.mjs",
      },
    }) +
    '</script></head><body><script type="module" src="/packages/extension-host/runner.mjs"></script></body></html>';
  // importmap 是固定宿主数据，仅对它加入 CSP 哈希，不允许插件内联脚本或 eval。
  const { createHash } = require("node:crypto"),
    mapText = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1],
    hash = createHash("sha256").update(mapText).digest("base64");
  const csp = policy.replace(
    "script-src 'self'",
    "script-src 'self' 'sha256-" + hash + "'",
  );
  await ses.protocol.handle("https", (request) => {
    const url = new URL(request.url);
    if (url.origin !== origin)
      return new Response("Forbidden", { status: 403 });
    const key = decodeURIComponent(url.pathname),
      source = key === "/index.html" ? html : allowed.get(key);
    if (source === undefined)
      return new Response("Plugin file not found", { status: 404 });
    return new Response(source, {
      headers: {
        "Content-Type":
          key === "/index.html"
            ? "text/html; charset=utf-8"
            : key.endsWith('.css') ? 'text/css; charset=utf-8' : key.endsWith(".json")
              ? "application/json"
              : "text/javascript; charset=utf-8",
        "Content-Security-Policy": csp,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
  ses.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !details.url.startsWith(origin + "/") }),
  );
  ses.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );
  ses.setPermissionCheckHandler(() => false);
  const denyDownload = (event) => event.preventDefault();
  ses.on("will-download", denyDownload);
  const window = new BrowserWindow({
    show: false,
    width: nativeWindow?.width || 1,
    height: nativeWindow?.height || 1,
    minWidth: nativeWindow ? 320 : 1,
    minHeight: nativeWindow ? 240 : 1,
    maxWidth: 1600, maxHeight: 1200,
    title: bundle.manifest.name + ' · 隔离插件',
    autoHideMenuBar: true,
    webPreferences: {
      partition,
      preload: path.join(moduleRoot, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
      webgl: !!nativeWindow,
      devTools: false,
      additionalArguments: ["--workflow-extension-channel=" + apiChannel],
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('close', event => { if (!closed) { event.preventDefault(); window.hide(); } });
  window.removeMenu();
  const pending = new Map();
  let serial = 0,
    closed = false,
    readyResolve,
    readyReject,
    heartbeat = null,
    apiPending = 0,
    rateStart = 0,
    rateCount = 0,
    guard = null;
  ipcMain.handle(apiChannel, async (event, input) => {
    if (
      closed ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw Error("远程 API 来源无效");
    if (input?.protocol !== EXTENSION_PROTOCOL)
      throw Error("扩展协议版本不兼容");
    if (apiPending >= 64) throw Error("远程 API 队列已满");
    const now = Date.now();
    if (now - rateStart >= 1000) {
      rateStart = now;
      rateCount = 0;
    }
    if (++rateCount > 120) throw Error("远程 API 每秒最多 120 次");
    const request = validateRemoteCall(bundle.manifest, input);
    apiPending++;
    try {
      const result = await onApiCall(request);
      if (closed) throw Error("插件已停用");
      return extensionJson(result);
    } finally {
      apiPending--;
    }
  });
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  ready.catch(() => {});
  const readyTimer = setTimeout(() => fail("插件加载超时"), timeoutMs);
  function destroy() {
    if (closed) return;
    closed = true;
    clearTimeout(readyTimer);
    clearInterval(heartbeat);
    ipcMain.removeHandler(apiChannel);
    ipcMain.removeListener("extension:reply", reply);
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("插件进程已关闭"));
    }
    pending.clear();
    if (!window.isDestroyed()) window.destroy();
    guard?.dispose(); guard = null;
    ses.protocol.unhandle("https");
    ses.webRequest.onBeforeRequest(null);
    ses.removeListener("will-download", denyDownload);
    allowed.clear();
  }
  function fail(message) {
    if (closed) return;
    readyReject(Error(message));
    try {
      onFault(message);
    } finally {
      destroy();
    }
  }
  function reply(event, message) {
    if (
      closed ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      return;
    if (message?.protocol !== EXTENSION_PROTOCOL) {
      fail("扩展协议版本不兼容");
      return;
    }
    if (message.fatal) {
      fail("插件未处理异常：" + String(message.fatal).slice(0, 4000));
      return;
    }
    if (message?.ready) {
      clearTimeout(readyTimer);
      readyResolve();
      return;
    }
    try {
      message = readExtensionMessage(message);
    } catch (e) {
      fail(e.message);
      return;
    }
    const p = pending.get(message?.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(message.id);
    if (message.error) p.reject(Error(message.error));
    else p.resolve(message.value);
  }
  ipcMain.on("extension:reply", reply);
  window.webContents.on("render-process-gone", () => fail("插件进程意外退出"));
  function request(method, payload) {
    if (closed) return Promise.reject(Error("插件进程已关闭"));
    if (pending.size >= 128) return Promise.reject(Error("扩展请求队列已满"));
    try {
      payload = extensionJson(payload);
    } catch (e) {
      return Promise.reject(e);
    }
    return new Promise((resolve, reject) => {
      const id = ++serial,
        timer = setTimeout(() => {
          pending.delete(id);
          reject(Error("插件执行超时，已停止该进程"));
          fail("插件执行超时");
        }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      window.webContents.send("extension:request", {
        protocol: EXTENSION_PROTOCOL,
        id,
        method,
        payload,
      });
    });
  }
  try {
    await window.loadURL(origin + "/index.html");
    await ready;
    guard = await guardProcess(window.webContents.getOSProcessId(), { onExit: fail });
    const contribution = await request("activate", {
      manifest: bundle.manifest,
      entryUrl: origin + "/plugin/" + bundle.manifest.entry,
      availableApis,
    });
    heartbeat = setInterval(() => {
      if (!closed) void request("ping", {}).catch(() => {});
    }, 1500);
    return {
      contribution,
      request,
      show() {
        if (closed || !nativeWindow) throw Error('插件没有可打开的独立窗口');
        window.show(); window.focus();
      },
      diagnostics() {
        return { pid: closed ? null : window.webContents.getOSProcessId(), closed,
          visible: !closed && window.isVisible(), memoryMiB: guard?.memoryMiB || 0, cpuRate: guard?.cpuRate || 0 };
      },
      async dispose() {
        if (!closed)
          try {
            const result = await request("dispose", {});
            if (result.errors?.length)
              throw Error("插件清理失败：" + result.errors.join("; "));
          } finally {
            destroy();
          }
      },
      destroy,
    };
  } catch (e) {
    destroy();
    throw e;
  }
}
module.exports = { createExtensionRunner };

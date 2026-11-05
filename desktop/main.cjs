const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, clipboard } = require("electron");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { createAccessController } = require("./access-controller.cjs");
const { createMcpCredentials } = require("./mcp-credentials.cjs");
const { reservePort } = require("./bridge-port.cjs");
const { createProfileStorage } = require("./profile-storage.cjs");
const { installPluginController } = require("./plugin-controller.cjs");
const { installProjectController } = require("./project-controller.cjs");

const root = app.isPackaged
  ? process.resourcesPath
  : path.resolve(__dirname, "..");
const gateway = path.join(root, "ai-gateway", "server.mjs");
const mcpServer = path.join(root, "ai-gateway", "mcp-client.mjs");
const icon = path.join(root, "assets", "workflow-studio.ico");
let bridge;
let bridgePort = null;
let shuttingDown = false;
let profileStorage;
let mainWindow;
let accessController;
let connectionFile;
const instanceId = randomBytes(24).toString("hex");
const controlToken = randomBytes(32).toString("hex");
function isTrustedMain(event) {
  try {
    return (
      !!mainWindow &&
      !mainWindow.isDestroyed() &&
      event.sender === mainWindow.webContents &&
      event.senderFrame === mainWindow.webContents.mainFrame &&
      new URL(event.senderFrame.url).origin === `http://127.0.0.1:${bridgePort}`
    );
  } catch {
    return false;
  }
}
// 同一配置目录仅允许一个写入者，不同配置目录仍可独立打开并测试文件冲突。
const ownsProfile = app.requestSingleInstanceLock();
if (!ownsProfile) app.quit();
else
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

// 原生菜单只提供桌面外壳操作，工作流命令与可配置热键仍由插件管理。
function installApplicationMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "文件",
        submenu: [
          { label: "关闭窗口", role: "close" },
          { type: "separator" },
          { label: "退出", role: "quit" },
        ],
      },
      {
        label: "编辑",
        submenu: [
          { label: "撤销文本编辑", role: "undo" },
          { label: "重做文本编辑", role: "redo" },
          { type: "separator" },
          { label: "剪切", role: "cut" },
          { label: "复制", role: "copy" },
          { label: "粘贴", role: "paste" },
          { label: "全选", role: "selectAll" },
        ],
      },
      {
        label: "视图",
        submenu: [
          { label: "重新加载界面", role: "reload" },
          { label: "强制重新加载界面", role: "forceReload" },
          { label: "开发者工具", role: "toggleDevTools" },
          { type: "separator" },
          { label: "恢复界面缩放", role: "resetZoom" },
          { label: "放大界面", role: "zoomIn" },
          { label: "缩小界面", role: "zoomOut" },
          { type: "separator" },
          { label: "切换全屏", role: "togglefullscreen" },
        ],
      },
      {
        label: "窗口",
        submenu: [
          { label: "最小化", role: "minimize" },
          { label: "最大化或还原", role: "zoom" },
        ],
      },
      {
        label: "帮助",
        submenu: [
          {
            label: "关于 MengGod Workflow Studio",
            click: async () => {
              await dialog.showMessageBox({
                type: "info",
                title: "关于 MengGod Workflow Studio",
                message: "MengGod Workflow Studio",
                detail: `版本 ${app.getVersion()}\n可视化着色器工作流编辑器\n快捷键可在“插件设置 → 快捷键”中自定义。`,
                buttons: ["确定"],
                defaultId: 0,
                noLink: true,
              });
            },
          },
        ],
      },
    ]),
  );
}

function waitForBridge(child, port, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => finish(Error("本地页面桥接启动超时")),
      timeoutMs,
    );
    const onExit = () => finish(Error("本地页面桥接启动失败"));
    const onMessage = (value) => {
      if (value?.type === "ready" && value.port === port) finish();
    };
    function finish(error) {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("exit", onExit);
      error ? reject(error) : resolve();
    }
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
}

async function createWindow() {
  profileStorage = createProfileStorage(
    path.join(app.getPath("userData"), "workflow-storage.json"),
  );
  const port = await reservePort();
  bridgePort = port;
  connectionFile = path.join(app.getPath("userData"), "mcp-endpoint.json");
  accessController = createAccessController({
    baseUrl: `http://127.0.0.1:${port}`,
    controlToken,
    isAllowed: isTrustedMain,
    credentials: createMcpCredentials({
      file: path.join(app.getPath("userData"), "mcp-credentials.json"),
      secureStorage: safeStorage,
    }),
  });
  const { createProjectFiles } = require(
    path.join(root, "packages", "native-host", "project-files.mjs"),
  );
  const disposeProjects = installProjectController({
    repository: createProjectFiles({
      root: path.join(app.getPath("userData"), "project-files"),
    }),
    isAllowed: isTrustedMain,
  });
  app.once("will-quit", disposeProjects);
  const { createPluginRepository } = require(
    path.join(root, "packages", "native-host", "plugin-repository.mjs"),
  );
  const { createExtensionRunner } = require(
    path.join(root, "packages", "extension-host", "electron-runner.cjs"),
  );
  const { createTaskRunner } = require(
    path.join(root, "packages", "extension-host", "task-runner.cjs"),
  );
  const { createExtensionCapabilities } = require(
    path.join(root, "packages", "native-host", "extension-capabilities.mjs"),
  );
  // 组合根记录内置源码位置，平台层只接收映射，不推断插件 ID 或导入插件实现。
  const builtinFolders = {
    "studio.node-model": "node-model",
    "studio.project-files": "project-files",
    "studio.workflow-service": "workflow-service",
    "studio.workspace": "workspace",
    "studio.mcp-connection": "mcp-connection",
    "studio.plugin-service": "plugin-service",
    "studio.shortcuts": "shortcuts",
    "studio.declarations": "declarations",
    "studio.extension-ui": "extension-ui",
    "studio.interaction": "interaction",
    "studio.ui": "ui",
    "studio.plugin-manager": "plugin-manager",
    "studio.mcp": "mcp",
    "studio.noise": "noise",
    "studio.math": "math",
    "studio.sdf": "sdf",
    "studio.starsector": "starsector",
    "studio.compiler": "compiler",
    "studio.glsl": "glsl-backend",
    "studio.preview": "preview",
    "studio.templates": "templates",
    "studio.layout": "layout",
    "studio.workflow-ui": "workflow-ui",
    "studio.geometry-ui": "geometry-ui",
    "studio.project-ui": "project-ui",
    "example.layout": "example-layout",
    "example.showcase": "example-showcase",
  };
  const builtinDirectories = Object.fromEntries(
    Object.entries(builtinFolders).map(([id, folder]) => [
      id,
      path.join(root, "plugins", folder),
    ]),
  );
  const disposePlugins = installPluginController({
    repository: createPluginRepository({
      indexFile: path.join(app.getPath("userData"), "local-plugins.json"),
      reservedIds: [...Object.keys(builtinDirectories), "studio.builtin"],
      builtinDirectories,
    }),
    createRunner: createExtensionRunner,
    createTaskRunner,
    createCapabilities: createExtensionCapabilities,
    dataRoot: path.join(app.getPath("userData"), "extension-data"),
    isAllowed: isTrustedMain,
  });
  app.once("before-quit", disposePlugins);
  bridge = spawn(process.execPath, [gateway], {
    cwd: path.dirname(gateway),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      WORKFLOW_BRIDGE_PORT: String(port),
      WORKFLOW_BRIDGE_CONTROL_TOKEN: controlToken,
      WORKFLOW_BRIDGE_INSTANCE: instanceId,
      WORKFLOW_PLUGIN_SETTINGS: path.join(
        app.getPath("userData"),
        "plugin-settings.json",
      ),
    },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true,
  });
  bridge.on("error", (error) =>
    dialog.showErrorBox("启动失败", `本地桥接服务无法启动：${error.message}`),
  );
  bridge.once("exit", (code) => {
    if (!shuttingDown && code !== 0)
      dialog.showErrorBox(
        "页面桥接已停止",
        `本地页面桥接服务异常退出（代码 ${code}）。`,
      );
  });
  await waitForBridge(bridge, port);
  // 未配置时不签发授权，已有授权启动时恢复。连接文件只含本次地址和身份，不含凭据。
  try { await accessController.restore(); } catch { /* 编辑器仍可启动，面板提供撤销和重新配置。 */ }
  fs.mkdirSync(path.dirname(connectionFile), { recursive: true });
  fs.writeFileSync(connectionFile + ".tmp", JSON.stringify({
    version: 1, url: `http://127.0.0.1:${port}`, instanceId, processId: process.pid,
  }));
  fs.renameSync(connectionFile + ".tmp", connectionFile);
  app.once("will-quit", () => {
    try {
      if (JSON.parse(fs.readFileSync(connectionFile, "utf8")).instanceId === instanceId)
        fs.unlinkSync(connectionFile);
    } catch {}
  });
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    title: "MengGod Workflow Studio",
    icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = window;
  window.once("closed", () => app.quit());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== `http://127.0.0.1:${port}`)
      event.preventDefault();
  });
  window.webContents.on("did-start-navigation", (details) => {
    // 切换着色器阶段会 replaceState，同文档导航不结束授权会话。
    if (details.isMainFrame && !details.isSameDocument)
      void accessController.endSession().catch(() => {});
  });
  await window.loadURL(`http://127.0.0.1:${port}/?bridgePort=${port}`);
}

function testMcpServer(token) {
  if (!bridgePort) throw new Error("页面服务尚未启动");
  const { testMcpServer: test } = require(
    path.join(root, "plugins", "mcp", "self-test.cjs"),
  );
  const { openStdioClient } = require(
    path.join(root, "packages", "native-host", "stdio-client.cjs"),
  );
  return test({
    createClient: (options) =>
      openStdioClient({ ...options, executablePath: process.execPath }),
    serverPath: mcpServer,
    bridgeUrl: "http://127.0.0.1:" + bridgePort,
    token,
  });
}

ipcMain.handle("workflowDesktop:bridgeRequest", (event, input) =>
  accessController.proxy(event, input),
);
ipcMain.handle("workflowDesktop:revokeMcp", (event) =>
  accessController.revoke(event),
);
ipcMain.handle("workflowDesktop:mcpStatus", (event) => accessController.status(event));
ipcMain.handle("workflowDesktop:copyText", (event, value) => {
  if (!isTrustedMain(event) || typeof value !== "string" || value.length > 100000)
    throw Error("复制请求无效");
  clipboard.writeText(value);
});
ipcMain.handle("workflowDesktop:testMcp", (event) =>
  accessController.selfTest(event, testMcpServer),
);
ipcMain.handle("workflowDesktop:getMcpConfig", async (event, input) => ({
  ...(await accessController.issue(event, input)),
  bridgeUrl: "http://127.0.0.1:" + bridgePort,
  connectionFile,
  executablePath: process.execPath,
  mcpServerPath: mcpServer,
}));
ipcMain.on("workflowDesktop:storage", (event, method, ...args) => {
  try {
    if (
      !isTrustedMain(event) ||
      !["getItem", "setItem", "setItems", "removeItem"].includes(method)
    )
      throw new Error("存储调用来源或方法无效");
    event.returnValue = {
      ok: true,
      value: profileStorage[method](...args) ?? null,
    };
  } catch (error) {
    event.returnValue = { ok: false, error: error.message };
  }
});

if (ownsProfile)
  app
    .whenReady()
    .then(async () => {
      installApplicationMenu();
      await createWindow();
    })
    .catch((error) => {
      dialog.showErrorBox(
        "无法打开工作流",
        `存储或本地服务启动失败，原文件已保留：\n${error.message}`,
      );
      app.quit();
    });
app.on("window-all-closed", () => {
  shuttingDown = true;
  if (bridge && !bridge.killed) bridge.kill();
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  shuttingDown = true;
  if (bridge && !bridge.killed) bridge.kill();
});

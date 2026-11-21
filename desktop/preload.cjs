const { contextBridge, ipcRenderer, webUtils } = require("electron");
const visibilityChannel = "workflowDesktop:windowVisibility";
const visibilityListeners = new Set();
let windowVisible = false;
const receiveVisibility = (_event, visible) => {
  windowVisible = visible === true;
  for (const listener of [...visibilityListeners]) {
    try { listener(windowVisible); }
    catch (error) { console.error("窗口可见性订阅失败", error); }
  }
};
// 所有预览组件共用一条原生监听，避免节点增多时重复同步 IPC 与监听器累积。
const onWindowVisibility = (callback) => {
  if (!visibilityListeners.size) {
    ipcRenderer.on(visibilityChannel, receiveVisibility);
    try { windowVisible = ipcRenderer.sendSync(visibilityChannel) === true; }
    catch (error) {
      ipcRenderer.removeListener(visibilityChannel, receiveVisibility);
      throw error;
    }
  }
  const listener = (visible) => callback(visible);
  visibilityListeners.add(listener);
  const stop = () => {
    visibilityListeners.delete(listener);
    if (!visibilityListeners.size) ipcRenderer.removeListener(visibilityChannel, receiveVisibility);
  };
  try { listener(windowVisible); }
  catch (error) { stop(); throw error; }
  return stop;
};
const storageCall = (method, ...args) => {
  const result = ipcRenderer.sendSync(
    "workflowDesktop:storage",
    method,
    ...args,
  );
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

contextBridge.exposeInMainWorld("workflowDesktop", {
  mcpStatus: () => ipcRenderer.invoke("workflowDesktop:mcpStatus"),
  copyText: (value) => ipcRenderer.invoke("workflowDesktop:copyText", value),
  packaged: true,
  onWindowVisibility,
  projects: {
    // 仅接受用户在文件输入框选中的真实 File，JS 构造的 File 没有磁盘路径。
    fromFile: (file) => {
      const path = webUtils.getPathForFile(file);
      if (!path) throw Error("请选择磁盘上的工作流文件");
      return ipcRenderer.invoke("workflowDesktop:projects", "selectedFile", {
        path,
      });
    },
    call: (method, input) =>
      ipcRenderer.invoke("workflowDesktop:projects", method, input),
    checkpoint: (input) => {
      const result = ipcRenderer.sendSync(
        "workflowDesktop:projectCheckpoint",
        input,
      );
      if (!result.ok) throw Error(result.error);
    },
  },
  plugins: {
    call: (method, input) =>
      ipcRenderer.invoke("workflowDesktop:plugins", method, input),
    onFault: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on("workflowDesktop:pluginFault", listener);
      return () =>
        ipcRenderer.removeListener("workflowDesktop:pluginFault", listener);
    },
    onRequest: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on("workflowDesktop:pluginRequest", listener);
      return () =>
        ipcRenderer.removeListener("workflowDesktop:pluginRequest", listener);
    },
  },
  storage: {
    getVersion: (keys) => storageCall("getVersion", keys),
    getItem: (key) => storageCall("getItem", key),
    setItem: (key, value) => storageCall("setItem", key, value),
    setItems: (items) => storageCall("setItems", items),
    removeItem: (key) => storageCall("removeItem", key),
  },
  bridgeRequest: (input) =>
    ipcRenderer.invoke("workflowDesktop:bridgeRequest", input),
  revokeMcp: () => ipcRenderer.invoke("workflowDesktop:revokeMcp"),
  testMcp: () => ipcRenderer.invoke("workflowDesktop:testMcp"),
  getMcpConfig: (input) =>
    ipcRenderer.invoke("workflowDesktop:getMcpConfig", input),
});

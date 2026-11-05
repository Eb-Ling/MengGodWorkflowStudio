const { contextBridge, ipcRenderer, webUtils } = require("electron");
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

const { contextBridge, ipcRenderer } = require("electron");
const channel = process.argv
  .find((value) => value.startsWith("--workflow-extension-channel="))
  ?.slice("--workflow-extension-channel=".length);
// 沙箱仅有这一条请求/结果桥，没有文件、网络或 Studio 私有对象。
contextBridge.exposeInMainWorld("pluginRuntime", {
  onRequest(callback) {
    ipcRenderer.on("extension:request", (_event, request) => callback(request));
  },
  reply(message) {
    ipcRenderer.send("extension:reply", message);
  },
  call(request) {
    return ipcRenderer.invoke(channel, { ...request, protocol: 1 });
  },
});

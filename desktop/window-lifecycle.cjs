/** 桌面只报告真实窗口状态，后台通信与预览是否播放由各自服务负责。 */
function installWindowLifecycle({ window, ipcMain, isAllowed }) {
  const channel = "workflowDesktop:windowVisibility";
  const contents = window.webContents;
  let disposed = false;
  const visible = () => !disposed && !window.isDestroyed() &&
    window.isVisible() && !window.isMinimized();
  const publish = () => {
    if (!disposed && !contents.isDestroyed()) contents.send(channel, visible());
  };
  const read = (event) => {
    event.returnValue = isAllowed(event) ? visible() : false;
  };
  // MCP 在页面内处理请求，不能随窗口最小化暂停或被限速到一分钟一次。
  // 关闭后台限速后 document.hidden 不再反映最小化，另行提供真实窗口状态。
  contents.setBackgroundThrottling(false);
  const events = ["minimize", "restore", "hide", "show"];
  for (const event of events) window.on(event, publish);
  contents.on("did-finish-load", publish);
  ipcMain.on(channel, read);
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const event of events) window.off(event, publish);
    contents.off("did-finish-load", publish);
    ipcMain.off(channel, read);
    window.off("closed", dispose);
  }
  window.once("closed", dispose);
  return dispose;
}
module.exports = { installWindowLifecycle };

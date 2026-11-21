/** 平台适配器，桌面使用真实窗口状态，网页版使用浏览器标签页状态。 */
export function observeWindowVisibility(document, desktop, listener) {
  if (desktop?.onWindowVisibility) return desktop.onWindowVisibility(listener);
  const changed = () => listener(!document.hidden);
  document.addEventListener("visibilitychange", changed);
  try {
    changed();
  } catch (error) {
    document.removeEventListener("visibilitychange", changed);
    throw error;
  }
  return () => document.removeEventListener("visibilitychange", changed);
}

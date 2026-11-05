/** 桌面与浏览器存储分别使用自己的当前记录，不读取或补迁移旧数据。 */
export function persistentStorage() {
  return window.workflowDesktop?.storage || window.localStorage;
}

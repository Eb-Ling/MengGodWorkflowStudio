/** 为公开平台接口提供持久配置，编码所有者/键名，满足桌面存储边界且避免命名碰撞。 */
export function createPluginSettings(storage, owner) {
  const encode = value => Array.from(value, c => c.codePointAt(0).toString(16)).join(".");
  const keyOf = key => {
    if (typeof key !== "string" || !/^[\w.-]{1,80}$/.test(key)) throw Error("无效插件配置键");
    return `workflow.plugin.${encode(owner)}.settings.${encode(key)}`;
  };
  return {get: key => storage.getItem(keyOf(key)), set: (key,value) => {
    if (typeof value !== "string" || value.length > 256*1024) throw Error("插件配置需要不超过 256 KiB 的文本");
    storage.setItem(keyOf(key), value);
  }};
}

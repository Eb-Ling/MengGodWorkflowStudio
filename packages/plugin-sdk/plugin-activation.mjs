/** 当前只开放首次调用 JSON API 的激活事件，不改变同步组件和节点目录的接口语义。 */
export function readActivationEvents(manifest) {
  const events = manifest.activationEvents ?? [];
  if (
    !Array.isArray(events) ||
    events.length > 16 ||
    new Set(events).size !== events.length
  )
    throw Error("激活事件必须是最多 16 项的不重复数组");
  for (const event of events) {
    const id =
      typeof event === "string" && event.startsWith("onApi:")
        ? event.slice(6)
        : "";
    const api = Object.hasOwn(manifest.providesApis || {}, id)
      ? manifest.providesApis[id]
      : null;
    if (!id || !api || api.transport === "local")
      throw Error("激活事件仅支持 onApi: 加自身提供的 JSON API 名称");
  }
  if (
    events.length &&
    Object.keys(manifest.providesApis || {}).some(
      (id) => !events.includes("onApi:" + id),
    )
  )
    throw Error("按需插件的所有提供 API 都必须声明激活事件，不能混入同步能力");
  return [...events];
}

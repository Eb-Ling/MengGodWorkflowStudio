/**
 * L1 插件接入适配：将受限执行端口装配为插件 SDK 上下文。
 * 本地与隔离入口共用，不交付端口对象、内核管理器或可写 Store。
 * 权限判断、所有者身份与撤销以端口的管理方为准，这里不另建注册表。
 */
export function createPluginContext(port) {
  // 只缓存本次激活的外观，不缓存权限或可用状态，每次访问仍经管理端口校验。
  const apis = new Map();
  port.own(() => apis.clear());
  const cleanupAdapter = (own) => (cleanup) => {
    const cancel = own(cleanup);
    return () => cancel?.();
  };
  const publicApi = (id) => {
    const handle = port.resolve(id);
    if (!apis.has(id)) {
      const methods = new Map();
      apis.set(
        id,
        new Proxy(
          {},
          {
            get(_target, name) {
              const member = handle[name];
              // 非函数值来自对应能力提供者，不交付内核代理自身。
              if (typeof member !== "function") return member;
              if (!methods.has(name))
                methods.set(name, (...args) => handle[name](...args));
              return methods.get(name);
            },
          },
        ),
      );
    }
    return apis.get(id);
  };
  return Object.freeze({
    pluginId: port.owner,
    api: publicApi,
    hasApi: (id) => port.has(id),
    provide: (id, implementation) =>
      port.publish(
        id,
        typeof implementation === "function"
          ? (owner, own, metadata) =>
              implementation(owner, cleanupAdapter(own), metadata)
          : implementation,
      ),
    onDispose: cleanupAdapter((cleanup) => port.own(cleanup)),
  });
}

/** 插件入口约定只在接入层解释，返回的 dispose 也归同一所有者统一回收。 */
export async function activatePlugin(activate, port) {
  const result = await activate(createPluginContext(port));
  if (result?.dispose !== undefined) {
    if (typeof result.dispose !== "function")
      throw Error("插件返回的 dispose 必须是函数");
    port.own(() => result.dispose());
  }
}

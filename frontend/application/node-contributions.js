import { ContributionRegistry } from "../../packages/kernel/index.mjs";
import { ownRegistration } from "../../packages/plugin-sdk/registration.mjs";

/** 基础语法节点只登记定义，其语义由编译前端处理，不提供源码回调。 */
export function createNodeContributions(initial) {
  const registry = new ContributionRegistry(),
    catalog = [];
  const contribution = (definitions) => ({
    nodes: definitions.map(({ owner, version, ...node }) => node),
    compilers: [],
  });
  const builtin = registry.register(
    "studio.builtin",
    "1.0.0",
    contribution(initial),
    { builtinDefinitions: true },
  );
  const sync = () => catalog.splice(0, catalog.length, ...registry.list());
  const off = registry.subscribe(sync);
  sync();
  /** 为指定插件创建贡献接口，宿主同时登记清理，即使插件遗漏 onDispose 也能回收。 */
  /** @param {string} owner @param {(cleanup:()=>void)=>void} onDispose */
  function createApi(
    owner,
    onDispose = () => {},
    metadata = { version: "1.0.0" },
  ) {
    return {
      list: () => registry.list(),
      get: (typeId) => registry.get(typeId),
      register: (batch) => {
        const handle = registry.register(owner, metadata.version, batch, { fingerprint: metadata.fingerprint ?? null });
        const owned = ownRegistration(onDispose, handle);
        return { owner, get active() { return owned.active; }, dispose: owned.dispose, replace: handle.replace };
      },
    };
  }
  const port = Object.fromEntries(
    [
      "list",
      "get",
      "owner",
      "identity",
      "subscribe",
      "invalidate",
      "compile",
      "register",
    ].map((name) => [name, (...args) => registry[name](...args)]),
  );
  return {
    registry: port,
    catalog,
    createApi,
    dispose() {
      off();
      builtin.dispose();
    },
  };
}

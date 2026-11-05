import { activatePlugin } from "../plugin-runtime/context.mjs";
import { copyJson } from "../plugin-sdk/schema.mjs";
import { validateRemoteCall } from "../plugin-sdk/extension-protocol.mjs";
/** 可独立测试的隔离侧 SDK。只有 load/call 两个注入端口，不持有平台对象。 */
export function createExtensionRuntime({ load, call }) {
  const rules = new Map(),
    provided = new Map(),
    cleanups = [];
  let nodes = [],
    live = true,
    activated = false,
    manifest,
    available = [];
  const check = () => {
    if (!live) throw Error("插件已停用");
  };
  const nodeApi = {
    register(batch) {
      check();
      if (!manifest.capabilities.includes("nodes.register"))
        throw Error("缺少能力：nodes.register");
      if (activated) throw Error("节点贡献需在 activate 完成前登记");
      if (!Array.isArray(batch.nodes) || !Array.isArray(batch.compilers))
        throw Error("贡献需要 nodes 与 compilers");
      const definitions = copyJson(batch.nodes),
        next = new Map();
      for (const rule of batch.compilers) {
        const key = rule.typeId + "@" + rule.target;
        if (
          rules.has(key) ||
          next.has(key) ||
          typeof rule.compile !== "function"
        )
          throw Error("规则重复或缺少 compile");
        next.set(key, rule.compile);
      }
      for (const [k, v] of next) rules.set(k, v);
      nodes.push(...definitions);
      let valid = true;
      return {
        dispose() {
          if (!valid) return;
          valid = false;
          for (const k of next.keys()) rules.delete(k);
          const ids = new Set(definitions.map((n) => n.typeId));
          nodes = nodes.filter((n) => !ids.has(n.typeId));
        },
      };
    },
  };
  function api(id) {
    check();
    if (!available.includes(id)) throw Error("不可用 API：" + id);
    return new Proxy(
      {},
      {
        get(_target, method) {
          if (method === "then") return undefined;
          if (id === "workflow.nodes" && method === "register")
            return nodeApi.register;
          return (...args) => {
            check();
            const request = validateRemoteCall(manifest, {
              api: id,
              method,
              args,
            });
            return call(request).then((value) => {
              check();
              return copyJson(value);
            });
          };
        },
      },
    );
  }
  return {
    async execute({ method, payload }) {
      if (method === "ping") return { alive: live };
      if (method === "activate") {
        if (manifest) throw Error("插件已激活");
        manifest = payload.manifest;
        available = payload.availableApis || Object.keys(manifest.requiredApis);
        const module = await load(payload),
          plugin = module[manifest.exportName];
        if (!plugin || typeof plugin.activate !== "function")
          throw Error(
            "入口未导出 " + manifest.exportName + "，或缺少 activate(context)",
          );
        await activatePlugin(plugin.activate.bind(plugin), {
          owner: manifest.id,
          resolve: api,
          has: (id) => live && available.includes(id),
          publish(id, value) {
            check();
            const spec = manifest.providesApis?.[id];
            if (
              activated ||
              !spec ||
              provided.has(id) ||
              !value ||
              typeof value !== "object" ||
              Object.keys(spec.methods).some(
                (name) => typeof value[name] !== "function",
              )
            )
              throw Error("API 实现与声明不符");
            provided.set(id, value);
          },
          own(fn) {
            check();
            if (typeof fn !== "function") throw Error("无效清理");
            cleanups.push(fn);
            return () => {
              const i = cleanups.indexOf(fn);
              if (i >= 0) cleanups.splice(i, 1);
            };
          },
        });
        activated = true;
        if (
          Object.keys(manifest.providesApis || {}).some(
            (id) => !provided.has(id),
          )
        )
          throw Error("未提供声明的 API");
        return {
          nodes: copyJson(nodes),
          compilers: [...rules.keys()].map((key) => {
            const i = key.lastIndexOf("@");
            return { typeId: key.slice(0, i), target: key.slice(i + 1) };
          }),
          apis: [...provided.keys()],
        };
      }
      if (method === "compile") {
        check();
        const compile = rules.get(payload.typeId + "@" + payload.target);
        if (!compile) throw Error("缺少节点编译规则");
        return copyJson(await compile(copyJson(payload.context)));
      }
      if (method === "invoke") {
        check();
        const spec = manifest.providesApis?.[payload.api];
        if (!spec?.methods[payload.method]) throw Error("未声明 API 方法");
        return copyJson(
          await provided
            .get(payload.api)
            [payload.method](...copyJson(payload.args)),
        );
      }
      if (method === "dispose") {
        live = false;
        const errors = [];
        for (const fn of cleanups.splice(0).reverse())
          try {
            await fn();
          } catch (e) {
            errors.push(String(e).slice(0, 1000));
          }
        rules.clear();
        provided.clear();
        nodes = [];
        return { errors };
      }
      throw Error("未知扩展请求");
    },
  };
}

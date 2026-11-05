import {
  validateRemoteCall,
  extensionJson,
} from "../../packages/plugin-sdk/extension-protocol.mjs";
/** 隔离进程与公开 API 的适配，实现不导入插件，生命周期及所有权由 PluginHost 决定。 */
export function externalPlugin(prepared, platform) {
  return {
    manifest: prepared.manifest,
    fingerprint: prepared.fingerprint ?? null,
    async activate(context) {
      const generation = prepared.generation,
        cache = new Map();
      let live = true,
        stopped = false;
      const apis = new Map();
      const api = (id) => {
        if (!apis.has(id)) apis.set(id, context.api(id));
        return apis.get(id);
      };
      const off = platform.onRequest?.(async (message) => {
        if (message.generation !== generation) return;
        const response = { generation, requestId: message.requestId };
        try {
          if (!live || message.protocol !== 1)
            throw Error("插件调用已撤销或协议无效");
          const request = validateRemoteCall(prepared.manifest, {
            api: message.api,
            method: message.method,
            args: message.args,
          });
          response.value = extensionJson(
            await api(request.api)[request.method](...request.args),
          );
          if (!live) throw Error("插件结果已撤销");
        } catch (error) {
          delete response.value;
          response.error = String(error?.message || error).slice(0, 4000);
        }
        await platform.call("apiReply", response).catch(() => {});
      });
      const stop = async () => {
        if (stopped) return;
        stopped = true;
        live = false;
        cache.clear();
        off?.();
        await platform.call("stop", { generation });
      };
      context.onDispose(stop);
      const availableApis = Object.keys({
        ...prepared.manifest.optionalApis,
        ...prepared.manifest.requiredApis,
      }).filter((id) => context.hasApi(id));
      const contribution = await platform.call("start", {
        generation,
        availableApis,
      });
      for (const [id, spec] of Object.entries(
        prepared.manifest.providesApis || {},
      )) {
        if (!contribution.apis?.includes(id))
          throw Error("隔离插件未提供 API：" + id);
        context.provide(
          id,
          Object.fromEntries(
            Object.keys(spec.methods).map((method) => [
              method,
              (...args) => {
                if (!live) throw Error("插件已停用");
                return platform.call("invoke", {
                  generation,
                  api: id,
                  method,
                  args,
                });
              },
            ]),
          ),
        );
      }
      const compilers = contribution.compilers.map((rule) => ({
        ...rule,
        compile(input) {
          if (!live) throw Error("插件编译器已撤销");
          // 上下文为内核校验后的 JSON 副本，不把源码回调、图对象或平台能力传给扩展。
          const key = JSON.stringify([rule.typeId, rule.target, input]);
          let entry = cache.get(key);
          if (!entry) {
            if (cache.size >= 2048)
              for (const [id, item] of cache) {
                if (item.done) {
                  cache.delete(id);
                  break;
                }
              }
            if (cache.size >= 2048)
              throw Error("插件编译队列已满，请减少同时预览的节点");
            entry = { done: false };
            cache.set(key, entry);
            entry.promise = platform
              .call("compile", { generation, ...rule, context: input })
              .then(
                (value) => {
                  entry.done = true;
                  if (!live) throw Error("插件编译器已撤销");
                  return value;
                },
                (error) => {
                  entry.done = true;
                  throw error;
                },
              );
          }
          // 首次调用直接等待结果，相同请求合并，不用失败重试触发预览刷新。
          return entry.promise;
        },
      }));
      if (contribution.nodes.length || compilers.length)
        api("workflow.nodes").register({
          nodes: contribution.nodes,
          compilers,
        });
      // 最后登记，使进程先退出，再释放它通过作用域 API 创建的宿主资源。
      context.onDispose(stop);
    },
  };
}

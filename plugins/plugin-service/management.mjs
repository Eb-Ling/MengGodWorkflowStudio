import { ownCleanup } from "../../packages/plugin-sdk/registration.mjs";
/** studio.plugins 的宿主适配：管理界面只调用此 API，挂载统一委托内核。 */
export function createPluginManagement({
  host,
  platform,
  invalidate,
  builtinIds,
  setBuiltin,
  persistBuiltinState = async () => {},
}) {
  const external = new Map(),
    failed = new Map(),
    faults = new Map(),
    listeners = new Set();
  let busy = false,
    error = "",
    notice = "",
    ready = false,
    disposed = false,
    operation = Promise.resolve();
  const snapshot = () => ({
    ready,
    busy,
    error,
    notice,
    desktop: !!platform,
    plugins: [
      ...host.list().map((p) => ({
        ...p,
        source: external.has(p.id) ? "local" : "builtin",
        directory: external.get(p.id)?.directory || "",
        fingerprint: external.get(p.id)?.fingerprint || null,
        generation: external.get(p.id)?.generation || null,
        diagnostic: faults.get(p.id) || null,
        error: faults.get(p.id)?.message || p.error,
        nativeWindow: !!external.get(p.id)?.manifest.isolation?.window,
        protected: ["studio.plugin-manager", "studio.plugin-service"].includes(
          p.id,
        ),
        developmentOnly: !!p.developmentOnly,
      })),
      ...[...failed.values()].map((r) => ({
        ...r.manifest,
        id: r.id,
        name: r.manifest?.name || r.id,
        version: r.manifest?.version || "1.0.0",
        requiredApis: r.manifest?.requiredApis || {},
        enabled: false,
        error: r.error,
        source: "local",
        directory: r.directory,
        fingerprint: r.fingerprint || null,
        generation: null,
        bindings: {},
        diagnostic: {
          code: "PLUGIN_RESTORE_FAILED",
          message: r.error,
          generation: null,
        },
      })),
    ],
  });
  const notify = () => {
    for (const fn of listeners)
      try {
        fn(snapshot());
      } catch {}
  };
  const native = () => {
    if (!platform) throw Error("选择本地插件目录需要桌面版");
    return platform;
  };
  const definition = (p) => p;
  const mutate = async (fn) => {
    if (busy) throw Error("另一个插件操作正在进行");
    busy = true;
    error = "";
    notice = "";
    notify();
    try {
      operation = Promise.resolve().then(fn);
      return await operation;
    } catch (e) {
      error = String(e);
      throw e;
    } finally {
      busy = false;
      notify();
    }
  };
  const release = async (p) => {
    if (p) await platform.call("release", { generation: p.generation });
  };
  // 持久化内核计算后的实际状态，包含自动激活的提供者和级联停用的目录消费者。
  async function persistEnabled() {
    await persistBuiltinState();
    for (const plugin of host.list())
      if (external.has(plugin.id))
        await native().call("setEnabled", {
          id: plugin.id,
          enabled: plugin.enabled,
        });
  }
  // 只投影内核给出的依赖结果，不在管理适配中重建依赖图。
  const previewDisable = (id) => {
    const plugins = host.list(),
      target = plugins.find((p) => p.id === id);
    if (!target) throw Error("未知插件：" + id);
    const impact = host.impact(id);
    const describe = (ids) =>
      ids.map((key) => ({
        id: key,
        name: plugins.find((p) => p.id === key)?.name || key,
      }));
    return {
      id,
      name: target.name,
      stop: describe(impact.stop),
      restart: describe(impact.restart),
      reviewKey: JSON.stringify([
        id,
        [...impact.stop].sort(),
        [...impact.restart].sort(),
      ]),
    };
  };
  const checkReview = (id, reviewKey) => {
    const impact = previewDisable(id);
    if (
      (impact.stop.some((p) => p.id !== id) ||
        impact.restart.length ||
        reviewKey !== undefined) &&
      reviewKey !== impact.reviewKey
    )
      throw Error("停用影响范围需要确认或已变化，请重新查看并确认");
  };
  async function install(
    draft,
    manifest,
    createTemplate = false,
    approvePermissions = false,
  ) {
    const p = await native().call(
        "prepare",
        JSON.parse(
          JSON.stringify({
            token: draft.token,
            manifest,
            createTemplate,
            approvePermissions,
          }),
        ),
      ),
      id = p.manifest.id,
      old = external.get(id);
    if (
      builtinIds.has(id) ||
      ["studio.plugin-manager", "studio.plugin-service"].includes(id)
    ) {
      await release(p);
      throw Error("插件 ID 与内置插件冲突");
    }
    const enabled = old ? host.list().find((x) => x.id === id)?.enabled : true;
    let mounted = false;
    try {
      if (old) await host.replace(definition(p));
      else {
        host.register(definition(p));
        mounted = true;
      }
      mounted = true;
      // 新安装默认启用，停用中的插件仍以短暂激活验证声明，再恢复停用状态。
      await host.setEnabled(id, true);
      if (!enabled) await host.setEnabled(id, false);
      await platform.call("commit", {
        generation: p.generation,
        enabled: !!enabled,
      });
      external.set(id, p);
      failed.delete(id);
      faults.delete(id);
      await release(old);
    } catch (e) {
      if (mounted) {
        if (old) {
          await host.replace(definition(old));
          await host.setEnabled(id, !!enabled);
        } else await host.unregister(id);
      }
      await release(p);
      if (old)
        faults.set(id, {
          code: "PLUGIN_RELOAD_FAILED",
          message: "重新加载失败，保留原实现：" + String(e),
          generation: old.generation,
        });
      throw e;
    }
    // 安装已提交后只报告状态保存错误，不拿已释放的旧代次回滚安装。
    await persistEnabled();
    notice = "已登记并验证：" + p.manifest.name;
  }
  const api = {
    openWindow: (id) =>
      mutate(async () => {
        if (
          !snapshot().plugins.some(
            (p) => p.id === id && p.nativeWindow && p.enabled,
          )
        )
          throw Error("插件没有已启用的独立窗口");
        await native().call("openWindow", { id });
        notice = "已打开隔离插件窗口";
      }),
    openDirectory: (id) =>
      mutate(async () => {
        if (!snapshot().plugins.some((plugin) => plugin.id === id))
          throw Error("未知插件：" + id);
        await native().call("openDirectory", { id });
        notice = "已打开插件文件夹";
      }),
    snapshot,
    previewDisable,
    authorized: () => native().call("authorized"),
    authorize: (draft, manifest) =>
      mutate(async () => {
        const result = await native().call("authorize", {
          token: draft.token,
          manifest: JSON.parse(JSON.stringify(manifest)),
        });
        notice = "已授权当前目录内容，AI 可以按 ID 登记，插件尚未加载";
        return result;
      }),
    registerAuthorized: (id, authorizationId) =>
      mutate(async () => {
        const draft = await native().call("inspectAuthorized", {
          id,
          authorizationId,
        });
        await install(draft, draft.manifest);
      }),
    revokeAuthorization: (id, authorizationId) =>
      mutate(async () => {
        await native().call("revokeAuthorization", { id, authorizationId });
        notice = "已撤销 AI 登记授权，已加载插件的启停状态保持不变";
      }),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    choose: (id) => mutate(() => native().call("choose", id ? { id } : {})),
    inspect: (id) => mutate(() => native().call("inspect", { id })),
    install: (draft, manifest, createTemplate, approvePermissions) =>
      mutate(() =>
        install(draft, manifest, createTemplate, approvePermissions),
      ),
    reload: (id) =>
      mutate(async () => {
        try {
          const draft = await native().call("inspect", { id });
          if (draft.error) throw Error(draft.error);
          await install(draft, draft.manifest);
        } catch (e) {
          const old = external.get(id);
          if (old)
            faults.set(id, {
              code: "PLUGIN_RELOAD_FAILED",
              message: "重新加载失败，保留原实现：" + String(e),
              generation: old.generation,
            });
          throw e;
        }
      }),
    setEnabled: (id, enabled, reviewKey) =>
      mutate(async () => {
        if (["studio.plugin-manager", "studio.plugin-service"].includes(id))
          throw Error("插件管理入口必须保持可用");
        if (failed.has(id))
          throw Error("插件目录加载失败，请编辑声明或重新加载");
        if (!enabled) checkReview(id, reviewKey);
        if (external.has(id)) {
          const previous = host.list().find((p) => p.id === id).enabled;
          await host.setEnabled(id, enabled);
          if (enabled) faults.delete(id);
          try {
            await persistEnabled();
          } catch (e) {
            await host.setEnabled(id, previous);
            throw e;
          }
        } else {
          notice = await setBuiltin(id, enabled);
          await persistEnabled();
        }
        notice ||= enabled ? "插件已启用" : "插件已停用";
      }),
    remove: (id, reviewKey) =>
      mutate(async () => {
        if (!external.has(id) && !failed.has(id))
          throw Error("只能移除本地目录登记");
        const p = external.get(id),
          enabled = host.list().find((x) => x.id === id)?.enabled;
        if (p) checkReview(id, reviewKey);
        if (p) await host.unregister(id);
        try {
          await native().call("remove", { id });
        } catch (e) {
          if (p) {
            host.register(definition(p));
            await host.setEnabled(id, enabled);
          }
          throw e;
        }
        external.delete(id);
        failed.delete(id);
        faults.delete(id);
        await release(p);
        await persistEnabled();
        notice =
          "已移除登记，源文件与用户授予的目录登记授权保留，可单独撤销授权";
      }),
  };
  const unsubscribe = platform?.onFault(({ generation, error: message }) => {
    // 等待正在进行的替换，再核对代次，旧进程的迟到故障不能停用新实现。
    void (async () => {
      while (busy) await operation.catch(() => {});
      const p = [...external.values()].find((x) => x.generation === generation);
      if (!p || disposed) return;
      await mutate(async () => {
        const diagnostic = {
          code: "PLUGIN_PROCESS_FAULT",
          message: String(message),
          generation,
        };
        faults.set(p.manifest.id, diagnostic);
        try {
          await host.setEnabled(p.manifest.id, false);
        } finally {
          error = p.manifest.name + "：" + message;
          invalidate();
          await persistEnabled();
        }
      });
    })().catch((e) => {
      error = String(e);
      notify();
    });
  });
  return {
    api,
    /** 订阅在消费者停用时由内核兜底释放，避免 UI 插件遗留监听器。 */
    scoped(_owner, own) {
      return {
        ...api,
        subscribe(fn) {
          const stop = api.subscribe(fn);
          return ownCleanup(own, stop);
        },
      };
    },
    notify,
    get busy() {
      return busy;
    },
    async initialize() {
      try {
        if (platform) {
          const restored = [];
          for (const p of await platform.call("restore")) {
            if (p.error) {
              failed.set(p.id, p);
              continue;
            }
            try {
              if (
                builtinIds.has(p.manifest.id) ||
                ["studio.plugin-manager", "studio.plugin-service"].includes(
                  p.manifest.id,
                )
              )
                throw Error("插件 ID 与内置插件冲突");
              host.register(definition(p));
              external.set(p.manifest.id, p);
              restored.push(p);
            } catch (e) {
              if (external.has(p.manifest.id)) continue;
              failed.set(p.manifest.id, {
                id: p.manifest.id,
                ...p,
                error: String(e),
              });
              await release(p);
            }
          }
          // 先登记全部声明，再由内核解析依赖，目录顺序不决定加载顺序。
          for (const p of restored.filter((p) => p.enabled))
            try {
              await host.setEnabled(p.manifest.id, true, { defer: true });
            } catch (e) {
              error = p.manifest.name + "：" + String(e);
            }
        }
      } catch (e) {
        error = String(e);
      }
      try {
        await persistEnabled();
      } catch (e) {
        error = String(e);
      }
      ready = true;
      notify();
    },
    dispose() {
      disposed = true;
      unsubscribe?.();
      listeners.clear();
    },
  };
}

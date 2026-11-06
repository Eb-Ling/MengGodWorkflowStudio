import { createPluginManagement } from "./management.mjs";
/** 启停持久化、目录恢复、冲突审查与轮询归管理能力，唯一依赖图仍在内核。 */
export function createAdministration({
  host,
  platform,
  invalidate,
  builtinIds,
  browser,
  storage,
  ports,
}) {
  const baseUrl = browser.baseUrl;
  async function request(input) {
    const response = await browser.fetch(baseUrl + "/host/plugins", {
      signal: AbortSignal.timeout(5000),
      ...(input
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        : {}),
    });
    const value = await response.json();
    if (!response.ok) throw Error(value.error || `HTTP ${response.status}`);
    return value.plugins;
  }
  function rememberUi() {
    storage.setItem(
      "workflow.uiRestore",
      JSON.stringify(
        host
          .list()
          .filter((p) => p.enabled)
          .map((p) => p.id),
      ),
    );
  }
  async function synchronize(plugins) {
    // 正常轮询只取一次本地列表。实际启停可能连带改变依赖，此时才重新读取。
    const localStates = () => new Map(host.list().filter(p => builtinIds.has(p.id)).map(p => [p.id, p.enabled]));
    let local = localStates(), changed = false;
    const remoteStates = new Map(plugins.map(p => [p.id, p.enabled]));
    if (remoteStates.get("studio.ui") === false && local.get("studio.ui")) rememberUi();
    for (const remote of [...plugins.filter(p => !p.enabled), ...plugins.filter(p => p.enabled)]) {
      if (!local.has(remote.id) || local.get(remote.id) === remote.enabled) continue;
      await host.setEnabled(remote.id, remote.enabled, { defer: true });
      local = localStates();
      changed = true;
    }
    for (const [id, enabled] of local) if (remoteStates.get(id) !== enabled) {
      await request({ id, enabled });
      changed = true;
    }
    return changed;
  }
  let revision = 0;
  const management = createPluginManagement({
    host,
    platform,
    invalidate,
    builtinIds,
    persistBuiltinState: async () => {
      // 目录消费者也能激活内置提供者，保存后阻止两秒轮询重新套用旧启停快照。
      revision++;
      for (const p of host.list().filter((p) => builtinIds.has(p.id)))
        await request({ id: p.id, enabled: p.enabled });
    },
    setBuiltin: async (id, enabled) => {
      if (!builtinIds.has(id)) throw Error("未知内置插件");
      revision++;
      const before = host.list();
      if (id === "studio.ui" && !enabled) rememberUi();
      if (enabled && id === "studio.mcp") await request({ id, enabled });
      await host.setEnabled(id, enabled);
      const changed = host
        .list()
        .filter(
          (p) =>
            p.id !== id &&
            before.find((b) => b.id === p.id)?.enabled !== p.enabled,
        );
      return changed.length
        ? changed
            .map(
              (p) =>
                `${p.enabled ? "依赖已自动启用" : "依赖消费者已同时停用"}：${p.name}`,
            )
            .join("，")
        : `${enabled ? "已启用" : "已停用"}：${before.find((p) => p.id === id)?.name || id}`;
    },
  });

  let timer = null,
    closed = false,
    polling = false,
    off = null;
  return {
    ...management,
    async start() {
      try {
        await synchronize(await request());
      } catch (error) {
        console.error("内置插件状态恢复失败", error);
      }
      await management.initialize();
      off = management.api.subscribe(() => ports.pending(management.busy));
      ports.recovery(async () => {
        let ids = [];
        try {
          ids = JSON.parse(storage.getItem("workflow.uiRestore") || "[]");
        } catch {}
        await management.api.setEnabled("studio.ui", true);
        await host.setEnabled("studio.plugin-manager", true);
        for (const id of ids)
          if (
            id !== "studio.plugin-manager" &&
            host.list().some((p) => p.id === id && !p.enabled)
          )
            await management.api.setEnabled(id, true);
        management.notify();
      });
      timer = setInterval(async () => {
        if (closed || management.busy || polling || ports.recoveryBusy())
          return;
        polling = true;
        const current = revision;
        try {
          const plugins = await request();
          if (!closed && current === revision && !management.busy) {
            if (await synchronize(plugins)) management.notify();
          }
        } catch {
        } finally {
          polling = false;
        }
      }, 2000);
    },
    dispose() {
      closed = true;
      clearInterval(timer);
      off?.();
      management.dispose();
    },
  };
}

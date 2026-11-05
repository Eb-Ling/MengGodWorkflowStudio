const kinds = ["selection", "layers", "layout"];
const freeze = (v) => {
  if (v && typeof v === "object") {
    Object.freeze(v);
    for (const x of Object.values(v)) freeze(x);
  }
  return v;
};
/** 纯策略注册表。输入独立冻结，输出检查 ID/数值，不保存文档，不持有 UI 或内核 Store。 */
export function createStrategyRegistry(defaults) {
  const entries = new Map(),
    active = new Map(),
    listeners = new Set();
  let live = true;
  const notify = () => {
    for (const fn of listeners) {
      try {
        fn();
      } catch {}
    }
  };
  function add(owner, d) {
    if (!live) throw Error("策略服务已停用");
    if (
      !kinds.includes(d.kind) ||
      !d.id?.startsWith(owner + ".") ||
      typeof d.run !== "function" ||
      !d.title ||
      entries.has(d.id)
    )
      throw Error("策略声明无效、ID 重复或超出命名空间");
    const entry = { ...d, owner };
    entries.set(d.id, entry);
    if (!active.has(d.kind)) active.set(d.kind, d.id);
    notify();
    return {
      dispose() {
        if (entries.get(d.id) !== entry) return;
        entries.delete(d.id);
        if (active.get(d.kind) === d.id) {
          const fallback = [...entries.values()].find((x) => x.kind === d.kind);
          if (fallback) active.set(d.kind, fallback.id);
          else active.delete(d.kind);
        }
        notify();
      },
    };
  }
  for (const d of defaults) add("studio.interaction", d);
  return {
    scoped(owner, own = () => {}) {
      let valid = true;
      own(() => {
        valid = false;
      });
      const check = () => {
        if (!valid || !live) throw Error("策略接口已撤销");
      };
      return {
        register(d) {
          check();
          const h = add(owner, d);
          own(h.dispose);
          return h;
        },
        list() {
          check();
          return [...entries.values()].map(({ id, title, kind, owner }) => ({
            id,
            title,
            kind,
            owner,
            active: active.get(kind) === id,
          }));
        },
        activate({ kind, id }) {
          check();
          if (entries.get(id)?.kind !== kind) throw Error("策略不存在");
          active.set(kind, id);
          notify();
        },
        subscribe(fn) {
          check();
          listeners.add(fn);
          const off = () => listeners.delete(fn);
          own(off);
          return off;
        },
        evaluate({ kind, input }) {
          check();
          const entry = entries.get(active.get(kind));
          if (!entry) throw Error("未提供策略：" + kind);
          const request = freeze(structuredClone(input));
          const result = entry.run(request);
          const finish = (value) => {
            check();
            if (
              entries.get(entry.id) !== entry ||
              active.get(kind) !== entry.id
            )
              throw Error("策略结果已过期");
            const output = structuredClone(value),
              ids = new Set(
                (request.graph?.nodes || request.nodes || []).map((n) => n.id),
              );
            if (kind === "layout") {
              if (!Array.isArray(output?.positions))
                throw Error("布局策略必须返回 positions");
              const seen = new Set();
              for (const p of output.positions) {
                if (
                  !ids.has(p.nodeId) ||
                  seen.has(p.nodeId) ||
                  ![p.x, p.y].every(Number.isFinite)
                )
                  throw Error("布局策略返回未知/重复节点或无效坐标");
                seen.add(p.nodeId);
              }
            } else {
              if (
                !Array.isArray(output?.nodeIds) ||
                new Set(output.nodeIds).size !== output.nodeIds.length ||
                output.nodeIds.some((id) => !ids.has(id))
              )
                throw Error("策略返回未知或重复节点");
              if (kind === "layers" && output.nodeIds.length !== ids.size)
                throw Error("显示顺序必须包含全部节点");
            }
            return output;
          };
          if (result?.then) {
            if (kind !== "layout") {
              Promise.resolve(result).catch(() => {});
              throw Error("选择和显示顺序策略必须同步");
            }
            return result.then(finish);
          }
          return finish(result);
        },
      };
    },
    dispose() {
      live = false;
      listeners.clear();
      entries.clear();
      active.clear();
    },
  };
}

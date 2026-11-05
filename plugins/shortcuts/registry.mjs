import {
  normalizeShortcut,
  shortcutFromEvent,
} from "../../packages/plugin-sdk/shortcuts.mjs";
/** 快捷键只注册声明和用户覆盖，不持有工作流、DOM 或命令实现。 */
export function createShortcutRegistry(preferences) {
  const entries = new Map(),
    listeners = new Set();
  let overrides = {},
    live = true;
  const bindings = (value) => {
    if (!Array.isArray(value) || value.length > 3)
      throw Error("每个操作最多三个快捷键");
    return [...new Set(value.map(normalizeShortcut))];
  };
  try {
    const saved = JSON.parse(preferences.get("bindings") || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved))
      for (const [id, value] of Object.entries(saved)) {
        try {
          overrides[id] = bindings(value);
        } catch {}
      }
  } catch {}
  const notify = () => {
    for (const fn of listeners) {
      try {
        fn();
      } catch {}
    }
  };
  const keys = (entry, config = overrides) =>
    Object.hasOwn(config, entry.id) ? config[entry.id] : entry.defaults;
  const overlaps = (a, b) => a === b || a === "workspace" || b === "workspace";
  function conflicts(entry, chosen = keys(entry), config = overrides) {
    return [...entries.values()]
      .filter(
        (other) =>
          other.id !== entry.id &&
          overlaps(entry.scope, other.scope) &&
          keys(other, config).some((key) => chosen.includes(key)),
      )
      .map((e) => e.id);
  }
  function write(next) {
    if (!live) throw Error("快捷键服务已停用");
    preferences.set("bindings", JSON.stringify(next));
    overrides = next;
    notify();
  }
  const list = () =>
    [...entries.values()].map((e) => ({
      ...e,
      defaults: [...e.defaults],
      bindings: [...keys(e)],
      conflicts: conflicts(e),
    }));
  const configure = (id, value) => {
    const entry = entries.get(id);
    if (!entry) throw Error("快捷键操作不存在");
    const next = bindings(value),
      collision = conflicts(entry, next);
    if (collision.length)
      throw Error(
        "快捷键冲突：" +
          collision.map((id) => entries.get(id).title).join("、"),
      );
    write({ ...overrides, [id]: next });
  };
  const reset = (id) => {
    const next = { ...overrides };
    if (id) {
      const entry = entries.get(id);
      if (!entry) throw Error("快捷键操作不存在");
      delete next[id];
      if (conflicts(entry, entry.defaults, next).length)
        throw Error("默认快捷键已被占用，请先解除冲突");
    } else for (const key of Object.keys(next)) delete next[key];
    write(next);
  };
  return {
    list,
    configure,
    reset,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** @param {string} owner @param {(cleanup: () => void) => void} own */
    scoped(owner, own = (_cleanup) => {}) {
      let valid = true;
      own(() => {
        valid = false;
      });
      const check = () => {
        if (!live || !valid) throw Error("快捷键接口已撤销");
      };
      return {
        register(definitions) {
          check();
          if (
            !Array.isArray(definitions) ||
            !definitions.length ||
            definitions.length > 100
          )
            throw Error("快捷键声明数量无效");
          const pending = new Map();
          for (const d of definitions) {
            if (
              !d.id?.startsWith(owner + ".") ||
              entries.has(d.id) ||
              pending.has(d.id) ||
              !d.title ||
              !/^[A-Za-z][\w.-]*$/.test(d.scope)
            )
              throw Error("快捷键声明无效或 ID 重复");
            pending.set(d.id, {
              id: d.id,
              title: String(d.title),
              scope: d.scope,
              owner,
              defaults: bindings(d.defaults),
            });
          }
          for (const [id, d] of pending) entries.set(id, d);
          notify();
          const handle = {
            dispose() {
              for (const [id, d] of pending)
                if (entries.get(id) === d) entries.delete(id);
              notify();
            },
          };
          own(handle.dispose);
          return handle;
        },
        list() {
          check();
          return list();
        },
        subscribe(fn) {
          check();
          listeners.add(fn);
          const off = () => listeners.delete(fn);
          own(off);
          return off;
        },
        configure(id, value) {
          check();
          configure(id, value);
        },
        reset(id) {
          check();
          reset(id);
        },
        resolve(event, scope) {
          check();
          if (event.repeat || event.defaultPrevented) return null;
          const key = shortcutFromEvent(event);
          if (!key) return null;
          const candidates = [...entries.values()].filter(
            (e) =>
              (e.scope === scope || e.scope === "workspace") &&
              keys(e).includes(key),
          );
          return candidates.length === 1 &&
            candidates[0].owner === owner &&
            !conflicts(candidates[0]).length
            ? candidates[0].id
            : null;
        },
      };
    },
    dispose() {
      live = false;
      entries.clear();
      listeners.clear();
    },
  };
}

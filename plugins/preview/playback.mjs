/** 一个工作流的顶点和片段共用 u_time。时间只属于预览会话，不写入工作流。 */
export function createPreviewPlayback() {
  const listeners = new Set(), changes = new Set();
  let active = true;
  let time = 0, playing = false, available = false;
  let anchor = 0, timer, source, previous = new Map();
  const snapshot = () => ({ time, playing, available });
  function publish(tick = false) {
    const state = snapshot();
    for (const listener of listeners) listener(state, tick);
    if (!tick) for (const listener of changes) listener(state, false);
  }
  function set({ time: nextTime, playing: nextPlaying } = {}) {
    if (nextTime === undefined && nextPlaying === undefined) throw Error("请提供预览秒数或播放状态");
    if (nextTime !== undefined && !Number.isFinite(nextTime)) throw Error("预览时间必须是有限数");
    if (nextPlaying !== undefined && typeof nextPlaying !== "boolean") throw Error("预览播放状态必须为布尔值");
    if (nextTime !== undefined) time = nextTime;
    if (nextPlaying !== undefined) playing = nextPlaying;
    schedule();
    publish();
    return snapshot();
  }
  function schedule() {
    clearInterval(timer);
    timer = undefined;
    if (active && playing) {
      anchor = performance.now() - time * 1000;
      timer = setInterval(() => {
        time = (performance.now() - anchor) / 1000;
        publish(true);
      }, 83);
    }
  }
  function sync(s) {
    const values = new Map();
    for (const [stage, graph] of [["fragment", s.fragmentGraph], ["vertex", s.vertexTransform.graph]]) {
      for (const node of graph.nodes) if (node.typeId === "input.time") {
        const n = Number(node.properties?.defaultValue);
        values.set(stage + ":" + node.id, { base: Number.isFinite(n) ? n : 0,
          auto: ![false, "false"].includes(node.properties?.autoAdvance) });
      }
    }
    const wasAvailable = available;
    available = values.size > 0;
    let change = {};
    if (s.documentToken !== source || available !== wasAvailable) {
      const first = values.values().next().value;
      change = { time: first?.base ?? 0, playing: first?.auto ?? false };
    } else {
      for (const [key, value] of values) {
        const old = previous.get(key);
        if (!old) continue;
        if (old.base !== value.base) change.time = value.base;
        if (old.auto !== value.auto) change.playing = value.auto;
      }
    }
    previous = values;
    source = s.documentToken;
    if (Object.keys(change).length) set(change);
  }
  return {
    snapshot, set, sync,
    setActive(value) {
      if (active === value) return;
      active = value;
      schedule();
    },
    status: () => ({ clockSubscribers: listeners.size, changeSubscribers: changes.size, clockTimer: timer !== undefined }),
    subscribe(fn, ticks = true) {
      const set = ticks ? listeners : changes;
      fn(snapshot(), false);
      set.add(fn);
      return () => set.delete(fn);
    },
    dispose() {
      clearInterval(timer);
      timer = undefined;
      listeners.clear();
      changes.clear();
      previous.clear();
    },
  };
}

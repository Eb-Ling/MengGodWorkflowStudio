/** 编译插件内部的有界 JSON 结果缓存，不持有工作流或插件生命周期状态。 */
export function createCompilationCache({
  maxEntries = 128,
  maxBytes = 16 * 1024 * 1024,
  maxPending = 16,
} = {}) {
  const values = new Map(),
    pending = new Map();
  let live = true,
    bytes = 0,
    hits = 0,
    misses = 0,
    coalesced = 0,
    evictions = 0,
    oversized = 0;
  const check = () => {
    if (!live) throw Error("编译缓存已释放，结果不可继续使用");
  };
  function trim() {
    while (values.size > maxEntries || bytes > maxBytes) {
      const [key, entry] = values.entries().next().value;
      values.delete(key);
      bytes -= entry.bytes;
      evictions++;
    }
  }
  return {
    async run(key, load) {
      check();
      const known = values.get(key);
      if (known) {
        hits++;
        values.delete(key);
        values.set(key, known);
        return JSON.parse(known.text);
      }
      let task = pending.get(key);
      if (task) coalesced++;
      else {
        if (pending.size >= maxPending) throw Error("编译请求过多，请稍后重试");
        misses++;
        task = Promise.resolve()
          .then(load)
          .then((value) => {
            check();
            const text = JSON.stringify(value),
              size = 2 * (key.length + text.length);
            if (size <= maxBytes) {
              values.set(key, { text, bytes: size });
              bytes += size;
              trim();
            } else oversized++;
            return text;
          })
          .finally(() => {
            if (pending.get(key) === task) pending.delete(key);
          });
        pending.set(key, task);
      }
      const text = await task;
      check();
      return JSON.parse(text);
    },
    status: () => ({
      entries: values.size,
      bytes,
      inFlight: pending.size,
      hits,
      misses,
      coalesced,
      evictions,
      oversized,
      limits: { maxEntries, maxBytes, maxPending },
    }),
    dispose() {
      live = false;
      values.clear();
      bytes = 0;
      pending.clear();
    },
  };
}

/** 固定算法与种子生成有界压力顺序，目录参数顺序不会影响重放。 */
export function createStressSchedule(
  ids,
  { seed = 1, cycles = 3, restartPasses = 1 } = {},
) {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 16 ||
    ids.some((id) => typeof id !== "string" || !id) ||
    new Set(ids).size !== ids.length
  )
    throw Error("压力测试需要 1–16 个不同的插件 ID");
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isInteger(cycles) ||
    cycles < 1 ||
    cycles > 10 ||
    !Number.isInteger(restartPasses) ||
    restartPasses < 0 ||
    restartPasses > 3 ||
    cycles * restartPasses * ids.length > 48
  )
    throw Error(
      "压力预算：uint32 种子、1–10 轮、0–3 次重启遍历，合计最多 48 次停用/恢复",
    );
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const shuffle = () => {
    const order = [...ids].sort();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  };
  return {
    algorithm: "mulberry32-fisher-yates-v1",
    seed,
    cycles,
    restartPasses,
    rounds: Array.from({ length: cycles }, () => ({
      registration: shuffle(),
      enable: shuffle(),
      restarts: Array.from({ length: restartPasses }, () => shuffle())
        .flat()
        .map((pluginId) => ({ pluginId, restore: shuffle() })),
    })),
  };
}

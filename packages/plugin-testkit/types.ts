import type { LocalPluginManifest } from "../plugin-sdk/types";
/** 原始插件快照，读取时不会执行代码。 */
export interface PluginInspection {
  directory: string;
  files: Record<string, string>;
  bytes: number;
  manifest: LocalPluginManifest;
}
/** 检查文件边界、预算和当前版本声明。 */
export declare function inspectPlugin(
  directory: string,
): Promise<PluginInspection>;
/** 提供者版本由测试环境显式给出，不表示实际 Studio 的启停状态。 */
export declare const STUDIO_TEST_APIS: Readonly<Record<string, string>>;
/** 不执行插件代码，仅经真实内核解析依赖。 */
export declare function checkPluginSet(
  bundles: PluginInspection[],
  options?: { apis?: Record<string, string> },
): Promise<{
  ok: true;
  mode: "declarations-only";
  activationOrder: string[];
  plugins: { id: string; kind: string; files: number; bytes: number }[];
  assumptions: Record<string, string>;
}>;
/** 可重放调度，同种子、同插件集合产生相同顺序，不承诺操作系统异步时序一致。 */
export interface StressOptions {
  /** 0–4294967295，默认 1。 */
  seed?: number;
  /** 1–10 轮，默认 3。 */
  cycles?: number;
  /** 每轮逐插件重启遍历 0–3 次，默认 1，所有轮合计最多 48 次停用/恢复。 */
  restartPasses?: number;
}
export declare function createStressSchedule(
  ids: string[],
  options?: StressOptions,
): {
  algorithm: "mulberry32-fisher-yates-v1";
  seed: number;
  cycles: number;
  restartPasses: number;
  rounds: {
    registration: string[];
    enable: string[];
    restarts: { pluginId: string; restore: string[] }[];
  }[];
};
/** 全量、逐个单装、单提供者/基础 API 缺席，仅声明级，完整组合无效时抛出。 */
export declare function checkPluginMatrix(
  bundles: PluginInspection[],
  options?: { apis?: Record<string, string> },
): Promise<{
  /** 表示矩阵执行成功，不表示每个组合均可加载，读取 cases[].accepted 判断。 */
  ok: true;
  mode: "declaration-matrix";
  baseline: Awaited<ReturnType<typeof checkPluginSet>>;
  cases: {
    name: string;
    plugins: string[];
    apis: Record<string, string>;
    accepted: boolean;
    activationOrder?: string[];
    error?: string;
  }[];
  coverage: string;
}>;

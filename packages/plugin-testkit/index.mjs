import { readPluginFiles } from "../native-host/plugin-files.mjs";
import { readPluginManifest } from "../plugin-sdk/plugin-manifest.mjs";
import { PluginRuntime } from "../plugin-runtime/index.mjs";
export { createStressSchedule } from "./schedule.mjs";

/** 只读取声明和快照，不 import 或执行目录内代码。 */
export async function inspectPlugin(directory) {
  const bundle = await readPluginFiles(directory);
  if (!Object.hasOwn(bundle.files, "studio-plugin.json"))
    throw Error("目录缺少 studio-plugin.json");
  const manifest = readPluginManifest(
    JSON.parse(bundle.files["studio-plugin.json"]),
  );
  if (
    manifest.kind !== "declarative" &&
    !Object.hasOwn(bundle.files, manifest.entry)
  )
    throw Error("找不到入口文件：" + manifest.entry);
  // 与安装器实际交给隔离进程的声明保持一致，原始磁盘文件不改写。
  bundle.files["studio-plugin.json"] = JSON.stringify(manifest, null, 2) + "\n";
  return { ...bundle, manifest };
}

/** 声明级组合矩阵：全量、逐个单装、逐个提供者/基础 API 缺席，不执行插件代码。 */
export async function checkPluginMatrix(
  bundles,
  { apis = STUDIO_TEST_APIS } = {},
) {
  // 完整组合必须有效，避免把格式错误或环误报成预期的缺席结果。
  const baseline = await checkPluginSet(bundles, { apis });
  const cases = [],
    seen = new Set();
  async function run(name, selected, available) {
    const plugins = selected.map((b) => b.manifest.id).sort();
    const key = JSON.stringify([plugins, Object.entries(available).sort()]);
    if (seen.has(key)) return;
    seen.add(key);
    try {
      const result = await checkPluginSet(selected, { apis: available });
      cases.push({
        name,
        plugins,
        apis: available,
        accepted: true,
        activationOrder: result.activationOrder,
      });
    } catch (error) {
      cases.push({
        name,
        plugins,
        apis: available,
        accepted: false,
        error: error.message,
      });
    }
  }
  await run("complete", bundles, apis);
  for (const bundle of bundles)
    await run("only:" + bundle.manifest.id, [bundle], apis);
  for (const bundle of bundles)
    if (
      bundles.length > 1 &&
      Object.keys(bundle.manifest.providesApis || {}).length
    )
      await run(
        "without-provider:" + bundle.manifest.id,
        bundles.filter((b) => b !== bundle),
        apis,
      );
  for (const id of Object.keys(apis))
    await run(
      "without-api:" + id,
      bundles,
      Object.fromEntries(Object.entries(apis).filter(([key]) => key !== id)),
    );
  return {
    ok: true,
    mode: "declaration-matrix",
    baseline,
    cases,
    coverage:
      "全量、单装、单个提供者或基础 API 缺席（相同组合去重），非所有子集，不执行脚本",
  };
}

/** 仅声明级依赖验证，默认模拟 Studio 已开放的五个基础 API，不声称这些 API 已被实际执行。 */
export const STUDIO_TEST_APIS = Object.freeze({
  "platform.extension": "1.0.0",
  "workflow.nodes": "1.0.0",
  "workflow.editor": "1.0.0",
  "studio.extension-ui": "1.0.0",
  "studio.declarations": "1.0.0",
});

/** 复用唯一 PluginHost 校验版本、缺失/重复提供者和环。activationOrder 只表示声明解析顺序。 */
export async function checkPluginSet(
  bundles,
  { apis = STUDIO_TEST_APIS } = {},
) {
  if (!Array.isArray(bundles) || !bundles.length || bundles.length > 16)
    throw Error("一次检查需要 1–16 个插件目录");
  const host = new PluginRuntime(),
    activationOrder = [];
  try {
    for (const [id, version] of Object.entries(apis))
      host.provide(id, version, {});
    for (const bundle of bundles) {
      const manifest = readPluginManifest(bundle.manifest);
      host.register({
        manifest,
        activate(context) {
          activationOrder.push(manifest.id);
          for (const [id, spec] of Object.entries(manifest.providesApis || {}))
            context.provide(
              id,
              Object.fromEntries(
                Object.keys(spec.methods).map((name) => [
                  name,
                  () => {
                    throw Error("声明检查不执行 API");
                  },
                ]),
              ),
            );
        },
      });
    }
    for (const bundle of bundles)
      await host.setEnabled(bundle.manifest.id, true);
    return {
      ok: true,
      mode: "declarations-only",
      activationOrder,
      plugins: bundles.map((b) => ({
        id: b.manifest.id,
        kind: b.manifest.kind,
        files: Object.keys(b.files).length,
        bytes: b.bytes,
      })),
      assumptions: apis,
    };
  } finally {
    await host.dispose();
  }
}

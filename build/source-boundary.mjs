/** 通用编译路径不能声明目标包依赖，即使当前没有使用该导入。 */
export const neutralCompilationPackages = Object.freeze([
  "packages/workflow-tools",
  "packages/shader-ir",
  "plugins/workflow-service",
  "plugins/node-model",
  "plugins/compiler",
  "plugins/glsl-backend",
  "plugins/preview",
]);
export function targetDependencyErrors(owner, manifest) {
  if (!neutralCompilationPackages.includes(owner)) return [];
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.devDependencies,
  };
  return ["@workflow/starsector-contract", "@workflow-plugin/starsector"]
    .filter((name) => Object.hasOwn(dependencies, name))
    .map((name) => `${owner}: 通用编译路径不得声明游戏目标依赖 ${name}`);
}

/** 同一套源码边界用于实际扫描和越界反例，类型契约不授予运行时服务权限。 */
export function sourceBoundaryErrors(
  file,
  target,
  { from, to, typeOnly = false, composition = false },
) {
  const errors = [];
  const fail = (message) => errors.push(`${file}: ${message} ${target}`);
  if (
    to === "packages/starsector-contract" &&
    neutralCompilationPackages.includes(from)
  )
    fail("通用编译路径不得导入游戏目标契约");
  if (
    to === "packages/starsector-contract" &&
    from !== to &&
    from !== "plugins/starsector" &&
    target !== "packages/starsector-contract/export-api.mjs"
  )
    fail("只有 Starsector 目标可以消费其 Java 与运行时 ABI");
  if (
    from.startsWith("plugins/") &&
    from !== to &&
    ![
      "packages/plugin-sdk",
      "packages/example-layout-api",
      "packages/starsector-contract",
      "packages/shader-ir",
      "packages/workflow-tools",
      "packages/ui-kit",
    ].includes(to)
  )
    fail("插件越界导入");
  if (
    to === "packages/ui-kit" &&
    from.startsWith("plugins/") &&
    from !== "plugins/ui" &&
    !typeOnly
  )
    fail("组件实现仅由 UI 能力插件装配，请通过 studio.ui 使用");
  if (
    from === "packages/kernel" &&
    !["packages/kernel", "packages/plugin-sdk"].includes(to)
  )
    fail("内核越界导入");
  if (from === "packages/plugin-sdk" && to !== from) fail("SDK 依赖实现");
  if (
    from === "packages/ui-kit" &&
    !["packages/ui-kit", "packages/plugin-sdk"].includes(to)
  )
    fail("UI 基础库反向依赖");
  if (
    [
      "packages/shader-ir",
      "packages/starsector-contract",
      "packages/workflow-tools",
      "packages/example-layout-api",
    ].includes(from) &&
    ![from, "packages/plugin-sdk"].includes(to)
  )
    fail("领域契约依赖实现");
  if (to.startsWith("plugins/") && !composition && from !== to)
    fail("非组合根导入插件实现");
  if (
    ["plugins/geometry-ui", "plugins/project-ui"].includes(from) &&
    to === "packages/starsector-contract" &&
    target !== "packages/starsector-contract/export-api.mjs" &&
    !typeOnly
  )
    fail("视图不能执行目标规则");
  return errors;
}

/** 工作区包名与相对路径进入同一检查流程，不能通过别名绕过 exports 或层级。 */
export function workspaceTarget(specifier, manifests) {
  for (const [folder, manifest] of manifests) {
    if (
      specifier !== manifest.name &&
      !specifier.startsWith(manifest.name + "/")
    )
      continue;
    const subpath =
      specifier === manifest.name
        ? "."
        : "." + specifier.slice(manifest.name.length);
    const exported = manifest.exports?.[subpath];
    if (
      typeof exported !== "string" ||
      !exported.startsWith("./") ||
      exported.split("/").includes("..")
    )
      throw Error(`跨包访问非公开入口：${specifier}`);
    return folder + "/" + exported.slice(2);
  }
  return null;
}

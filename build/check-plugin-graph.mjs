// 静态清单解析，不执行插件 activate，覆盖必需和可选 API 的潜在提供者边。
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compatibleVersion } from "../packages/kernel/api-broker.mjs";
import ts from "typescript";
import { inspectLayers, inspectBusinessDependencies } from "./layer-policy.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  manifests = [],
  folders = new Map();
for (const folder of await fs.readdir(path.join(root, "plugins"))) {
  const file = path.join(root, "plugins", folder, "manifest.mjs");
  if (
    !(await fs.stat(file).then(
      (s) => s.isFile(),
      () => false,
    ))
  )
    continue;
  const module = await import(pathToFileURL(file));
  const definitions = Object.values(module).filter(
    (v) => v && typeof v === "object" && v.id && v.requiredApis,
  );
  // MCP 在 browser/server 两个宿主中分别挂载，这里检查浏览器完整插件图。
  const value = folder === "mcp" ? module.manifest : definitions[0];
  if (value) {
    manifests.push(value);
    folders.set(value.id, folder);
  }
}
const edges = [];
inspectBusinessDependencies(manifests);
// 本批已迁移的能力必须由 L2 提供，内部端口不向消费者扩散。
const ownedApis = {
  "workflow.editor": "studio.workflow-service",
  "workflow.presentation": "studio.workflow-service",
  "workflow.nodes": "studio.node-model",
  "workflow.node-catalog": "studio.node-model",
  "workflow.graph-snapshot": "studio.node-model",
  "workflow.library": "studio.workflow-service",
  "workflow.workspace": "studio.workspace",
  "workflow.export": "studio.starsector",
  "workflow.file-selection": "studio.project-files",
  "studio.plugins": "studio.plugin-service",
  "platform.extension": "studio.plugin-service",
  "studio.mcp-connection": "studio.mcp-connection",
};
for (const [api, owner] of Object.entries(ownedApis)) {
  const providers = manifests.filter((p) => p.providesApis?.[api]);
  if (providers.length !== 1 || providers[0].id !== owner)
    throw Error("业务能力提供者归属错误：" + api);
}
if (
  manifests
    .filter((p) => p.providesApis?.["workflow.preview"])
    .map((p) => p.id)
    .join(",") !== "studio.preview"
)
  throw Error("预览能力必须由 studio.preview 提供");
for (const p of manifests)
  if (
    Object.keys({ ...p.requiredApis, ...p.optionalApis }).some((id) =>
      ["preview.targets", "preview.surfaces"].includes(id),
    )
  )
    throw Error("不允许消费已移除的宿主预览端口：" + p.id);
const privatePorts = {
  "platform.node-registry": "studio.node-model",
  "platform.workspace-state": "studio.workflow-service",
  "platform.workspace-execution": "studio.workspace",
  "platform.export-storage": "studio.starsector",
  "platform.workflow-file-picker": "studio.project-files",
  "platform.plugin-host": "studio.plugin-service",
  "platform.extension-transport": "studio.plugin-service",
};
for (const consumer of manifests)
  for (const id of Object.keys({
    ...consumer.requiredApis,
    ...consumer.optionalApis,
  }))
    if (privatePorts[id] && privatePorts[id] !== consumer.id)
      throw Error("内部端口的消费方不正确：" + consumer.id + " -> " + id);
for (const consumer of manifests)
  for (const [api, range] of Object.entries({
    ...consumer.optionalApis,
    ...consumer.requiredApis,
  }))
    for (const provider of manifests) {
      const d = provider.providesApis?.[api];
      if (d && compatibleVersion(d.version, range))
        edges.push({
          from: consumer.id,
          to: provider.id,
          api,
          optional: !!consumer.optionalApis?.[api],
        });
    }
const done = new Set(),
  stack = [];
function visit(id) {
  if (stack.includes(id))
    throw Error("插件 API 依赖环：" + [...stack, id].join(" -> "));
  if (done.has(id)) return;
  stack.push(id);
  for (const e of edges.filter((e) => e.from === id)) visit(e.to);
  stack.pop();
  done.add(id);
}
for (const p of manifests) visit(p.id);
// 读取实际组合根的提供声明，而不是按 API 名称前缀猜测所属层。
const compositionSource = await fs.readFile(
  path.join(root, "frontend/application/studio-plugins.ts"),
  "utf8",
);
const compositionAst = ts.createSourceFile(
    "composition.ts",
    compositionSource,
    ts.ScriptTarget.Latest,
    true,
  ),
  hostApis = [];
function readHostApis(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.getText(compositionAst) === "host.provide"
  ) {
    const id = node.arguments[0];
    if (!id || !ts.isStringLiteral(id))
      throw Error("宿主 API 标识必须可静态审计");
    hostApis.push(id.text);
  }
  ts.forEachChild(node, readHostApis);
}
readHostApis(compositionAst);
// 三个组合根必须指向同一批内置定义，避免新增节点能力只在渲染端可见。
function variable(ast, name) {
  let value;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
      value = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!value) throw Error("缺少可审计的组合清单：" + name);
  return value;
}
function catalogFolders(ast, name) {
  const imports = new Map();
  for (const node of ast.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const folder = /(?:^|\/)plugins\/([^/]+)\//.exec(
      node.moduleSpecifier.text,
    )?.[1];
    const named = node.importClause?.namedBindings;
    if (folder && named && ts.isNamedImports(named))
      for (const entry of named.elements) imports.set(entry.name.text, folder);
  }
  let initializer = variable(ast, name);
  if (
    ts.isCallExpression(initializer) &&
    ts.isPropertyAccessExpression(initializer.expression)
  )
    initializer = initializer.expression.expression;
  if (!ts.isArrayLiteralExpression(initializer))
    throw Error("组合清单必须是静态数组：" + name);
  return initializer.elements
    .map((entry) => {
      const folder = imports.get(entry.getText(ast));
      if (!folder) throw Error("组合项没有声明来源：" + entry.getText(ast));
      return folder;
    })
    .sort();
}
function equalCatalog(actual, expected, name) {
  if (JSON.stringify(actual) !== JSON.stringify(expected.sort()))
    throw Error("内置组合清单不一致：" + name);
}
equalCatalog(
  catalogFolders(compositionAst, "builtins"),
  [...folders.values()],
  "渲染器",
);
const serverAst = ts.createSourceFile(
  "server.mjs",
  await fs.readFile(path.join(root, "ai-gateway/server.mjs"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
equalCatalog(
  catalogFolders(serverAst, "browserConfigurationPlugins"),
  [...folders]
    .filter(([id]) => !["studio.mcp", "studio.plugin-manager"].includes(id))
    .map(([, folder]) => folder),
  "原生状态配置",
);
const desktopAst = ts.createSourceFile(
  "main.cjs",
  await fs.readFile(path.join(root, "desktop/main.cjs"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const nativeFolders = variable(desktopAst, "builtinFolders");
if (!ts.isObjectLiteralExpression(nativeFolders))
  throw Error("原生目录映射必须静态声明");
const nativeEntries = nativeFolders.properties
  .map((entry) => {
    if (
      !ts.isPropertyAssignment(entry) ||
      !ts.isStringLiteral(entry.name) ||
      !ts.isStringLiteral(entry.initializer)
    )
      throw Error("原生目录映射不能动态执行");
    return [entry.name.text, entry.initializer.text].join(":");
  })
  .sort();
equalCatalog(
  nativeEntries,
  [...folders].map(([id, folder]) => id + ":" + folder),
  "原生源码目录",
);
for (const id of hostApis)
  if (ownedApis[id]) throw Error("宿主不得重新提供业务能力：" + id);
const layers = inspectLayers(manifests, hostApis);
await fs.mkdir(path.join(root, "build/verification"), { recursive: true });
await fs.writeFile(
  path.join(root, "build/verification/plugin-dependencies.json"),
  JSON.stringify(
    {
      ok: true,
      plugins: manifests.map((p) => ({
        id: p.id,
        provides: Object.keys(p.providesApis || {}),
      })),
      edges,
      layers,
    },
    null,
    2,
  ),
);
console.log(
  `PASS: ${manifests.length} 插件、${edges.length} 必需/可选 API 提供者边无环，${layers.pending.length} 条业务跨层依赖`,
);

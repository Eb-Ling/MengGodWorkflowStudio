// 对实际模块 AST 检查导入、动态入口、公开 exports 与包依赖，并输出完整依赖图。
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import {
  sourceBoundaryErrors,
  workspaceTarget,
  targetDependencyErrors,
} from "./source-boundary.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  files = [],
  errors = [],
  edges = [],
  packageEdges = new Map(),
  manifests = new Map();
const unix = (p) => p.replaceAll("\\", "/");
async function walk(dir) {
  for (const item of await fs.readdir(path.join(root, dir), {
    withFileTypes: true,
  })) {
    if (["node_modules", ".git"].includes(item.name)) continue;
    const p = unix(path.join(dir, item.name));
    if (item.isDirectory()) await walk(p);
    else if (/\.(?:mjs|cjs|js|ts|vue)$/.test(p)) files.push(p);
  }
}
for (const dir of ["frontend", "packages", "plugins", "ai-gateway"])
  await walk(dir);
for (const retired of [
  "frontend/app.js",
  "frontend/application/editor-application.js",
  "frontend/application/export-operations.mjs",
  "frontend/application/plugin-management.mjs",
])
  if (files.includes(retired))
    errors.push(`${retired}: 已迁入 L2 的业务入口不得在宿主重新实现`);
files.push(
  "desktop/main.cjs",
  "desktop/preload.cjs",
  "desktop/bridge-port.cjs",
  "desktop/profile-storage.cjs",
  "desktop/plugin-controller.cjs",
  "desktop/project-controller.cjs",
  "desktop/access-controller.cjs",
  "desktop/mcp-credentials.cjs",
);
for (const dir of ["packages", "plugins"])
  for (const name of await fs.readdir(path.join(root, dir))) {
    try {
      const folder = dir + "/" + name;
      manifests.set(
        folder,
        JSON.parse(
          await fs.readFile(path.join(root, folder, "package.json"), "utf8"),
        ),
      );
    } catch {}
  }
const rootManifest = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
for (const [folder, manifest] of manifests)
  errors.push(...targetDependencyErrors(folder, manifest));
const owner = (file) =>
  [...manifests.keys()].find((folder) => file.startsWith(folder + "/")) ||
  "$app";
const resolve = async (file, spec) => {
  const base = unix(
    path.relative(root, path.resolve(root, path.dirname(file), spec)),
  );
  for (const p of [
    base,
    ...[".mjs", ".js", ".ts", ".vue", "/index.mjs", "/index.ts"].map(
      (ext) => base + ext,
    ),
  ])
    try {
      if ((await fs.stat(path.join(root, p))).isFile()) return p;
    } catch {}
  return null;
};
const composition = new Set([
  "frontend/application/studio-plugins.ts",
  "ai-gateway/server.mjs",
  "ai-gateway/mcp-client.mjs",
  "desktop/main.cjs",
]);
for (const file of files) {
  let source = await fs.readFile(path.join(root, file), "utf8");
  if (file.endsWith(".vue"))
    source = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => m[1])
      .join("\n");
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = [];
  const visit = (node) => {
    const isKernelEntry =
      /(?:^@workflow\/kernel(?:\/|$)|(?:^|\/)kernel\/)/.test(
        node.moduleSpecifier?.text || "",
      );
    if (
      isKernelEntry &&
      owner(file) !== "packages/kernel" &&
      file !== "packages/plugin-runtime/index.mjs"
    ) {
      if (
        ts.isImportDeclaration(node) &&
        (node.importClause?.name ||
          (node.importClause?.namedBindings &&
            ts.isNamespaceImport(node.importClause.namedBindings)))
      )
        errors.push(
          `${file}: 内核只允许具名导入授权端口，不能通过默认或命名空间绕过接入边界`,
        );
      if (
        ts.isExportDeclaration(node) &&
        (!node.exportClause ||
          !ts.isNamedExports(node.exportClause) ||
          node.exportClause.elements.some(
            (e) => (e.propertyName || e.name).text === "PluginHost",
          ))
      )
        errors.push(`${file}: 不得向其他层重新导出内核管理入口`);
    }
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      for (const item of node.importClause.namedBindings.elements) {
        const imported = (item.propertyName || item.name).text;
        if (
          imported === "PluginHost" &&
          isKernelEntry &&
          file !== "packages/plugin-runtime/index.mjs"
        )
          errors.push(
            `${file}: 只有 L1 plugin-runtime 可取得 PluginHost，请通过统一接入入口登记插件`,
          );
        if (
          imported === "PluginRuntime" &&
          ![
            "frontend/application/studio-plugins.ts",
            "packages/native-host/http-server.mjs",
            "packages/plugin-testkit/index.mjs",
            "packages/plugin-testkit/sandbox-suite.mjs",
          ].includes(file)
        )
          errors.push(
            `${file}: 插件接入对象只交给组合根、原生宿主与开发测试包`,
          );
      }
    }
    if (
      owner(file) === "packages/kernel" &&
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "activate"
    )
      errors.push(
        `${file}: 内核不得解释公开 activate(context) 入口，由 L1 接入层适配`,
      );
    if (
      owner(file) === "packages/kernel" &&
      ts.isObjectLiteralExpression(node) &&
      node.properties.some((p) => p.name?.getText(ast) === "onDispose")
    )
      errors.push(`${file}: 内核不得重新构造插件 SDK 上下文`);
    if (
      file.startsWith("frontend/") &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "provide" &&
      node.expression.expression.getText(ast) === "host" &&
      [
        "workflow.editor",
        "workflow.presentation",
        "workflow.preview",
        "preview.targets",
        "preview.surfaces",
      ].includes(node.arguments[0]?.text)
    )
      errors.push(`${file}: 宿主不得重新提供已迁移到能力插件的业务 API`);
    if (
      owner(file) === "packages/kernel" &&
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["document", "window", "localStorage", "sessionStorage"].includes(
        node.expression.text,
      )
    )
      errors.push(`${file}: 内核访问 DOM/浏览器全局对象`);
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    )
      imports.push({
        specifier: node.moduleSpecifier.text,
        typeOnly:
          !!node.importClause?.isTypeOnly ||
          !!node.isTypeOnly ||
          !!(
            node.importClause?.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings) &&
            node.importClause.namedBindings.elements.length &&
            node.importClause.namedBindings.elements.every((e) => e.isTypeOnly)
          ),
      });
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      imports.push({ specifier: node.argument.literal.text, typeOnly: true });
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteralLike(arg))
        imports.push({ specifier: arg.text, typeOnly: false });
      else if (
        file === "desktop/main.cjs" &&
        arg?.getText(ast).startsWith("path.join(root,") &&
        ts.isCallExpression(arg) &&
        arg.arguments.slice(1).every(ts.isStringLiteralLike)
      ) {
        const target = arg.arguments
          .slice(1)
          .map((x) => x.text)
          .join("/");
        if (
          ![
            "plugins/mcp/self-test.cjs",
            "packages/native-host/stdio-client.cjs",
            "packages/native-host/plugin-repository.mjs",
            "packages/native-host/project-files.mjs",
            "packages/extension-host/electron-runner.cjs",
            "packages/extension-host/task-runner.cjs",
            "packages/native-host/extension-capabilities.mjs",
          ].includes(target)
        )
          errors.push(`${file}: 未登记的桌面动态入口 ${target}`);
        else imports.push({ specifier: "../" + target, typeOnly: false });
      } else if (
        file === "packages/extension-host/runner.mjs" &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        arg?.getText(ast) === "payload.entryUrl"
      ) {
        // 唯一外部入口在隔离进程内，平台将 URL 限定到已选择目录的快照。
      } else errors.push(`${file}: 禁止不可静态解析的动态模块入口`);
    }
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      ["eval", "Function"].includes(node.expression.text)
    )
      errors.push(`${file}: 禁止动态执行代码入口`);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  for (const item of imports) {
    const { specifier, typeOnly } = item,
      from = owner(file);
    let packageTarget;
    try {
      packageTarget = workspaceTarget(specifier, manifests);
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
      continue;
    }
    if (!specifier?.startsWith(".") && !packageTarget) {
      if (from === "packages/kernel" && (!typeOnly || specifier !== "vue"))
        errors.push(`${file}: 内核不得导入平台/外部实现 ${specifier}`);
      if (
        from.startsWith("plugins/") &&
        specifier !== "vue" &&
        !(
          manifests.get(from)?.studioNodeImports?.[
            "./" + file.slice(from.length + 1)
          ] || []
        ).includes(specifier)
      )
        errors.push(`${file}: 插件未授权外部依赖 ${specifier}`);
      if (
        specifier &&
        !specifier.startsWith("node:") &&
        specifier !== "electron"
      ) {
        const name = specifier.startsWith("@")
            ? specifier.split("/").slice(0, 2).join("/")
            : specifier.split("/")[0],
          manifest = manifests.get(from) || rootManifest;
        if (
          !manifest.dependencies?.[name] &&
          !manifest.peerDependencies?.[name] &&
          !manifest.devDependencies?.[name]
        )
          errors.push(`${file}: 包未声明依赖 ${name}`);
      }
      continue;
    }
    const target = packageTarget || (await resolve(file, specifier));
    if (!target) {
      errors.push(`${file}: 无法解析 ${specifier}`);
      continue;
    }
    const to = owner(target);
    edges.push({ from: file, to: target, typeOnly });
    errors.push(
      ...sourceBoundaryErrors(file, target, {
        from,
        to,
        typeOnly,
        composition: composition.has(file),
      }),
    );
    if (from !== to && manifests.has(to)) {
      const targetManifest = manifests.get(to),
        exported = new Set(
          Object.values(targetManifest.exports || {}).map((p) =>
            unix(path.join(to, p)),
          ),
        );
      if (!exported.has(target))
        errors.push(`${file}: 跨包访问非公开文件 ${target}`);
      const manifest = manifests.get(from) || rootManifest;
      if (
        !manifest.dependencies?.[targetManifest.name] &&
        !manifest.devDependencies?.[targetManifest.name]
      )
        errors.push(`${file}: 缺少包依赖 ${targetManifest.name}`);
      if (!typeOnly) {
        if (!packageEdges.has(from)) packageEdges.set(from, new Set());
        packageEdges.get(from).add(to);
      }
    }
  }
}
const visiting = new Set(),
  done = new Set();
function checkCycle(id) {
  if (visiting.has(id)) {
    errors.push("包依赖循环：" + [...visiting, id].join(" -> "));
    return;
  }
  if (done.has(id)) return;
  visiting.add(id);
  for (const next of packageEdges.get(id) || []) checkCycle(next);
  visiting.delete(id);
  done.add(id);
}
for (const id of packageEdges.keys()) checkCycle(id);
// 同一包内也不能隐藏逻辑模块环，类型引用不形成运行时依赖。
const fileEdges = new Map(files.map((file) => [file, []]));
for (const edge of edges)
  if (!edge.typeOnly) fileEdges.get(edge.from)?.push(edge.to);
const fileDone = new Set(),
  fileStack = [];
function fileCycle(file) {
  if (fileStack.includes(file)) {
    errors.push(
      "模块依赖循环：" +
        [...fileStack.slice(fileStack.indexOf(file)), file].join(" -> "),
    );
    return;
  }
  if (fileDone.has(file)) return;
  fileStack.push(file);
  for (const next of fileEdges.get(file) || []) fileCycle(next);
  fileStack.pop();
  fileDone.add(file);
}
for (const file of files) fileCycle(file);
await fs.mkdir(path.join(root, "build/verification"), { recursive: true });
await fs.writeFile(
  path.join(root, "build/verification/module-dependencies.json"),
  JSON.stringify(
    {
      files: files.length,
      edges,
      packages: Object.fromEntries(
        [...packageEdges].map(([key, value]) => [key, [...value]]),
      ),
      errors,
    },
    null,
    2,
  ),
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${files.length} 模块、${edges.length} 导入边、公开 exports、动态入口及包依赖无越界/循环`,
  );

import ts from "typescript";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const files = [];
async function collect(directory) {
  for (const entry of await fs.readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    if(entry.name==="node_modules")continue;
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(relative);
    else if (/\.(m?js|cjs)$/.test(entry.name))
      files.push(path.join(root, relative));
  }
}
for (const directory of ["frontend", "packages", "plugins", "ai-gateway"])
  await collect(directory);
const program = ts.createProgram(files, {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
});
const diagnostics = program
  .getSemanticDiagnostics()
  .filter((item) => [2304, 2552, 18004].includes(item.code));
if (diagnostics.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }),
  );
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${files.length} JavaScript modules have no unresolved identifiers`,
  );

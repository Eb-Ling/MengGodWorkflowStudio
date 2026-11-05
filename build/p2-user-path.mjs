// 实际 EXE 验收。只操作用户能点击的面板、键盘、文件下载，不注入文档或调用私有桥接。
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(import.meta.dirname, ".."),
  { version } = JSON.parse(
    await fs.readFile(path.join(root, "desktop/package.json"), "utf8"),
  );
const out = path.join(root, "build/verification/p2-user-path-" + Date.now());
await fs.mkdir(out, { recursive: true });
const profile = path.join(out, "profile"),
  errors = [];
let app, page;
async function launch() {
  app = await _electron.launch({
    executablePath: path.join(
      root,
      `release/MengGod-Workflow-Studio-${version}-win-x64/MengGod Workflow Studio.exe`,
    ),
    args: ["--user-data-dir=" + profile],
    acceptDownloads: true,
    timeout: 30000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector('body[data-ui-ready="true"]');
  console.log("EXE page:", page.url());
}
const node = () =>
  page.locator('.workflow-node[data-type="example.showcase.tint"]');
const entry = (id) => page.locator(`[data-plugin-id="${id}"]`);
async function toggle(id, enabled) {
  await entry(id)
    .getByRole("button", { name: new RegExp(enabled ? "启用" : "停用") })
    .click();
  await entry(id)
    .locator(".plugin-status")
    .filter({ hasText: enabled ? "已启用" : "已停用" })
    .waitFor();
}
try {
  await launch();
  await page.click("#workflow-manager");
  await page.locator("#example-create-both").waitFor();
  await page.click("#example-create-both");
  await page
    .locator("#example-status")
    .filter({ hasText: "已原子创建" })
    .waitFor();
  await page.click("#close-workflow-dialog");
  assert.equal(await node().count(), 1);
  await page.locator('a[data-stage="vertex"]').click();
  assert.equal(await node().count(), 1);
  await page.keyboard.press("Control+z");
  assert.equal(await node().count(), 0);
  await page.locator('a[data-stage="fragment"]').click();
  assert.equal(await node().count(), 0);
  await page.keyboard.press("Control+y");
  assert.equal(await node().count(), 1);
  await page.locator('a[data-stage="vertex"]').click();
  assert.equal(await node().count(), 1);
  await page.click("#workflow-manager");
  await page.screenshot({ path: path.join(out, "plugin-panel.png") });
  // 提供者停用会自动停用必需消费者，节点与连线保持在文档中。
  await toggle("example.layout", false);
  await entry("example.showcase")
    .locator(".plugin-status")
    .filter({ hasText: "已停用" })
    .waitFor();
  assert.equal(await page.locator("#example-create-both").count(), 0);
  await page.click("#close-workflow-dialog");
  await page.locator('a[data-stage="fragment"]').click();
  assert.equal(await node().count(), 1);
  assert.match(
    await page.locator("#compile-message").textContent(),
    /缺少节点插件|缺少节点编译器/,
  );
  await page.screenshot({ path: path.join(out, "missing-plugin.png") });
  await page.click("#workflow-manager");
  await toggle("example.showcase", true);
  await entry("example.layout")
    .locator(".plugin-status")
    .filter({ hasText: "已启用" })
    .waitFor();
  assert.equal(await page.locator("#example-create-both").count(), 1);
  await page.fill("#workflow-title", "v1.0 插件 API 实际导出");
  await page.fill("#plugin-class-name", "PluginApiEffect");
  await page.click("#save-current-workflow");
  assert.equal(
    await page
      .locator(".saved-workflow")
      .filter({ hasText: "v1.0 插件 API 实际导出" })
      .count(),
    1,
  );
  await page.click("#close-workflow-dialog");
  assert.equal(
    await page.locator(".compile-card .pill").textContent(),
    "可导出",
  );
  // 真正下载单文件运行依赖与三文件特效。
  await page.click("#export-runtime");
  await page.waitForSelector("#runtime-dependency-dialog[open]");
  let waiting = page.waitForEvent("download");
  await page.click("#export-runtime-source");
  await (await waiting).saveAs(path.join(out, "WorkflowRuntime.java"));
  waiting = page.waitForEvent("download");
  await page.click("#continue-effect-export");
  const zip = path.join(out, "PluginApiEffect.zip");
  await (await waiting).saveAs(zip);
  const directory = path.join(out, "PluginApiEffect");
  await promisify(execFile)(
    "pwsh",
    [
      "-NoProfile",
      "-File",
      path.join(root, "build/extract-user-export.ps1"),
      "-Zip",
      zip,
      "-Destination",
      directory,
    ],
    { windowsHide: true },
  );
  const files = [];
  async function walk(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const next = path.join(dir, item.name);
      if (item.isDirectory()) await walk(next);
      else files.push(next);
    }
  }
  await walk(directory);
  assert.equal(files.length, 3);
  const fragment = await fs.readFile(
    files.find((file) => file.endsWith(".frag")),
    "utf8",
  );
  assert.match(fragment, /vec4\(0\.200000, 0\.600000, 1\.000000, 1\.000000\)/);
  await app.close();
  app = null;
  await launch();
  // 草稿按窗口会话隔离，完整重启后从用户保存的项目列表打开。
  await page.click("#workflow-manager");
  await page
    .locator(".saved-workflow")
    .filter({ hasText: "v1.0 插件 API 实际导出" })
    .getByRole("button", { name: "打开", exact: true })
    .click();
  assert.equal(await node().count(), 1);
  assert.equal(
    await page.locator(".compile-card .pill").textContent(),
    "可导出",
  );
  await page.click("#workflow-manager");
  assert.equal(await page.locator("#example-create-both").count(), 1);
  await page.screenshot({ path: path.join(out, "restored-document.png") });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        version,
        route: "real EXE UI only",
        crossStageUndoRedo: true,
        cascadingDisable: true,
        missingNodePreservation: true,
        providerAutoActivation: true,
        restart: true,
        export: { zip, directory, files },
        errors,
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(root, "build/verification/latest-p2-user-path.txt"),
    out,
  );
  console.log(
    "PASS: 双阶段联合历史、提供者级联停用/恢复、缺失节点保留、真实插件节点三文件导出与重启\n" +
      out,
  );
} catch (error) {
  if (page)
    await page
      .screenshot({ path: path.join(out, "failure.png") })
      .catch(() => {});
  console.error("Evidence:", out);
  throw error;
} finally {
  await app?.close();
}

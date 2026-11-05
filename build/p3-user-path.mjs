// 实际 EXE 的用户操作：拖节点、连线、面板启停、文件选择和下载，不调用私有桥接或注入状态。
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(import.meta.dirname, ".."),
  out = path.join(root, "build/verification/p3-user-path-" + Date.now());
await fs.mkdir(out, { recursive: true });
const profile = path.join(out, "profile"),
  errors = [],
  downloads = [],
  previews = [];
let app, page;
async function launch() {
  app = await _electron.launch({
    executablePath: path.join(
      root,
      "release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe",
    ),
    args: ["--user-data-dir=" + profile],
    acceptDownloads: true,
    timeout: 30000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector('body[data-ui-ready="true"]');
}
const pause = () => page.waitForTimeout(100);
const field = (label) =>
  page
    .locator("#inspector-content .field")
    .filter({
      has: page
        .locator("label")
        .filter({ hasText: new RegExp("^" + label + "$") }),
    })
    .locator("input,select")
    .first();
async function change(label, value) {
  const control = field(label);
  if (await control.locator("option").count())
    await control.selectOption(value);
  else {
    await control.fill(value);
    await control.press("Tab");
  }
  await pause();
}
const node = (id) => page.locator(`.workflow-node[data-id="${id}"]`);
async function add(type, search, x, y, preview = false) {
  const count = await page.locator(".workflow-node").count();
  await page.fill("#node-search", search);
  const source = await page
      .locator(`.catalog-node[data-type="${type}"]`)
      .boundingBox(),
    canvas = await page.locator("#canvas-shell").boundingBox();
  assert.ok(source, type + " must be available");
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvas.x + x, canvas.y + y, { steps: 14 });
  await pause();
  await page.mouse.move(canvas.x + x + 1, canvas.y + y);
  await page.mouse.up();
  await pause();
  assert.equal(await page.locator(".workflow-node").count(), count + 1);
  const id = await page
    .locator(".workflow-node.selected")
    .getAttribute("data-id");
  const box = page
    .locator("#inspector-content")
    .getByRole("checkbox", { name: "输出预览" });
  if (await box.count()) await box.setChecked(preview);
  return id;
}
async function connect(a, s, b, t) {
  await page
    .locator(`.port.output[data-node-id="${a}"][data-socket="${s}"]`)
    .dragTo(
      page.locator(`.port.input[data-node-id="${b}"][data-socket="${t}"]`),
    );
  await pause();
}
async function toggle(enabled) {
  await page
    .locator('[data-plugin-id="studio.noise"]')
    .getByRole("button", {
      name: enabled ? "启用 Noise 噪声节点" : "停用 Noise 噪声节点",
      exact: true,
    })
    .click();
  await page
    .locator('[data-plugin-id="studio.noise"] .plugin-status')
    .filter({ hasText: enabled ? "已启用" : "已停用" })
    .waitFor();
}
async function exportEffect(name, first = false, vertexNoise = true) {
  await page.click("#workflow-manager");
  await page.fill("#plugin-class-name", name);
  await page.click("#save-current-workflow");
  await page.click("#close-workflow-dialog");
  assert.equal(
    await page.locator(".compile-card .pill").textContent(),
    "可导出",
    await page.locator("#compile-message").textContent(),
  );
  let download;
  if (first) {
    await page.click("#export-runtime");
    await page.waitForSelector("#runtime-dependency-dialog[open]");
    let waiting = page.waitForEvent("download");
    await page.click("#export-runtime-source");
    await (await waiting).saveAs(path.join(out, "WorkflowRuntime.java"));
    waiting = page.waitForEvent("download");
    await page.click("#continue-effect-export");
    download = await waiting;
  } else {
    const waiting = page.waitForEvent("download");
    await page.click("#export-runtime");
    download = await waiting;
  }
  const zip = path.join(out, name + ".zip"),
    directory = path.join(out, name);
  await download.saveAs(zip);
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
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else files.push(p);
    }
  }
  await walk(directory);
  assert.equal(files.length, 3);
  const vert = await fs.readFile(
      files.find((f) => f.endsWith(".vert")),
      "utf8",
    ),
    frag = await fs.readFile(
      files.find((f) => f.endsWith(".frag")),
      "utf8",
    );
  if (vertexNoise) assert.match(vert, /wf_ir_/);
  assert.match(frag, /wf_ir_/);
  downloads.push({ name, zip, directory, files });
}
try {
  await launch();
  await page.click("#workflow-manager");
  await page
    .locator('[data-plugin-id="studio.noise"] .plugin-status')
    .filter({ hasText: "已启用" })
    .waitFor();
  await page.fill("#workflow-title", "P3 Noise 用户建图");
  await page.fill("#plugin-class-name", "NoiseValue");
  await page.fill("#preview-canvas-width", "128");
  await page.fill("#preview-canvas-height", "128");
  await page.click("#create-workflow");
  await page.click("#close-workflow-dialog");
  const canvas = await page.locator("#canvas-shell").boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(canvas.x + 5, canvas.y + 5);
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + canvas.width - 5,
    canvas.y + canvas.height - 30,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await page.keyboard.press("Delete");
  assert.equal(await page.locator(".workflow-node").count(), 0);
  const uv = await add("input.uv", "UV", 20, 60),
    split = await add("studio.math.vector.split", "拆分", 20, 320);
  await change("类型变量", "VEC2");
  await connect(uv, "uv", split, "value");
  const color = await add("studio.math.vector.combine", "组合", 450, 50);
  await change("类型变量", "VEC4");
  const output = await add("io.output", "片段输出", 660, 60);
  await connect(color, "value", output, "color");
  await page.locator('a[data-stage="vertex"]').click();
  const vertexUv = await page
      .locator('.workflow-node[data-type="input.uv"]')
      .getAttribute("data-id"),
    vertexOutput = await page
      .locator('.workflow-node[data-type="vertex.output"]')
      .getAttribute("data-id");
  const vertexNoise = await add("studio.noise.value", "值噪声", 30, 330, true),
    vertexCombine = await add("studio.math.vector.combine", "组合", 280, 330);
  await change("类型变量", "VEC2");
  await connect(vertexUv, "uv", vertexNoise, "uv");
  await connect(vertexNoise, "value", vertexCombine, "x");
  await connect(vertexNoise, "value", vertexCombine, "y");
  await connect(vertexCombine, "value", vertexOutput, "uv");
  assert.match(
    await node(vertexNoise).locator("canvas").getAttribute("title"),
    /GPU 节点预览/,
  );
  await page.click("#vertex-settings");
  assert.match(
    await page.locator("#geometry-dialog output").textContent(),
    /WebGL2/,
  );
  await page.getByRole("button", { name: "关闭几何设置" }).click();
  await page.locator('a[data-stage="fragment"]').click();
  const types = [
    ["value", "值噪声"],
    ["fbm", "分形噪声"],
    ["simplex", "Simplex 噪声"],
    ["perlin", "柏林"],
    ["fbmSimplex", "Simplex 分形"],
    ["worley", "Worley 噪声"],
    ["fbmWorley", "Worley 分形"],
    ["turbulence", "湍流"],
    ["turbulize", "湍流化"],
    ["turbulence3", "3D"],
  ];
  let current;
  for (const [index, [suffix, search]] of types.entries()) {
    if (current) {
      await node(current).locator("header").click();
      await page.keyboard.press("Delete");
    }
    current = await add("studio.noise." + suffix, search, 230, 60, true);
    if (suffix === "turbulence3") {
      await connect(split, "x", current, "x");
      await connect(split, "y", current, "y");
    } else if (suffix === "turbulize")
      await connect(split, "x", current, "noise");
    else await connect(uv, "uv", current, "uv");
    for (const channel of ["x", "y", "z", "w"])
      await connect(current, "value", color, channel);
    assert.match(
      await node(current).locator("canvas").getAttribute("title"),
      /GPU 节点预览/,
    );
    previews.push(suffix);
    await page.screenshot({
      path: path.join(out, "preview-" + suffix + ".png"),
    });
    await exportEffect(
      "Noise" + suffix[0].toUpperCase() + suffix.slice(1),
      index === 0,
    );
  }
  const count = await page.locator(".workflow-node").count();
  const links = await page.locator("#wire-layer .wire:not(.pending)").count();
  await page.click("#workflow-manager");
  await toggle(false);
  await page.click("#close-workflow-dialog");
  assert.doesNotMatch(await page.locator('#footer-message').textContent(), /刷新或草稿保存失败/);
  assert.equal(await page.locator(".workflow-node").count(), count);
  assert.equal(await page.locator("#wire-layer .wire:not(.pending)").count(), links);
  assert.match(
    await page.locator("#compile-message").textContent(),
    /缺少节点插件/,
  );
  await page.fill("#node-search", "噪声");
  assert.equal(
    await page.locator('.catalog-node[data-type^="studio.noise."]').count(),
    0,
  );
  await page.click("#workflow-manager");
  await page.click("#open-instance-example");
  assert.equal(
    await page.locator(".compile-card .pill").textContent(),
    "可导出",
    "Unrelated workflow must remain usable",
  );
  await page.click("#workflow-manager");
  await page
    .locator(".saved-workflow")
    .filter({ hasText: "P3 Noise 用户建图" })
    .getByRole("button", { name: "打开", exact: true })
    .click();
  assert.equal(await page.locator(".workflow-node").count(), count);
  assert.match(
    await page.locator("#compile-message").textContent(),
    /缺少节点插件/,
  );
  await app.close();
  app = null;
  await launch();
  await page.click("#workflow-manager");
  await page
    .locator('[data-plugin-id="studio.noise"] .plugin-status')
    .filter({ hasText: "已停用" })
    .waitFor();
  await page
    .locator(".saved-workflow")
    .filter({ hasText: "P3 Noise 用户建图" })
    .getByRole("button", { name: "打开", exact: true })
    .click();
  assert.match(
    await page.locator("#compile-message").textContent(),
    /缺少节点插件/,
  );
  await page.click("#workflow-manager");
  await toggle(true);
  await page.click("#close-workflow-dialog");
  assert.equal(
    await page.locator(".compile-card .pill").textContent(),
    "可导出",
  );
  assert.equal(await page.locator(".workflow-node").count(), count);
  await page.screenshot({ path: path.join(out, "restored.png") });
  // 内置示例直接使用当前 studio.noise.*，从用户可见入口加载。
  await page.click("#workflow-manager");
  await page.locator("[data-open-example]").click();
  await page.click("#close-workflow-dialog");
  assert.ok(
    await page.locator('.workflow-node[data-type^="studio.noise."]').count(),
  );
  assert.equal(
    await page.locator(".compile-card .pill").textContent(),
    "可导出",
    await page.locator("#compile-message").textContent(),
  );
  await exportEffect("BuiltinNoiseEffect", false, false);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        version: "1.0.0",
        route: "real EXE UI only",
        previews,
        downloads,
        disabledPreservesDocument: true,
        unrelatedWorkflow: true,
        restartDisabled: true,
        builtinExample: true,
        errors,
      },
      null,
      2,
    ),
  );
  await fs.writeFile("build/verification/latest-p3-user-path.txt", out);
  console.log(
    "PASS: 10 Noise UI previews/exports, both stages, disable/re-enable/restart and built-in example export\n" +
      out,
  );
} catch (error) {
  console.error("Compile:", await page?.locator("#compile-message").textContent().catch(() => "unavailable"));
  await page
    ?.screenshot({ path: path.join(out, "failure.png") })
    .catch(() => {});
  console.error("Evidence:", out);
  throw error;
} finally {
  await app?.close();
}

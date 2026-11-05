// 真实 UI 回归复用的拖拽/表单/下载动作，无私有 API 调用。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export function userActions(page,root,out,downloads=[]) {
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
async function toggle(id, enabled) {
  await page
    .locator(`[data-plugin-id="${id}"]`)
    .getByRole("button", {
      name: new RegExp("^" + (enabled ? "启用 " : "停用 ")),
      exact: true,
    })
    .click();
  await page
    .locator(`[data-plugin-id="${id}"] .plugin-status`)
    .filter({ hasText: enabled ? "已启用" : "已停用" })
    .waitFor();
}
async function exportEffect(name, first = false) {
  await page.click("#workflow-manager");
  await page.fill("#plugin-class-name", name);
  await page.click("#save-current-workflow");
  await page.click("#close-workflow-dialog");
  await page.locator('.compile-card .pill').filter({hasText:/^可导出$/}).waitFor();
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
  assert.ok(vert.startsWith("#version 430"));
  assert.ok(frag.startsWith("#version 430"));
  downloads.push({ name, zip, directory, files });
}

return {add,connect,change,toggle,exportEffect};
}

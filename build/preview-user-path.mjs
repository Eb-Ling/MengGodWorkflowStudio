// 真正桌面 EXE 的可见操作，读取 DOM 显示值、下载文件，不调用隐藏工作流 API。
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { userActions } from "./plugin-user-actions.mjs";
const { _electron } = createRequire(import.meta.url)("playwright"),
  root = path.resolve(import.meta.dirname, "..");
export async function previewUserPath() {
  const out = path.join(root, "build/verification/preview-user-" + Date.now());
  await fs.mkdir(out, { recursive: true });
  const app = await _electron.launch({
    executablePath: path.join(
      root,
      "release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe",
    ),
    args: ["--user-data-dir=" + out + "/profile"],
    acceptDownloads: true,
  });
  const page = await app.firstWindow(),
    errors = [],
    downloads = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  const actions = userActions(page, root, out, downloads),
    viewer = page.locator("#gpu-preview-viewer");
  async function open(id) {
    await page
      .locator(`.workflow-node[data-id="${id}"] header`)
      .click({ button: "right" });
    await page.locator('[data-action="open-preview"]').click();
    await viewer.locator("img").waitFor();
  }
  async function frame(width, height, name) {
    await viewer.locator(`img[width="${width}"][height="${height}"]`).waitFor();
    const data = Buffer.from(
      (await viewer.locator("img").getAttribute("src")).split(",")[1],
      "base64",
    );
    assert.equal(data.readUInt32BE(16), width);
    assert.equal(data.readUInt32BE(20), height);
    if (name) await fs.writeFile(path.join(out, name + ".png"), data);
  }
  try {
    await page.waitForSelector('body[data-ui-ready="true"]');
    await open("uv_start");
    await frame(2048, 2048, "2048");
    await viewer.locator('[data-resolution="4096"]').click();
    await frame(4096, 4096, "4096");
    await viewer.locator('[data-preview-action="actual"]').click();
    assert.equal(await viewer.locator(".preview-scale").innerText(), "100%");
    const before = await viewer.locator("img").getAttribute("style"),
      rect = await viewer.locator(".preview-viewport").boundingBox();
    await page.mouse.move(rect.x + 150, rect.y + 150);
    await page.mouse.down();
    await page.mouse.move(rect.x + 215, rect.y + 190, { steps: 8 });
    await page.mouse.up();
    assert.notEqual(await viewer.locator("img").getAttribute("style"), before);
    await page.mouse.wheel(0, -150);
    await page.waitForTimeout(100);
    assert.notEqual(await viewer.locator(".preview-scale").innerText(), "100%");
    await viewer.locator('[data-preview-action="fit"]').click();
    await page.screenshot({ path: path.join(out, "viewer.png") });
    await page.keyboard.press("Escape");
    await page.click("#workflow-manager");
    await page.fill("#preview-canvas-width", "1024");
    await page.fill("#preview-canvas-height", "512");
    await page.click("#save-current-workflow");
    await page.click("#close-workflow-dialog");
    await open("uv_start");
    await frame(2048, 1024, "landscape");
    await page.keyboard.press("Escape");
    await page.click("#workflow-manager");
    assert.equal(
      await page.locator("#preview-canvas-width").inputValue(),
      "1024",
    );
    assert.equal(
      await page.locator("#preview-canvas-height").inputValue(),
      "512",
    );
    await page.click("#close-workflow-dialog");
    const positions = async () =>
      Promise.all(
        (await page.locator(".workflow-node").all()).map(async (n) => ({
          id: await n.getAttribute("data-id"),
          style: await n.getAttribute("style"),
        })),
      );
    const old = await positions();
    await page.click("#auto-layout");
    assert.notEqual(JSON.stringify(await positions()), JSON.stringify(old));
    await page.keyboard.press("Control+z");
    assert.equal(JSON.stringify(await positions()), JSON.stringify(old));
    const a = await page
        .locator('.workflow-node[data-id="uv_start"]')
        .boundingBox(),
      b = await page
        .locator('.workflow-node[data-id="center_start"]')
        .boundingBox();
    await page.keyboard.down("Shift");
    await page.mouse.move(Math.min(a.x, b.x) - 8, Math.min(a.y, b.y) - 8);
    await page.mouse.down();
    await page.mouse.move(
      Math.max(a.x + a.width, b.x + b.width) + 8,
      Math.max(a.y + a.height, b.y + b.height) + 8,
      { steps: 12 },
    );
    await page.mouse.up();
    await page.keyboard.up("Shift");
    assert.equal(await page.locator(".workflow-node.selected").count(), 2);
    await page
      .locator('.workflow-node[data-id="uv_start"] header')
      .click({ button: "right" });
    await page.locator('[data-action="save-workflow-node"]').click();
    await page.fill("#workflow-node-save-title", "P4 可复用模板");
    await page.click("#confirm-workflow-node-save");
    const template = page
      .locator(".workflow-catalog-node")
      .filter({ hasText: "P4 可复用模板" });
    await template.waitFor();
    const canvas = await page.locator("#canvas-shell").boundingBox();
    await template.dragTo(page.locator("#canvas-shell"), {
      targetPosition: { x: 100, y: Math.min(440, canvas.height - 30) },
    });
    assert.equal(await page.locator(".workflow-node").count(), 5);
    await page.keyboard.press("Control+z");
    assert.equal(await page.locator(".workflow-node").count(), 3);
    for (let i = 0; i < 3; i++) {
      await page.click("#workflow-manager");
      await actions.toggle("studio.preview", false);
      await page.click("#close-workflow-dialog");
      assert.equal(await viewer.count(), 0);
      await page
        .locator('.workflow-node[data-id="uv_start"] header')
        .click({ button: "right" });
      await page.locator('[data-action="open-preview"]').click();
      await page
        .locator("#footer-message")
        .filter({ hasText: /缺少|未启用/ })
        .waitFor();
      await page.click("#workflow-manager");
      await actions.toggle("studio.preview", true);
      await page.click("#close-workflow-dialog");
      await open("uv_start");
      await frame(2048, 1024);
      assert.equal(await viewer.count(), 1);
      await page.keyboard.press("Escape");
    }
    await page.click("#workflow-manager");
    await actions.toggle("studio.layout", false);
    await actions.toggle("studio.templates", false);
    await page.click("#close-workflow-dialog");
    assert.equal(await page.locator("#auto-layout").isDisabled(), true);
    assert.equal(await page.locator(".workflow-catalog-node").count(), 0);
    assert.equal(await page.locator(".workflow-node").count(), 3);
    await open("uv_start");
    await page.keyboard.press("Escape");
    await page.click("#workflow-manager");
    await actions.toggle("studio.layout", true);
    await actions.toggle("studio.templates", true);
    await actions.toggle("studio.starsector", false);
    await page.click("#close-workflow-dialog");
    assert.equal(await template.count(), 1);
    await open("uv_start");
    await page.keyboard.press("Escape");
    await page.click("#workflow-manager");
    await actions.toggle("studio.starsector", true);
    await page.click("#open-instance-example");
    await page.locator('a[data-stage="vertex"]').click();
    await page.click("#vertex-settings");
    await page
      .locator("#geometry-dialog output")
      .filter({ hasText: /WebGL2/ })
      .waitFor();
    await page.locator("#geometry-dialog canvas").click({ button: "right" });
    await frame(2048, 731, "geometry");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#geometry-dialog[open]").count(), 1);
    await page.getByRole("button", { name: "关闭几何设置" }).click();
    const first = await page
      .locator('.workflow-node[data-type="input.uv"]')
      .first()
      .getAttribute("data-id");
    await open(first);
    await frame(2048, 2048, "vertex");
    await page.keyboard.press("Escape");
    await actions.exportEffect("PreviewP4Effect", true);
    assert.equal(downloads.length, 1);
    assert.equal(errors.length, 0, errors.join("\n"));
    await fs.writeFile(
      path.join(out, "report.json"),
      JSON.stringify(
        {
          ok: true,
          route: "desktop UI only",
          downloads,
          checks: [
            "node and geometry HD",
            "4096 PNG header",
            "1:1/pan/wheel/fit",
            "aspect ratio/project unchanged",
            "vertex preview",
            "layout one undo",
            "template save/expand/undo",
            "three preview lifecycle cycles",
            "independent export/preview/templates/layout",
            "three-file download",
          ],
          errors,
        },
        null,
        2,
      ),
    );
    return { app, page, out };
  } catch (e) {
    await fs
      .writeFile(
        path.join(out, "failure.json"),
        JSON.stringify(
          {
            error: e.stack,
            errors,
            status: await page.locator("#geometry-dialog output").textContent(),
          },
          null,
          2,
        ),
      )
      .catch(() => {});
    await page
      .screenshot({ path: path.join(out, "failure.png") })
      .catch(() => {});
    await app.close();
    throw e;
  }
}

// 桌面路线：仅点击可见面板、表单和画布，不调用隐藏 Store / evaluate / MCP。
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { userActions } from "./plugin-user-actions.mjs";
const { _electron } = createRequire(import.meta.url)("playwright"),
  root = path.resolve(import.meta.dirname, "..");
export async function p5UserPath() {
  const out = path.join(root, "build/verification/p5-ui-user-" + Date.now());
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
    warnings = [],
    downloads = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "warning" && m.text().includes("[Vue warn]"))
      warnings.push(m.text());
  });
  page.setDefaultTimeout(15000);
  const actions = userActions(page, root, out, downloads),
    count = () => page.locator(".workflow-node").count(),
    pause = () => page.waitForTimeout(150);
  try {
    await page.waitForSelector('body[data-ui-ready="true"]');
    const uv = page.locator('.workflow-node[data-id="uv_start"]'),
      old = await uv.getAttribute("style"),
      box = await uv.locator("header").boundingBox();
    await page.mouse.move(box.x + 40, box.y + 16);
    await page.mouse.down();
    await page.mouse.move(box.x + 110, box.y + 71, { steps: 12 });
    await page.mouse.up();
    await pause();
    const moved = await uv.getAttribute("style");
    assert.notEqual(moved, old);
    await page.keyboard.press("Control+z");
    await pause();
    assert.equal(await uv.getAttribute("style"), old);
    await page.keyboard.press("Control+y");
    await pause();
    assert.equal(await uv.getAttribute("style"), moved);
    await page.click("#workflow-manager");
    await page.click("#example-create-both");
    await page
      .locator("#example-status")
      .filter({ hasText: /已原子/ })
      .waitFor();
    await page.click("#example-toggle-view");
    await page.click("#close-workflow-dialog");
    await page.locator(".custom-tint-card").waitFor();
    await page.click("#auto-layout");
    await pause();
    const tint = page.locator(".custom-tint-card").first();
    await tint.locator("header").click();
    const red = page
      .locator(".custom-tint-field")
      .filter({ has: page.locator("label").filter({ hasText: /^red$/ }) })
      .locator("input")
      .first();
    assert.equal(await page.locator(".custom-tint-field").count(), 4);
    assert.equal(await red.inputValue(), "0.2");
    await red.fill("0.75");
    await red.press("Tab");
    await pause();
    assert.equal(await red.inputValue(), "0.75");
    await tint.locator("header").click();
    await page.keyboard.press("Control+z");
    await pause();
    assert.equal(await red.inputValue(), "0.2");
    await red.fill("0.75");
    await red.press("Tab");
    await page.screenshot({ path: path.join(out, "custom-node-fields.png") });
    await page.locator('a[data-stage="vertex"]').click();
    await page.locator(".custom-tint-card").first().locator("header").click();
    assert.equal(
      await red.inputValue(),
      "0.2",
      "顶点与片段字段实例不得共享草稿",
    );
    await page.locator('a[data-stage="fragment"]').click();
    await page.locator(".custom-tint-card").first().locator("header").click();
    assert.equal(await red.inputValue(), "0.75");
    const preserved = await count();
    for (let i = 0; i < 3; i++) {
      await page.click("#workflow-manager");
      await page.click("#example-toggle-view");
      await page.click("#close-workflow-dialog");
      assert.equal(await page.locator(".custom-tint-card").count(), 0);
      assert.equal(await count(), preserved);
      await page.click("#workflow-manager");
      await page.click("#example-toggle-view");
      await actions.toggle("studio.workflow-ui", false);
      await page.click("#close-workflow-dialog");
      assert.equal(await count(), 0);
      await page
        .locator("#canvas-shell")
        .filter({ hasText: /工作流视图插件已停用/ })
        .waitFor();
      await page.click("#workflow-manager");
      await actions.toggle("studio.workflow-ui", true);
      await page.click("#close-workflow-dialog");
      await page.locator(".custom-tint-card").waitFor();
      assert.equal(await count(), preserved);
    }
    await page.locator(".custom-tint-card").first().locator("header").click();
    assert.equal(await red.inputValue(), "0.75");
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    await pause();
    assert.equal(await count(), preserved + 1);
    await page.keyboard.press("Control+z");
    await pause();
    assert.equal(await count(), preserved, "三轮启停后不得残留重复键盘监听器");
    const activeTint = page.locator(".custom-tint-card").first();
    await activeTint.locator("header").click({ button: "right" });
    await page.keyboard.press("End");
    assert.equal(
      await page
        .locator("#node-context-menu :focus")
        .getAttribute("data-action"),
      "delete",
    );
    await page.keyboard.press("Home");
    assert.equal(
      await page
        .locator("#node-context-menu :focus")
        .getAttribute("data-action"),
      "copy",
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#node-context-menu").isVisible(), false);
    await page.locator('a[data-stage="vertex"]').click();
    await page.click("#vertex-settings");
    await page
      .locator("#geometry-dialog output")
      .filter({ hasText: /WebGL2/ })
      .waitFor();
    await page.getByRole("button", { name: "关闭几何设置" }).click();
    await page.click("#workflow-manager");
    await actions.toggle("studio.geometry-ui", false);
    await page.click("#close-workflow-dialog");
    assert.equal(await page.locator("#vertex-settings").count(), 0);
    assert.ok((await count()) > 0);
    await page.click("#workflow-manager");
    await actions.toggle("studio.geometry-ui", true);
    await actions.toggle("studio.starsector", false);
    await page.click("#close-workflow-dialog");
    await page.click("#vertex-settings");
    await page
      .locator("#geometry-dialog pre")
      .filter({ hasText: /导出说明不可用/ })
      .waitFor();
    await page
      .locator("#geometry-dialog output")
      .filter({ hasText: /WebGL2/ })
      .waitFor();
    await page.getByRole("button", { name: "关闭几何设置" }).click();
    await page.click("#workflow-manager");
    await actions.toggle("studio.starsector", true);
    await page.click("#close-workflow-dialog");
    await actions.exportEffect("P5CustomUiEffect", true);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    await fs.writeFile(
      path.join(out, "report.json"),
      JSON.stringify(
        {
          ok: true,
          route: "desktop UI only",
          checks: [
            "drag one undo/redo",
            "public custom node and field renderer",
            "field edit/undo",
            "per-stage local field state",
            "renderer restore",
            "three workflow UI lifecycle cycles",
            "independent geometry UI lifecycle",
            "export plugin disabled: geometry preview still works",
            "three-file UI export",
          ],
          errors,
          warnings,
          downloads,
        },
        null,
        2,
      ),
    );
    return { app, page, out };
  } catch (error) {
    await fs.writeFile(
      path.join(out, "failure.json"),
      JSON.stringify({ error: error.stack, errors, warnings }, null, 2),
    );
    await page
      .screenshot({ path: path.join(out, "failure.png") })
      .catch(() => {});
    await app.close();
    throw error;
  }
}

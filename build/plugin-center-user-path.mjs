// 独立桌面验收：只通过可见控件、键盘、窗口尺寸和下载操作，不注入登记或工作流。
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { userActions } from "./plugin-user-actions.mjs";
const { _electron } = createRequire(import.meta.url)("playwright");
const root = path.resolve(import.meta.dirname, "..");
export async function pluginCenterPath(
  releaseFolder = "MengGod-Workflow-Studio-1.0.0-win-x64-candidate",
) {
  const out = path.join(
    root,
    "build/verification/plugin-center-user-" + Date.now(),
  );
  await fs.mkdir(out, { recursive: true });
  const errors = [],
    warnings = [],
    downloads = [];
  const executablePath = path.join(
    root,
    "release",
    releaseFolder,
    "MengGod Workflow Studio.exe",
  );
  let app, page;
  async function launch() {
    app = await _electron.launch({
      executablePath,
      args: ["--user-data-dir=" + path.join(out, "profile")],
      acceptDownloads: true,
    });
    page = await app.firstWindow();
    page.setDefaultTimeout(12000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "warning" && m.text().includes("[Vue warn]"))
        warnings.push(m.text());
    });
    await page.waitForSelector('body[data-ui-ready="true"]');
    await page.locator(".workflow-node").first().waitFor();
  }
  const card = (id) => page.locator('[data-plugin-id="' + id + '"]');
  const section = (name) =>
    page.getByRole("tab", { name, exact: true }).click();
  async function enable(id) {
    await card(id)
      .getByRole("button", { name: /^启用 / })
      .click();
    await card(id)
      .getByRole("button", { name: /^停用 / })
      .waitFor();
  }
  async function disable(id) {
    await card(id)
      .getByRole("button", { name: /^停用 / })
      .click();
    if (await page.locator("#plugin-impact-dialog[open]").count())
      await page.click("#plugin-impact-confirm");
    await card(id)
      .getByRole("button", { name: /^启用 / })
      .waitFor();
  }
  try {
    await launch();
    assert.equal(await page.getByRole("button", {name: "工作流节点", exact: true}).count(), 0);
    assert.equal(
      await page.locator('[data-type="example.showcase.tint"]').count(),
      0,
    );
    const noise = page.getByRole("button", { name: "噪声", exact: true });
    await noise.focus();
    await page.keyboard.press("Space");
    assert.equal(await noise.getAttribute("aria-expanded"), "false");
    await page.keyboard.press("Enter");
    assert.equal(await noise.getAttribute("aria-expanded"), "true");
    await page.screenshot({ path: path.join(out, "node-headings.png") });
    async function dropTemplate(y = 100) {
      await page
        .locator('[data-workflow-node-id="preset.horizontalFade"]')
        .scrollIntoViewIfNeeded();
      const source = await page
          .locator('[data-workflow-node-id="preset.horizontalFade"]')
          .boundingBox(),
        canvas = await page.locator("#canvas-shell").boundingBox();
      await page.mouse.move(
        source.x + source.width / 2,
        source.y + source.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(canvas.x + 100, canvas.y + y, { steps: 16 });
      await page.waitForTimeout(120);
      await page.mouse.move(canvas.x + 101, canvas.y + y);
      await page.mouse.up();
      await page.waitForTimeout(150);
    }
    await dropTemplate();
    // 默认顶点图已有 uv，与手动新建一样，片段模板从 uv_2 开始。
    await page.locator('.workflow-node[data-id="uv_2"]').waitFor();
    await dropTemplate(350);
    await page.locator('.workflow-node[data-id="uv_3"]').waitFor();
    await page.locator('.workflow-node[data-id="uv_2"] header').click();
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    await page.locator('.workflow-node[data-id="uv_4"]').waitFor();
    await page.screenshot({
      path: path.join(out, "readable-template-ids.png"),
    });
    for (let n = 0; n < 3; n++) {
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(120);
    }
    assert.equal(await page.locator(".workflow-node").count(), 3);
    const actions = userActions(page, root, out, downloads);
    assert.equal(await actions.add("io.input", "输入", 100, 80), "input");
    assert.equal(await actions.add("io.input", "输入", 420, 80), "input_2");
    await page.locator("#canvas-shell").click({ position: { x: 10, y: 10 } });
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await page.fill("#node-search", "");
    await page.click("#workflow-manager");
    assert.equal(
      await page.locator("#workflow-dialog .plugin-settings").count(),
      0,
    );
    assert.equal(
      await page.locator("#workflow-dialog #bridge-check").count(),
      0,
    );
    await page.locator("#workflow-title").waitFor();
    await page.screenshot({ path: path.join(out, "workflow-only.png") });
    await page.click("#close-workflow-dialog");
    await page.click("#plugin-center-open");
    assert.equal(await card("example.showcase").count(), 0);
    await page.screenshot({ path: path.join(out, "plugin-center.png") });
    await section("开发者示例");
    await card("example.showcase")
      .getByRole("button", { name: /^启用 / })
      .waitFor();
    await card("example.layout")
      .getByRole("button", { name: /^启用 / })
      .waitFor();
    assert.equal(await page.locator("#example-create-both").count(), 0);
    await enable("example.showcase");
    await card("example.layout")
      .getByRole("button", { name: /^停用 / })
      .waitFor();
    await page.locator("#example-create-both").waitFor();
    await card("example.layout")
      .getByRole("button", { name: /^停用 / })
      .click();
    await page.locator("#plugin-impact-dialog[open]").waitFor();
    assert.match(
      await page.locator("#plugin-impact-dialog").innerText(),
      /双阶段事务与节点/,
    );
    await page.screenshot({ path: path.join(out, "disable-warning.png") });
    await page.click("#plugin-impact-cancel");
    await card("example.showcase")
      .getByRole("button", { name: /^停用 / })
      .waitFor();
    await card("example.layout")
      .getByRole("button", { name: /^停用 / })
      .click();
    await page.keyboard.press("Escape");
    await card("example.showcase")
      .getByRole("button", { name: /^停用 / })
      .waitFor();
    await disable("example.layout");
    await card("example.showcase")
      .getByRole("button", { name: /^启用 / })
      .waitFor();
    await enable("example.showcase");
    await page.click("#example-create-both");
    await page
      .getByText("已原子创建两个阶段的节点，可一次撤销。", { exact: true })
      .waitFor();
    await page.click("#example-undo");
    await page
      .getByText("已撤销当前阶段最近操作，联合事务同时恢复两个阶段。", {
        exact: true,
      })
      .waitFor();
    await app.close();
    await launch();
    assert.equal(
      await page.locator('[data-type="example.showcase.tint"]').count(),
      1,
    );
    await page.click("#plugin-center-open");
    await section("开发者示例");
    await disable("example.layout");
    await page.click("#close-plugin-center");
    assert.equal(
      await page.locator('[data-type="example.showcase.tint"]').count(),
      0,
    );
    await page.click("#plugin-center-open");
    await section("插件设置");
    await page.getByRole("button", { name: "展开插件配置 MCP 工作流接入", exact: true }).click();
    await page.click("#bridge-check");
    await page
      .locator("#bridge-status")
      .filter({ hasText: "已激活" })
      .waitFor();
    await page.click("#bridge-self-test");
    await page
      .locator("#bridge-status")
      .filter({ hasText: "MCP 本机自检通过" })
      .waitFor();
    await page.click("#bridge-copy-prompt");
    await page.locator("#bridge-prompt").waitFor();
    const sizes = [];
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1024, height: 700 },
      { width: 800, height: 600 },
    ]) {
      await page.setViewportSize(size);
      await page.locator("#bridge-check").scrollIntoViewIfNeeded();
      const panel = await page
        .locator(".ui-panel")
        .filter({ has: page.locator("#bridge-check") })
        .boundingBox();
      for (const id of [
        "bridge-check",
        "bridge-self-test",
        "bridge-copy-prompt",
      ]) {
        const b = await page.locator("#" + id).boundingBox();
        assert.ok(
          b.x >= panel.x - 1 && b.x + b.width <= panel.x + panel.width + 1,
          id + " must stay inside panel",
        );
      }
      await page.screenshot({
        path: path.join(out, "mcp-" + size.width + ".png"),
      });
      sizes.push(size);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await section("插件管理");
    await card("studio.glsl")
      .getByRole("button", { name: /^停用 / })
      .click();
    await page.locator("#plugin-impact-dialog[open]").waitFor();
    assert.match(
      await page.locator("#plugin-impact-dialog").innerText(),
      /Starsector 特效导出/,
    );
    await page.click("#plugin-impact-cancel");
    await card("studio.glsl")
      .getByRole("button", { name: /^停用 / })
      .waitFor();
    await disable("studio.glsl");
    await card("studio.starsector")
      .getByRole("button", { name: /^启用 / })
      .waitFor();
    await enable("studio.starsector");
    await enable("studio.preview");
    await card("studio.ui")
      .getByRole("button", { name: /^停用 / })
      .click();
    await page.locator("#plugin-impact-dialog[open]").waitFor();
    await page.click("#plugin-impact-confirm");
    await page.locator("#restore-core-ui").waitFor();
    await page.click("#restore-core-ui");
    await page.locator(".workflow-node").first().waitFor();
    await page.click("#workflow-manager");
    await page.click("#open-instance-example");
    await userActions(page, root, out, downloads).exportEffect(
      "P63Effect",
      true,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    await fs.writeFile(
      path.join(out, "report.json"),
      JSON.stringify(
        {
          ok: true,
          route: "desktop only; visible UI and actual downloads",
          checks: [
            "workflow dialog contains only project settings",
            "independent plugin center and development grouping",
            "default examples off; explicit enable survives restart",
            "keyboard category heading collapse/expand",
            "readable IDs for repeated template insertion, copy/paste and new input nodes; one undo per insertion",
            "cancel/Escape changes nothing; confirmation cascades dependents",
            "joint example transaction and undo",
            "MCP activation/self-test/config and three viewport sizes",
            "compiler stop/recovery",
            "base UI stop/recovery",
            "actual runtime and three-file effect",
          ],
          sizes,
          downloads,
          dependencies: [path.join(out, "WorkflowRuntime.java")],
          errors,
          warnings,
        },
        null,
        2,
      ),
    );
    return { out, app, page };
  } catch (error) {
    await page
      ?.screenshot({ path: path.join(out, "failure.png") })
      .catch(() => {});
    await fs.writeFile(
      path.join(out, "failure.json"),
      JSON.stringify({ error: String(error), errors, warnings }, null, 2),
    );
    await app?.close();
    throw error;
  }
}

// 实际 EXE 的纯桌面路径。所有项目修改、启停与下载只经过可见 UI。
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { userActions } from "./plugin-user-actions.mjs";
import { customCompilerPath } from "./compiler-custom-user-path.mjs";
const { _electron } = createRequire(import.meta.url)("playwright");
const root = path.resolve(import.meta.dirname, "..");

/** 返回保留打开的测试窗口，调用方可随后通过可见面板准备独立 MCP 阶段。 */
export async function desktopExportPath() {
  const out = path.join(
      root,
      "build/verification/export-plugin-user-" + Date.now(),
    ),
    downloads = [],
    errors = [];
  await fs.mkdir(out, { recursive: true });
  let app, page, actions;
  async function launch() {
    app = await _electron.launch({
      executablePath: path.join(
        root,
        "release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe",
      ),
      args: ["--user-data-dir=" + out + "/profile"],
      acceptDownloads: true,
      timeout: 20000,
    });
    page = await app.firstWindow();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForSelector('body[data-ui-ready="true"]');
    actions = userActions(page, root, out, downloads);
  }
  try {
    await launch();
    await page.click("#workflow-manager");
    await page.click("#open-instance-example");
    await actions.exportEffect("ExportBaseline", true);
    await page.click("#workflow-manager");
    await actions.toggle("studio.starsector", false);
    await page.click("#close-workflow-dialog");
    assert.match(
      await page.locator("#compile-message").textContent(),
      /未启用/,
    );
    await page.click("#export-runtime");
    assert.equal(
      await page.locator("#runtime-dependency-dialog[open]").count(),
      0,
    );
    await page.locator('a[data-stage="vertex"]').click();
    await page.click("#vertex-settings");
    assert.match(
      await page.locator(".constructor-signature").textContent(),
      /不可用/,
    );
    await page.fill("#geometry-sx", "1.4");
    await page.locator("#geometry-sx").press("Tab");
    await page.fill("#preview-time", "1");
    await page.locator("#preview-time").press("Tab");
    assert.match(
      await page.locator("#geometry-dialog output").textContent(),
      /WebGL2/,
    );
    await page
      .locator("#geometry-dialog canvas")
      .screenshot({ path: path.join(out, "disabled-preview.png") });
    await page.getByRole("button", { name: "关闭几何设置" }).click();
    await page.click("#runtime-dependency-settings");
    assert.equal(
      await page.locator("#export-runtime-source").isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "关闭运行依赖设置" }).click();
    await page.click("#save-workflow");
    await app.close();
    await launch();
    await page.click("#workflow-manager");
    assert.match(
      await page.locator('[data-plugin-id="studio.starsector"]').innerText(),
      /已停用/,
    );
    await page
      .locator(".saved-workflow")
      .filter({ hasText: "data/shaders/workflow" })
      .getByRole("button", { name: "打开", exact: true })
      .click();
    assert.match(
      await page.locator("#compile-message").textContent(),
      /未启用/,
    );
    await page.locator('a[data-stage="vertex"]').click();
    await page.click("#vertex-settings");
    assert.equal(await page.locator("#geometry-sx").inputValue(), "1.4");
    assert.match(
      await page.locator("#geometry-dialog output").textContent(),
      /WebGL2/,
    );
    await page.getByRole("button", { name: "关闭几何设置" }).click();
    await page.click("#workflow-manager");
    await actions.toggle("studio.starsector", true);
    await page.click("#close-workflow-dialog");
    await actions.exportEffect("ExportRestored");
    await page.click("#vertex-settings");
    await page
      .getByRole("checkbox", { name: "缩放 X 每实例变化", exact: true })
      .check();
    const id = page.getByRole("textbox", {
      name: "缩放 X 参数 ID",
      exact: true,
    });
    await id.fill("stretch");
    await id.press("Tab");
    await page
      .getByRole("checkbox", { name: "color 每实例变化", exact: true })
      .check();
    assert.match(
      await page.locator(".constructor-signature").textContent(),
      /float\[\] stretch/,
    );
    assert.match(
      await page.locator(".constructor-signature").textContent(),
      /Vector4f\[\] color/,
    );
    await page.getByRole("button", { name: "关闭几何设置" }).click();
    await actions.exportEffect("ExportArray");
    await page.click("#runtime-dependency-settings");
    await page.fill("#runtime-source-path", "data/customfx");
    await page.locator("#runtime-source-path").press("Tab");
    assert.match(
      await page.locator("#runtime-source-location").textContent(),
      /data\.customfx/,
    );
    const waiting = page.waitForEvent("download");
    await page.click("#export-runtime-source");
    await (await waiting).saveAs(path.join(out, "custom/WorkflowRuntime.java"));
    await page.getByRole("button", { name: "关闭运行依赖设置" }).click();
    await actions.exportEffect("ExportCustomPath");
    assert.match(
      await fs.readFile(
        downloads.at(-1).files.find((f) => f.endsWith(".java")),
        "utf8",
      ),
      /import data.customfx.WorkflowRuntime/,
    );
    assert.deepEqual(errors, []);
    // 编译后端缺席：依赖级联停用，编辑/持久化可用，恢复导出自动启用前端和后端。
    await page.click("#workflow-manager");
    await actions.toggle("studio.glsl", false);
    for (const id of ["studio.compiler", "studio.starsector"])
      assert.match(
        await page.locator(`[data-plugin-id="${id}"]`).innerText(),
        /已停用/,
      );
    await page.click("#close-workflow-dialog");
    await page.click("#vertex-settings");
    await page
      .locator("#geometry-dialog output")
      .filter({ hasText: /缺少|不可用|未启用/ })
      .waitFor();
    await page.fill("#geometry-sx", "1.6");
    await page.locator("#geometry-sx").press("Tab");
    await page.screenshot({ path: path.join(out, "backend-disabled.png") });
    await page.getByRole("button", { name: "关闭几何设置" }).click();
    await page.click("#save-workflow");
    await app.close();
    await launch();
    await page.click("#workflow-manager");
    assert.match(
      await page.locator('[data-plugin-id="studio.glsl"]').innerText(),
      /已停用/,
    );
    await actions.toggle("studio.starsector", true);
    await actions.toggle("studio.preview", true);
    for (const id of ["studio.compiler", "studio.glsl"])
      assert.match(
        await page.locator(`[data-plugin-id="${id}"]`).innerText(),
        /已启用/,
      );
    await page
      .locator(".saved-workflow")
      .filter({ hasText: "data/shaders/workflow" })
      .getByRole("button", { name: "打开", exact: true })
      .click();
    await page.locator('a[data-stage="vertex"]').click();
    await page.click("#vertex-settings");
    assert.equal(await page.locator("#geometry-sx").inputValue(), "1.6");
    await page
      .locator("#geometry-dialog output")
      .filter({ hasText: /WebGL2/ })
      .waitFor();
    await page.getByRole("button", { name: "关闭几何设置" }).click();
    await actions.exportEffect("BackendRestored");
    await customCompilerPath({ page, actions, out });
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(out, "desktop-restored.png") });
    await fs.writeFile(
      path.join(out, "desktop-report.json"),
      JSON.stringify(
        {
          version: "1.0.0",
          route: "desktop UI only",
          checks: [
            "first dependency + three-file export",
            "disable blocks export and dependency",
            "disabled 8-instance geometry preview",
            "edit/save/restart while disabled",
            "restore export",
            "geometry and color arrays",
            "custom dependency path",
            "compiler backend cascade, disabled edit/save/restart and automatic dependency activation",
            "custom GLSL target choice, persistence, driver node diagnostics and repair",
          ],
          downloads,
          dependencies: [
            path.join(out, "WorkflowRuntime.java"),
            path.join(out, "custom/WorkflowRuntime.java"),
          ],
          errors,
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
    await app?.close();
    throw error;
  }
}

/** 独立 MCP 验收之前的用户连接前提，此函数结束后不再调用桌面 UI。 */
export async function prepareMcp({ page, out }) {
  await page.click("#plugin-center-open");
  await page.getByRole("tab", { name: "插件设置", exact: true }).click();
  await page.getByRole("button", { name: "展开插件配置 MCP 工作流接入", exact: true }).click();
  await page.click("#bridge-check");
  await page
    .locator("#bridge-status")
    .filter({ hasText: /已激活/ })
    .waitFor();
  await page.click("#bridge-copy-prompt");
  const prompt = await page.locator("#bridge-prompt").inputValue(),
    config = JSON.parse(prompt.match(/```json\s*([\s\S]*?)```/)[1]).mcpServers[
      "workflow-shader"
    ];
  await fs.writeFile(
    path.join(out, "mcp-config.json"),
    JSON.stringify(config, null, 2),
  );
  await page.click("#close-plugin-center");
}

import assert from "node:assert/strict";
import path from "node:path";
/** 自定义源码目标与驱动诊断，只经可见目录、检查器和画布操作。 */
export async function customCompilerPath({ page, actions, out }) {
  await page.locator('a[data-stage="fragment"]').click();
  await page.fill("#node-search", "");
  await page
    .getByRole("button", { name: "+ 创建自定义 GLSL 节点", exact: true })
    .click();
  await page.fill("#custom-editor-title", "TargetProof");
  await page.locator(".custom-param-type").nth(1).selectOption("VEC4");
  await page.fill("#custom-editor-code", "value = vec4(1.0, 0.0, 0.0, 1.0);");
  await page.getByLabel("支持 WebGL2 预览", { exact: true }).uncheck();
  await page.getByRole("button", { name: "保存节点定义", exact: true }).click();
  await page.fill("#node-search", "TargetProof");
  const type = await page.locator(".catalog-node").getAttribute("data-type");
  const id = await actions.add(type, "TargetProof", 350, 260, true);
  const output = await page
    .locator('.workflow-node[data-type="io.output"]')
    .getAttribute("data-id");
  await actions.connect(id, "value", output, "color");
  await page
    .locator(".compile-card .pill")
    .filter({ hasText: /^可导出$/ })
    .waitFor();
  await page.locator('a[data-stage="vertex"]').click();
  await page.click("#vertex-settings");
  await page
    .locator("#geometry-dialog output")
    .filter({ hasText: /未声明支持目标.*glsl-es-300/ })
    .waitFor();
  await page.screenshot({ path: path.join(out, "custom-target-rejected.png") });
  await page.getByRole("button", { name: "关闭几何设置" }).click();
  await page.locator('a[data-stage="fragment"]').click();
  const edit = () =>
    page.locator(`.workflow-node[data-id="${id}"] header`).dblclick();
  await edit();
  assert.equal(
    await page.getByLabel("支持 WebGL2 预览", { exact: true }).isChecked(),
    false,
  );
  await page.getByLabel("支持 WebGL2 预览", { exact: true }).check();
  await page.fill("#custom-editor-code", "value = missingFunction();");
  await page.getByRole("button", { name: "保存节点定义", exact: true }).click();
  await page.locator('a[data-stage="vertex"]').click();
  await page.click("#vertex-settings");
  await page
    .locator("#geometry-dialog output")
    .filter({ hasText: new RegExp("节点 " + id) })
    .waitFor();
  await page.screenshot({
    path: path.join(out, "custom-node-driver-diagnostic.png"),
  });
  await page.getByRole("button", { name: "关闭几何设置" }).click();
  await page.locator('a[data-stage="fragment"]').click();
  await edit();
  await page.fill("#custom-editor-code", "value = vec4(1.0, 0.0, 0.0, 1.0);");
  await page.getByRole("button", { name: "保存节点定义", exact: true }).click();
  await page.locator('a[data-stage="vertex"]').click();
  await page.click("#vertex-settings");
  await page
    .locator("#geometry-dialog output")
    .filter({ hasText: /WebGL2/ })
    .waitFor();
  await page.getByRole("button", { name: "关闭几何设置" }).click();
  await actions.exportEffect("CustomTargetEffect");
}

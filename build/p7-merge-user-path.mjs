// 纯桌面用户路径：只用可见控件、文件选择和下载修改状态，磁盘只读用于核对结果。
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const { _electron } = createRequire(import.meta.url)("playwright");
const root = path.resolve(import.meta.dirname, "..");
export async function desktopUnifiedPath() {
  const out = path.join(root, "build/verification/p7-unified-" + Date.now());
  await fs.mkdir(out, { recursive: true });
  const executablePath = path.join(
    root,
    "release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe",
  );
  const launch = async (name) => {
    const app = await _electron.launch({
        executablePath,
        args: ["--user-data-dir=" + path.join(out, name)],
        acceptDownloads: true,
        timeout: 20000,
      }),
      page = await app.firstWindow();
    page.setDefaultTimeout(8000);
    await page.waitForSelector('body[data-ui-ready="true"]');
    return { app, page };
  };
  let first = await launch("profile"),
    second;
  const errors = [],
    checks = [];
  const watch = (page) => page.on("pageerror", (e) => errors.push(e.message));
  watch(first.page);
  const title = async (page, value) => {
    await page.locator("#workflow-title").fill(value);
    await page.locator("#save-current-workflow").click();
  };
  const diskTitle = async () =>
    JSON.parse(await fs.readFile(file, "utf8")).project.title;
  const wait = async (fn, expected) => {
    for (let i = 0; i < 60; i++) {
      if ((await fn()) === expected) return;
      await new Promise((r) => setTimeout(r, 75));
    }
    assert.equal(await fn(), expected);
  };
  const openFile = async (page) => {
    await page.locator("#open-workflow-file-input").setInputFiles(file);
    await page
      .locator("#workflow-save-location")
      .filter({ hasText: "UnifiedWorkflow.workflow.json" })
      .waitFor();
  };
  const file = path.join(out, "UnifiedWorkflow.workflow.json");
  try {
    const page = first.page;
    assert.equal(await page.locator("#project-files-open").count(), 0);
    assert.equal(await page.locator("#project-files-dialog").count(), 0);
    await page.locator("#workflow-manager").click();
    await page.locator("#plugin-class-name").fill("UnifiedWorkflow");
    await title(page, "统一工作流 A");
    await page
      .locator("#workflow-save-state")
      .filter({ hasText: /^已保存/ })
      .waitFor();
    await title(page, "统一工作流 B");
    const duplicate = spawn(executablePath,["--user-data-dir="+path.join(out,"profile")],{windowsHide:true,stdio:"ignore"});
    const duplicateExit = await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{duplicate.kill();reject(Error("同一配置的重复进程没有退出"));},6000);
      duplicate.once("error",error=>{clearTimeout(timeout);reject(error);});
      duplicate.once("exit",code=>{clearTimeout(timeout);resolve(code);});
    });
    assert.equal(duplicateExit,0);
    assert.equal(await page.locator("#workflow-title").inputValue(),"统一工作流 B");
    checks.push("同一配置重复启动正常退出，现有编辑窗口和内容保持");
    await page.locator("#restore-workflow-backup").click();
    await wait(
      () => page.locator("#workflow-title").inputValue(),
      "统一工作流 A",
    );
    await page.locator("#reload-workflow").click();
    await wait(
      () => page.locator("#workflow-title").inputValue(),
      "统一工作流 B",
    );
    checks.push("原工作流配置保存、库内备份和重读");
    const downloading = page.waitForEvent("download");
    await page.locator("#export-workflow-copy").click();
    await (await downloading).saveAs(file);
    await openFile(page);
    await title(page, "已关联工作流 C");
    await wait(diskTitle, "已关联工作流 C");
    await title(page, "重复保存不丢备份 D");
    await wait(diskTitle, "重复保存不丢备份 D");
    const beforeRepeat = await fs.readFile(file, "utf8");
    for (let i=0;i<3;i++) {
      await page.locator("#save-current-workflow").click();
      await page.locator("#workflow-save-state").filter({hasText:/^已保存/}).waitFor();
    }
    assert.equal(await fs.readFile(file,"utf8"),beforeRepeat,"相同表单连续保存不得制造新修订");
    await page.locator("#restore-workflow-backup").click();
    await wait(()=>page.locator("#workflow-title").inputValue(),"已关联工作流 C");
    await page.locator("#reload-workflow").click();
    await wait(()=>page.locator("#workflow-title").inputValue(),"重复保存不丢备份 D");
    checks.push("连续三次配置保存不修改文件，仍能恢复上一次有效备份");
    await page.locator("#close-workflow-dialog").click();
    await page.locator(".workflow-node").first().click();
    await page.locator("#node-custom-id").fill("my_workflow_center");
    await page.locator("#apply-node-id").click();
    await page.locator("#save-workflow").click();
    await wait(
      async () =>
        JSON.parse(await fs.readFile(file, "utf8")).graphs.fragment.nodes.some(
          (n) => n.id === "my_workflow_center",
        ),
      true,
    );
    await page.locator("#node-custom-id").fill("my_workflow_center_final");
    await page.locator("#apply-node-id").click();
    await page.locator("#canvas-shell").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+s");
    await wait(
      async () =>
        JSON.parse(await fs.readFile(file, "utf8")).graphs.fragment.nodes.some(
          (n) => n.id === "my_workflow_center_final",
        ),
      true,
    );
    checks.push(
      "真实下载/文件选择授权，配置页、工具栏和 Ctrl+S 均保存到同一源文件",
    );
    second = await launch("second-profile");
    watch(second.page);
    await second.page.locator("#workflow-manager").click();
    await openFile(second.page);
    await title(second.page, "另一个窗口的修改");
    await wait(diskTitle, "另一个窗口的修改");
    await page.locator("#workflow-manager").click();
    await title(page, "第一个窗口的未保存修改");
    await page.locator("#workflow-save-conflict").waitFor();
    assert.equal(await diskTitle(), "另一个窗口的修改");
    await page.screenshot({ path: path.join(out, "workflow-conflict.png") });
    await page.locator("#reload-workflow").click();
    await wait(
      () => page.locator("#workflow-title").inputValue(),
      "另一个窗口的修改",
    );
    await page.locator("#workflow-storage summary").click();
    await page
      .locator("[data-recovery-id]")
      .filter({ hasText: "第一个窗口的未保存修改" })
      .getByRole("button", { name: "恢复此草稿" })
      .click();
    await wait(
      () => page.locator("#workflow-title").inputValue(),
      "第一个窗口的未保存修改",
    );
    await page.locator("#save-current-workflow").click();
    await page.locator("#workflow-save-conflict").waitFor();
    await page
      .getByRole("button", { name: "覆盖外部版本…", exact: true })
      .click();
    await page.locator("#confirm-workflow-overwrite").click();
    await wait(diskTitle, "第一个窗口的未保存修改");
    checks.push(
      "双窗口真实外部冲突、拒绝覆盖、重读、恢复未保存草稿、明确确认覆盖",
    );
    await second.page.locator("#reload-workflow").click();
    await wait(
      () => second.page.locator("#workflow-title").inputValue(),
      "第一个窗口的未保存修改",
    );
    await title(second.page, "库中再次打开应读取磁盘");
    await wait(diskTitle, "库中再次打开应读取磁盘");
    await page.locator('#saved-workflows button[data-open="default"]').click();
    await page.locator("#workflow-manager").click();
    await wait(
      () => page.locator("#workflow-title").inputValue(),
      "库中再次打开应读取磁盘",
    );
    checks.push("工作流库再次打开关联来源，拒绝陈旧缓存");
    await second.app.close();
    second = null;
    await first.app.close();
    first = await launch("profile");
    watch(first.page);
    await first.page.locator("#workflow-manager").click();
    await first.page
      .locator('#saved-workflows button[data-open="default"]')
      .click();
    await first.page.locator("#workflow-manager").click();
    assert.equal(
      await first.page.locator("#workflow-title").inputValue(),
      "库中再次打开应读取磁盘",
    );
    assert.match(
      await first.page.locator("#workflow-save-location").innerText(),
      /UnifiedWorkflow/,
    );
    await first.page.locator('#workflow-storage').scrollIntoViewIfNeeded();
    const bounds=await first.page.locator('#workflow-storage').boundingBox();
    for(const button of await first.page.locator('#workflow-storage .dialog-actions button').all()){
      const box=await button.boundingBox();assert.ok(box.x>=bounds.x-1&&box.x+box.width<=bounds.x+bounds.width+1,'保存区按钮不得溢出工作流配置列');
    }
    await first.page.screenshot({
      path: path.join(out, "workflow-unified.png"),
    });
    await first.page.locator("#close-workflow-dialog").click();
    await first.page
      .locator('.workflow-node[data-id="my_workflow_center_final"]')
      .waitFor();
    checks.push("完整重启，来源关联和自定义节点 ID 保持");
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.join(out, "desktop-report.json"),
      JSON.stringify(
        { ok: true, route: "desktop only", checks, file, errors },
        null,
        2,
      ),
    );
    return { out, ...first };
  } catch (error) {
    await first.page
      .screenshot({ path: path.join(out, "failure.png") })
      .catch(() => {});
    await first.app.close().catch(() => {});
    await second?.app.close().catch(() => {});
    throw error;
  }
}

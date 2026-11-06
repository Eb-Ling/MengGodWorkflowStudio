// User acceptance: packaged EXE and a real MCP client configured from the visible
// panel. No evaluate(), storage writes, hidden bridge edits or generator fixtures.
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { openStdioClient } = require("../packages/native-host/stdio-client.cjs");
const root = path.resolve(import.meta.dirname, "..");
const { version } = JSON.parse(
  await fs.readFile(path.join(root, "desktop/package.json"), "utf8"),
);
const out = path.join(root, "build/verification/settings-path-" + Date.now());
await fs.mkdir(out, { recursive: true });
const profile = path.join(out, "profile"),
  errors = [];
let app, page, client;
async function launch() {
  app = await _electron.launch({
    executablePath: path.join(
      root,
      `release/MengGod-Workflow-Studio-${version}-win-x64/MengGod Workflow Studio.exe`,
    ),
    args: ["--user-data-dir=" + profile],
    timeout: 30000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForSelector('body[data-ui-ready="true"]');
}
const bridgeStatus = (text) =>
  page.locator("#bridge-status").filter({ hasText: text }).waitFor();
async function tool(name, args = {}) {
  const response = await client.request("tools/call", {
    name,
    arguments: args,
  });
  if (response.isError) throw Error(response.content[0].text);
  return JSON.parse(response.content[0].text);
}
const guards = (summary) => ({
  documentId: summary.project.id,
  documentToken: summary.documentToken,
  stage: summary.stage,
  expectedRevision: summary.graph.revision,
});
async function selectAll() {
  const canvas = await page.locator("#canvas-shell").boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(canvas.x + 5, canvas.y + 5);
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + canvas.width - 6,
    canvas.y + canvas.height - 30,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.keyboard.up("Shift");
}
try {
  await launch();
  await page.click("#workflow-manager");
  await page.fill("#workflow-title", "设置与插件验收");
  await page.fill("#plugin-class-name", "SettingsCheck");
  await page.fill("#shader-directory", "data/shaders/check");
  await page.selectOption("#blend-mode", "additive");
  await page.fill("#preview-canvas-width", "320");
  await page.fill("#preview-canvas-height", "180");
  await page.click("#save-current-workflow");
  await page.click("#close-workflow-dialog");
  await page.click("#workflow-manager");
  assert.equal(
    await page.locator("#workflow-title").inputValue(),
    "设置与插件验收",
  );
  assert.equal(await page.locator("#blend-mode").inputValue(), "additive");
  assert.equal(await page.locator("#preview-canvas-width").inputValue(), "320");
  assert.equal(
    await page.locator("#preview-canvas-height").inputValue(),
    "180",
  );
  const port = await page.locator("#bridge-port").inputValue();
  await page.fill("#bridge-port", "0");
  await page.locator("#bridge-port").press("Tab");
  await bridgeStatus(/端口必须/);
  await page.fill("#bridge-port", port);
  await page.locator("#bridge-port").press("Tab");
  await page.click("#bridge-check");
  await bridgeStatus(/已激活/);
  await page.click("#bridge-self-test");
  await bridgeStatus(/MCP 本机自检通过/);
  await page.click("#bridge-copy-prompt");
  await page.waitForSelector("#bridge-prompt");
  const prompt = await page.locator("#bridge-prompt").inputValue();
  const config = JSON.parse(prompt.match(/```json\s*([\s\S]*?)```/)[1])
    .mcpServers["workflow-shader"];
  assert.match(config.args[0], /plugins[\\/]mcp[\\/]stdio\.mjs/);
  client = openStdioClient({
    executablePath: config.command,
    entry: config.args[0],
    env: config.env,
  });
  await client.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "User-path verification", version: "1.0.0" },
  });
  client.notify("notifications/initialized");
  assert.equal((await tool("workflow_get_status")).editorConnected, true);
  await page.screenshot({ path: path.join(out, "mcp-plugin-panel.png") });
  // Actual external MCP calls operate on the UI-created draft through its API.
  const before = await tool("workflow_get_summary");
  const commands = [
    {
      type: "RENAME_NODE",
      payload: { nodeId: "uv_start", title: "MCP 事务节点" },
    },
    { type: "MOVE_NODE", payload: { nodeId: "uv_start", x: 150, y: 180 } },
  ];
  await tool("workflow_submit_commands", { ...guards(before), commands });
  await page.click("#close-workflow-dialog");
  assert.match(
    await page
      .locator('.workflow-node[data-id="uv_start"] header')
      .textContent(),
    /MCP 事务节点/,
  );
  await page.keyboard.press("Control+z");
  assert.doesNotMatch(
    await page
      .locator('.workflow-node[data-id="uv_start"] header')
      .textContent(),
    /MCP 事务节点/,
  );
  await page.keyboard.press("Control+y");
  assert.match(
    await page
      .locator('.workflow-node[data-id="uv_start"] header')
      .textContent(),
    /MCP 事务节点/,
  );
  await page.click("#workflow-manager");
  await page.click("#bridge-check");
  await bridgeStatus(/已激活/);
  const latest = await tool("workflow_get_summary");
  const invalid = await client.request("tools/call", {
    name: "workflow_submit_commands",
    arguments: {
      ...guards(latest),
      commands: [
        ...Array.from({ length: 7 }, (_, i) => ({
          type: "MOVE_NODE",
          payload: { nodeId: "uv_start", x: 160 + i, y: 200 },
        })),
        {
          type: "CONNECT",
          payload: {
            link: {
              fromNode: "uv_start",
              fromSocket: "missing",
              toNode: "center_start",
              toSocket: "uv",
            },
          },
        },
      ],
    },
  });
  assert.equal(invalid.isError, true);
  assert.deepEqual(
    (await tool("workflow_get_summary")).graph,
    latest.graph,
    "Rejected batch must not partially edit the real canvas",
  );
  const stale = await client.request("tools/call", {
    name: "workflow_submit_commands",
    arguments: { ...guards(before), commands },
  });
  assert.equal(stale.isError, true);
  // 使用面板配置建立的真实 MCP 客户端验证双阶段事务和联合历史。
  const jointBefore = await tool("workflow_get_summary");
  const vertexId = jointBefore.vertexTransform.graph.nodes[0].id;
  const transaction = {
    label: "MCP 双阶段事务",
    commands: [
      {
        type: "RENAME_NODE",
        stage: "fragment",
        payload: { nodeId: "uv_start", title: "联合片段" },
      },
      {
        type: "RENAME_NODE",
        stage: "vertex",
        payload: { nodeId: vertexId, title: "联合顶点" },
      },
    ],
  };
  await tool("workflow_document_transaction", {
    ...guards(jointBefore),
    expectedDocumentRevision: jointBefore.documentRevision,
    transaction,
  });
  const jointAfter = await tool("workflow_get_summary");
  assert.equal(
    jointAfter.graph.nodes.find((n) => n.id === "uv_start").title,
    "联合片段",
  );
  assert.equal(jointAfter.vertexTransform.graph.nodes[0].title, "联合顶点");
  const staleDocument = await client.request("tools/call", {
    name: "workflow_document_transaction",
    arguments: {
      ...guards(jointAfter),
      expectedDocumentRevision: jointBefore.documentRevision,
      transaction,
    },
  });
  assert.equal(staleDocument.isError, true);
  assert.deepEqual(
    (await tool("workflow_get_summary")).graph,
    jointAfter.graph,
  );
  await tool("workflow_undo", guards(jointAfter));
  const undone = await tool("workflow_get_summary");
  assert.deepEqual(undone.graph.nodes, jointBefore.graph.nodes);
  assert.deepEqual(
    undone.vertexTransform.graph.nodes,
    jointBefore.vertexTransform.graph.nodes,
  );
  await tool("workflow_redo", guards(undone));
  const redone = await tool("workflow_get_summary");
  assert.deepEqual(redone.graph.nodes, jointAfter.graph.nodes);
  assert.deepEqual(
    redone.vertexTransform.graph.nodes,
    jointAfter.vertexTransform.graph.nodes,
  );
  await tool("workflow_undo", guards(redone));
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "停用 MCP 工作流接入", exact: true })
      .click();
    await page.waitForSelector(
      '[data-plugin-id="studio.mcp"] .plugin-status:text-is("已停用")',
    );
    assert.equal(await page.locator('[data-ui-owner="studio.mcp"]').count(), 0);
    const disabled = await client.request("tools/call", {
      name: "workflow_get_summary",
      arguments: {},
    });
    assert.equal(disabled.isError, true);
    await page.click("#close-workflow-dialog");
    await page.locator('.workflow-node[data-id="uv_start"] header').click();
    await page.fill("#node-title", "停用后编辑 " + i);
    await page.locator("#node-title").press("Tab");
    assert.match(
      await page
        .locator('.workflow-node[data-id="uv_start"] header')
        .textContent(),
      new RegExp("停用后编辑 " + i),
    );
    await page.click("#workflow-manager");
    await page
      .getByRole("button", { name: "启用 MCP 工作流接入", exact: true })
      .click();
    await page.waitForSelector("#bridge-check");
    assert.equal(
      await page.locator('[data-ui-owner="studio.mcp"]').count(),
      1,
      "Restart must create exactly one panel",
    );
    await page.click("#bridge-check");
    await bridgeStatus(/已激活/);
    assert.equal((await tool("workflow_get_status")).editorConnected, true);
  }
  await page
    .getByRole("button", { name: "停用 MCP 工作流接入", exact: true })
    .click();
  await page.waitForSelector(
    '[data-plugin-id="studio.mcp"] .plugin-status:text-is("已停用")',
  );
  await page.click("#close-workflow-dialog");
  // Clipboard, bulk removal, demo batch, zoom and independent stages with MCP off.
  await page.locator('.workflow-node[data-id="uv_start"] header').click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  assert.equal(await page.locator(".workflow-node").count(), 4);
  await page.keyboard.press("Control+z");
  assert.equal(await page.locator(".workflow-node").count(), 3);
  await page.keyboard.press("Control+y");
  assert.equal(await page.locator(".workflow-node").count(), 4);
  await page.keyboard.press("Control+z");
  await selectAll();
  assert.equal(await page.locator(".workflow-node.selected").count(), 3);
  await page.keyboard.press("Delete");
  assert.equal(await page.locator(".workflow-node").count(), 0);
  await page.keyboard.press("Control+z");
  assert.equal(await page.locator(".workflow-node").count(), 3);
  await page.click("#add-demo");
  assert.equal(await page.locator(".workflow-node").count(), 6);
  await page.keyboard.press("Control+z");
  assert.equal(
    await page.locator(".workflow-node").count(),
    3,
    "Demo creation must be one undo step",
  );
  const viewBefore = await page
      .locator("#graph-transform")
      .getAttribute("style"),
    canvas = await page.locator("#canvas-shell").boundingBox();
  await page.mouse.move(
    canvas.x + canvas.width / 2,
    canvas.y + canvas.height / 2,
  );
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(150);
  assert.notEqual(
    await page.locator("#graph-transform").getAttribute("style"),
    viewBefore,
  );
  await page.locator('a[data-stage="vertex"]').click();
  await page.locator('a[data-stage="fragment"]').click();
  assert.equal(await page.locator(".workflow-node").count(), 3);
  await page.click("#save-workflow");
  client.close();
  client = null;
  await app.close();
  app = null;
  await launch();
  await page.click("#workflow-manager");
  await page.waitForSelector(
    '[data-plugin-id="studio.mcp"] .plugin-status:text-is("已停用")',
  );
  assert.equal(
    await page.locator("#bridge-check").count(),
    0,
    "Disabled state must survive a full EXE restart",
  );
  await page
    .getByRole("button", { name: "启用 MCP 工作流接入", exact: true })
    .click();
  await page.waitForSelector("#bridge-check");
  await page.click("#bridge-self-test");
  await bridgeStatus(/MCP 本机自检通过/);
  await page.click("#open-instance-example");
  await page.locator('a[data-stage="vertex"]').click();
  await page.click("#vertex-settings");
  await page.fill("#preview-count", "100");
  await page.locator("#preview-count").press("Tab");
  assert.equal(await page.locator("#preview-count").inputValue(), "64");
  await page.fill("#preview-selected", "100");
  await page.locator("#preview-selected").press("Tab");
  assert.equal(await page.locator("#preview-selected").inputValue(), "64");
  await page.fill("#preview-count", "12");
  await page.locator("#preview-count").press("Tab");
  assert.equal(await page.locator("#preview-selected").inputValue(), "12");
  assert.match(
    await page.locator(".instance-coordinate-count").textContent(),
    /12 个实例/,
  );
  await page.fill("#geometry-sx", "");
  await page.locator("#geometry-sx").press("Tab");
  assert.match(
    await page.locator("#geometry-dialog output").textContent(),
    /必须为有限数/,
  );
  await page.fill("#geometry-sx", "1.5");
  await page.locator("#geometry-sx").press("Tab");
  await page.fill("#geometry-rotation", "30");
  await page.locator("#geometry-rotation").press("Tab");
  assert.match(
    await page.locator("#geometry-dialog output").textContent(),
    /WebGL2/,
  );
  await page.screenshot({ path: path.join(out, "geometry-settings.png") });
  await page.getByRole("button", { name: "关闭几何设置" }).click();
  const playback = page.locator("#preview-time-toggle");
  const initialPlayback = await playback.getAttribute("aria-checked");
  await playback.click();
  assert.notEqual(await playback.getAttribute("aria-checked"), initialPlayback);
  await playback.click();
  assert.equal(await playback.getAttribute("aria-checked"), initialPlayback);
  await page.locator('a[data-stage="fragment"]').click();
  const count = await page.locator(".workflow-node").count();
  const invalidFile = path.join(out, "invalid.workflow.json");
  await fs.writeFile(
    invalidFile,
    '{"schemaVersion":1,"graph":{"nodes":[],"links":[{"toNode":"missing"}]}}',
  );
  await page.click("#import-workflow");
  let chooser = page.waitForEvent("filechooser");
  await page.click("#choose-workflow-file");
  await (await chooser).setFiles(invalidFile);
  await page
    .locator("#import-status")
    .filter({ hasText: /导入失败/ })
    .waitFor();
  assert.equal(await page.locator(".workflow-node").count(), count);
  const currentExample = JSON.parse(
    await fs.readFile(
      path.join(root, "plugins/templates/instanced-wave.workflow.json"),
      "utf8",
    ),
  );
  const retiredFile = path.join(out, "retired.workflow.json");
  await fs.writeFile(
    retiredFile,
    JSON.stringify({
      schemaVersion: 1,
      project: currentExample.project,
      graph: currentExample.graphs.fragment,
      vertexTransform: {
        ...currentExample.geometry,
        graph: currentExample.graphs.vertex,
      },
    }),
  );
  chooser = page.waitForEvent("filechooser");
  await page.click("#choose-workflow-file");
  await (await chooser).setFiles(retiredFile);
  await page
    .locator("#import-status")
    .filter({ hasText: /仅支持当前 v1.0/ })
    .waitFor();
  assert.equal(await page.locator(".workflow-node").count(), count);
  chooser = page.waitForEvent("filechooser");
  await page.click("#choose-workflow-file");
  await (
    await chooser
  ).setFiles(path.join(root, "plugins/templates/instanced-wave.workflow.json"));
  await page
    .locator("#import-status")
    .filter({ hasText: /导入成功/ })
    .waitFor();
  await page.click("#close-import-dialog");
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        version,
        route: "real EXE UI + public stdio MCP configured from visible panel",
        settings: true,
        atomicMcp: true,
        staleRequests: true,
        pluginCycles: 3,
        restartPersistence: true,
        clipboard: true,
        bulkUndo: true,
        zoom: true,
        geometry: true,
        import: true,
        retiredFormatRejected: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: settings, real MCP transactions, plugin lifecycle/restart, clipboard/history, geometry and import\n" +
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
  client?.close();
  await app?.close();
}

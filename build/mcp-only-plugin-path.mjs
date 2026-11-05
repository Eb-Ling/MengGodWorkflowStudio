// 外部 AI 验收：配置来自用户可见的接入面板，开始后只调用公开 stdio MCP 工具。
// 不导入编辑器、编译器或 Playwright，不读写配置/图数据库，不调用 HTTP 私有路由。
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { openStdioClient } = require("../packages/native-host/stdio-client.cjs");
const config = JSON.parse(await fs.readFile(process.argv[2], "utf8")),
  out = process.argv[3];
await fs.mkdir(out, { recursive: true });
const client = openStdioClient({
    executablePath: config.command,
    entry: config.args[0],
    env: config.env,
  }),
  calls = [];
async function tool(name, args = {}, expectError = false) {
  const result = await client.request("tools/call", { name, arguments: args });
  calls.push({ name, args, error: result.isError || false });
  if (expectError) {
    assert.equal(result.isError, true);
    return result;
  }
  if (result.isError) throw Error(result.content[0].text);
  return JSON.parse(result.content[0].text);
}
const guards = (s) => ({
  documentId: s.project.id,
  documentToken: s.documentToken,
  stage: s.stage,
  expectedRevision: s.graph.revision,
});
async function mutate(name, args = {}) {
  const s = await tool("workflow_get_summary");
  return tool(name, { ...guards(s), ...args });
}
const add = (id, typeId, properties = {}, x = 0, y = 0) => ({
  type: "ADD_NODE",
  payload: {
    node: { id, typeId, title: id, canvasX: x, canvasY: y, properties },
  },
});
const link = (a, s, b, t) => ({
  type: "CONNECT",
  payload: { link: { fromNode: a, fromSocket: s, toNode: b, toSocket: t } },
});
try {
  await client.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "MCP-only external AI verification", version: "1.0.0" },
  });
  client.notify("notifications/initialized");
  assert.equal(
    (await tool("workflow_get_status")).editorConnected,
    true,
    "用户需先在接入面板激活目标草稿，本脚本不会替代此操作",
  );
  await tool("workflow_agent_instructions");
  const tools = await client.request("tools/list");
  assert.equal(tools.tools.length, 35);
  await mutate("workflow_create", {
    title: "MCP 独立节点工作流",
    className: "McpLocalEffect",
    previewWidth: 128,
    previewHeight: 128,
  });
  await mutate("workflow_set_stage", { targetStage: "fragment" });
  const { catalog } = await tool("workflow_list_node_types"),
    node = catalog.find((n) => n.typeId === "local.my-nodes.double");
  assert.deepEqual(node.inputs, [{ name: "value", type: "FLOAT" }]);
  assert.deepEqual(node.outputs, [{ name: "result", type: "FLOAT" }]);
  let s = await tool("workflow_get_summary");
  await tool("workflow_submit_commands", {
    ...guards(s),
    commands: [
      ...s.graph.nodes.map((n) => ({
        type: "REMOVE_NODE",
        payload: { nodeId: n.id },
      })),
      add(
        "mcp-value",
        "studio.math.constant",
        { valueType: "FLOAT", value: 0.2 },
        20,
        20,
      ),
      add("mcp-double", node.typeId, {}, 280, 20),
      add(
        "mcp-color",
        "studio.math.vector.combine",
        { valueType: "VEC4" },
        540,
        20,
      ),
      add("mcp-output", "io.output", {}, 800, 20),
      link("mcp-value", "value", "mcp-double", "value"),
      ...["x", "y", "z", "w"].map((c) =>
        link("mcp-double", "result", "mcp-color", c),
      ),
      link("mcp-color", "value", "mcp-output", "color"),
      { type: "SET_OUTPUT", payload: { nodeId: "mcp-output" } },
    ],
  });
  s = await tool("workflow_get_summary");
  assert.equal(s.graph.nodes.length, 4);
  assert.equal(s.graph.links.length, 6);
  const before = s;
  await tool(
    "workflow_submit_commands",
    {
      ...guards(s),
      commands: [
        {
          type: "RENAME_NODE",
          payload: { nodeId: "mcp-double", title: "不应提交" },
        },
        link("mcp-double", "missing", "mcp-output", "color"),
      ],
    },
    true,
  );
  assert.deepEqual((await tool("workflow_get_summary")).graph, before.graph);
  await mutate("workflow_set_stage", { targetStage: "vertex" });
  assert.ok(
    (await tool("workflow_list_node_types")).catalog.some(
      (n) => n.typeId === node.typeId,
    ),
  );
  await mutate("workflow_submit_commands", {
    commands: [add("mcp-vertex-double", node.typeId, {}, 400, 350)],
  });
  s = await tool("workflow_get_summary");
  await tool("workflow_document_transaction", {
    ...guards(s),
    expectedDocumentRevision: s.documentRevision,
    transaction: {
      label: "MCP 双阶段独立插件",
      commands: [
        {
          stage: "vertex",
          type: "RENAME_NODE",
          payload: { nodeId: "mcp-vertex-double", title: "顶点实例" },
        },
        {
          stage: "fragment",
          type: "RENAME_NODE",
          payload: { nodeId: "mcp-double", title: "片段实例" },
        },
      ],
    },
  });
  await mutate("workflow_undo");
  assert.equal(
    (await tool("workflow_get_summary")).graph.nodes.find(
      (n) => n.id === "mcp-vertex-double",
    ).title,
    "mcp-vertex-double",
  );
  await mutate("workflow_redo");
  assert.equal(
    (await tool("workflow_get_summary")).graph.nodes.find(
      (n) => n.id === "mcp-vertex-double",
    ).title,
    "顶点实例",
  );
  await mutate("workflow_set_stage", { targetStage: "fragment" });
  await mutate("workflow_set_project", {
    title: "MCP 独立节点工作流",
    className: "McpLocalEffect",
  });
  // 异步节点编译尚未完成时通过公开工具重读状态，不从测试程序执行编译器。
  let exported;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      exported = await mutate("workflow_export_runtime");
      break;
    } catch (e) {
      if (!String(e).includes("正在编译")) throw e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert.ok(exported?.java);
  assert.deepEqual(await tool("workflow_get_generated_sources"), exported);
  assert.equal(Object.values(exported).length, 3);
  assert.match(exported.fragment.content, /3\.0/);
  for (const file of Object.values(exported)) {
    const target = path.resolve(out, file.filename);
    assert.ok(target.startsWith(path.resolve(out) + path.sep));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content);
  }
  await mutate("workflow_save");
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        ok: true,
        route: "MCP only after user connection setup",
        tools: tools.tools.length,
        checks: [
          "node discovery",
          "exact contracts",
          "guarded graph construction",
          "atomic rejection",
          "both stage availability",
          "cross-stage transaction",
          "undo/redo",
          "three-file export",
          "saved workflow",
        ],
        limitations: [
          "Directory registration and runtime dependency setup are desktop prerequisites, not MCP tools.",
        ],
        calls,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: MCP-only external AI route; " +
      calls.length +
      " public tool calls\n" +
      out,
  );
} catch (e) {
  await fs.writeFile(
    path.join(out, "failure.json"),
    JSON.stringify({ error: e.stack, calls }, null, 2),
  );
  throw e;
} finally {
  client.close();
}

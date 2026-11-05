// 独立外部 AI 验收。配置来自可见面板，整个测试阶段只经公开 stdio MCP 工具操作文档。
// 不导入编辑器/编译器，不调用浏览器、私有 HTTP 或存储接口。
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {compilerCases} from './mcp-compiler-cases.mjs';
import {previewCases} from './mcp-preview-cases.mjs';
const { openStdioClient } = createRequire(import.meta.url)(
  "../packages/native-host/stdio-client.cjs",
);
const config = JSON.parse(await fs.readFile(process.argv[2], "utf8")),
  out = path.resolve(process.argv[3]);
await fs.mkdir(out, { recursive: true });
const client = openStdioClient({
    executablePath: config.command,
    entry: config.args[0],
    env: config.env,
  }),
  calls = [];
async function tool(name, args = {}, reject = false) {
  const r = await client.request("tools/call", { name, arguments: args });
  calls.push({ name, args, error: !!r.isError });
  if (reject) {
    assert.equal(r.isError, true);
    return r;
  }
  if (r.isError) throw Error(r.content[0].text);
  return JSON.parse(r.content[0].text);
}
const guards = (s) => ({
  documentId: s.project.id,
  documentToken: s.documentToken,
  stage: s.stage,
  expectedRevision: s.graph.revision,
});
async function mutate(name, args = {}) {
  return tool(name, { ...guards(await tool("workflow_get_summary")), ...args });
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
    clientInfo: { name: "P4 export MCP-only verification", version: "1.0.0" },
  });
  client.notify("notifications/initialized");
  assert.equal(
    (await tool("workflow_get_status")).editorConnected,
    true,
    "必须先由用户在界面激活草稿",
  );
  await tool("workflow_get_summary");
  await tool("workflow_agent_instructions");
  const list = await client.request("tools/list");
  assert.equal(list.tools.length, 35);
  await mutate("workflow_create", {
    title: "P4 MCP 导出插件验收",
    className: "McpExportEffect",
    previewWidth: 128,
    previewHeight: 128,
  });
  await mutate("workflow_set_stage", { targetStage: "fragment" });
  const { catalog } = await tool("workflow_list_node_types");
  assert.ok(catalog.some((n) => n.typeId === "io.input"));
  const s = await tool("workflow_get_summary");
  await tool("workflow_submit_commands", {
    ...guards(s),
    commands: [
      ...s.graph.nodes.map((n) => ({
        type: "REMOVE_NODE",
        payload: { nodeId: n.id },
      })),
      add(
        "color",
        "io.input",
        {
          uniform: "u_color",
          parameterId: "color",
          valueType: "VEC4",
          scope: "instance",
          defaultValue: "0.2,0.5,0.9,1",
        },
        20,
        20,
      ),
      add("output", "io.output", {}, 450, 20),
      link("color", "value", "output", "color"),
      { type: "SET_OUTPUT", payload: { nodeId: "output" } },
    ],
  });
  const before = await tool("workflow_get_summary");
  assert.equal(before.graph.nodes.length, 2);
  await tool(
    "workflow_submit_commands",
    {
      ...guards(before),
      commands: [
        {
          type: "RENAME_NODE",
          payload: { nodeId: "color", title: "不应提交" },
        },
        link("color", "missing", "output", "color"),
      ],
    },
    true,
  );
  assert.deepEqual((await tool("workflow_get_summary")).graph, before.graph);
  if(process.env.WORKFLOW_CHECK_NODE_IDS === '1') {
    await mutate('workflow_submit_commands',{commands:[{type:'RENAME_NODE_ID',payload:{nodeId:'color',id:'aiColor'}}]});
    let renamed=await tool('workflow_get_summary');
    assert.equal(renamed.graph.links[0].fromNode,'aiColor');
    await tool('workflow_submit_commands',{...guards(renamed),commands:[{type:'RENAME_NODE_ID',payload:{nodeId:'aiColor',id:'output'}}]},true);
    assert.deepEqual((await tool('workflow_get_summary')).graph,renamed.graph);
    await mutate('workflow_undo');assert.ok((await tool('workflow_get_summary')).graph.nodes.some(n=>n.id==='color'));
    await mutate('workflow_redo');assert.ok((await tool('workflow_get_summary')).graph.nodes.some(n=>n.id==='aiColor'));
    await mutate('workflow_submit_commands',{commands:[{type:'RENAME_NODE_ID',payload:{nodeId:'aiColor',id:'color'}}]});
  }
  await mutate("workflow_set_stage", { targetStage: "vertex" });
  const v = await tool("workflow_get_summary");
  const uv = v.graph.nodes.find((n) => n.typeId === "input.uv"),
    output = v.graph.nodes.find((n) => n.typeId === "vertex.output");
  assert.ok(uv && output);
  const vertexCatalog = (await tool("workflow_list_node_types")).catalog;
  assert.ok(
    vertexCatalog.some((n) => n.typeId === "studio.math.vector.rotate2d"),
  );
  await mutate("workflow_submit_commands", {
    commands: [
      add("rotate", "studio.math.vector.rotate2d", {}, 320, 300),
      link(uv.id, "uv", "rotate", "value"),
      link("rotate", "value", output.id, "uv"),
    ],
  });
  const joint = await tool("workflow_get_summary");
  await tool("workflow_document_transaction", {
    ...guards(joint),
    expectedDocumentRevision: joint.documentRevision,
    transaction: {
      label: "双阶段命名",
      commands: [
        {
          stage: "vertex",
          type: "RENAME_NODE",
          payload: { nodeId: "rotate", title: "顶点旋转" },
        },
        {
          stage: "fragment",
          type: "RENAME_NODE",
          payload: { nodeId: "color", title: "实例颜色" },
        },
      ],
    },
  });
  await mutate("workflow_undo");
  assert.equal(
    (await tool("workflow_get_summary")).graph.nodes.find(
      (n) => n.id === "rotate",
    ).title,
    "rotate",
  );
  await mutate("workflow_redo");
  assert.equal(
    (await tool("workflow_get_summary")).graph.nodes.find(
      (n) => n.id === "rotate",
    ).title,
    "顶点旋转",
  );
  const exported = await mutate("workflow_export_runtime");
  assert.deepEqual(await tool("workflow_get_generated_sources"), exported);
  assert.equal(Object.keys(exported).length, 3);
  assert.match(exported.java.content, /Vector4f\[\] color/);
  assert.match(exported.vertex.content, /readonly buffer WorkflowParameters/);
  assert.match(exported.fragment.content, /flat in vec4 wf_v_u_color/);
  for (const file of Object.values(exported)) {
    const target = path.resolve(out, file.filename);
    assert.ok(target.startsWith(path.resolve(out) + path.sep));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content);
  }
  await mutate("workflow_save");
  const preview=await previewCases({tool,mutate,guards,out});
  const controls=await compilerCases({tool,mutate,guards,add,link,out});
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        ok: true,
        route: "MCP only after explicit desktop connection/runtime setup",
        tools: list.tools.length,
        controls,
        preview,
        checks: [
          "catalog",
          "guarded graph construction",
          "atomic rejection",
          "both stages",
          "cross-stage transaction",
          "undo/redo",
          "instance array ABI",
          "three-file export",
          "save",
          "For feedback and index, If true/false, custom inout/helper, unsupported target rejection",
        ],
        calls,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: " +
      calls.length +
      " public MCP calls; actual three-file export\n" +
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

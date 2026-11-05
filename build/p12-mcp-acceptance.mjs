// 仅使用公开 MCP，节点、图片及导出全部在内存核对，不读写工作流或插件文件。
import assert from "node:assert/strict";
import { acceptanceSession } from "./final-mcp-acceptance.mjs";
export async function dependencyAcceptance(client) {
  const s = acceptanceSession(client);
  const targets = await s.call("workflow_list_workflows");
  const target = targets.workflows.find((x) => x.kind === "draft");
  await s.call("workflow_select_workflow", { kind: target.kind, id: target.id });
  await s.summary();
  await s.fresh("Dependencies");
  await s.replace([
    s.add("color", "studio.math.constant", { valueType: "VEC4", value: "0.2,0.5,0.9,1" }),
    s.add("output", "io.output", {}, 400, 40),
    s.link("color", "value", "output", "color"),
    { type: "SET_OUTPUT", payload: { nodeId: "output" } },
  ]);
  await s.mutate("workflow_set_vertex_transform", { vertices: [[-128,-128],[128,-128],[-128,128],[128,128]] });
  await s.mutate("workflow_export_runtime_dependency", { runtimePath: "data/p12/runtime" });
  const files = await s.exportEffect(), original = await s.summary();
  await s.frame({ width: 64, height: 64 }, [51,128,230,255]);
  const state = await s.mutate("workflow_get_plugin_status");
  assert.equal(state.plugins.find((p) => p.id === "studio.mcp-connection").bindings["studio.plugins"], "studio.plugin-service");
  assert.match(await s.mutate("workflow_reload_plugin", { id: "local.unregistered" }, true), /未登记|未知插件/);
  assert.match(await s.mutate("workflow_set_plugin_enabled", { id: "studio.workflow-service", enabled: false }, true), /中断/);
  for (let round = 0; round < 3; round++) {
    const impact = await s.mutate("workflow_preview_plugin_disable", { id: "studio.math" });
    assert.equal((await s.mutate("workflow_get_plugin_status")).plugins.find((p) => p.id === "studio.math").enabled, true);
    await s.mutate("workflow_set_plugin_enabled", { id: "studio.math", enabled: false, reviewKey: impact.reviewKey });
    const missing = await s.summary();
    assert.deepEqual(missing.graph.nodes, original.graph.nodes);
    assert.deepEqual(missing.graph.links, original.graph.links);
    assert.equal(missing.dependencyDiagnostics[0].code, "PLUGIN_MISSING");
    await s.mutate("workflow_render_preview", { width: 64, height: 64 }, true);
    await s.mutate("workflow_export_runtime", {}, true);
    await s.command([{ type: "MOVE_NODE", payload: { nodeId: "output", x: 500, y: 60 } }]);
    assert.deepEqual((await s.summary()).graph.links, original.graph.links);
    await s.mutate("workflow_undo");
    await s.mutate("workflow_set_plugin_enabled", { id: "studio.math", enabled: true });
    assert.deepEqual((await s.summary()).dependencyDiagnostics, []);
    assert.deepEqual(await s.exportEffect(), files);
    await s.frame({ width: 64, height: 64 }, [51,128,230,255]);
  }
  const current = await s.call("workflow_get_current"), { graph: vertex, ...geometry } = current.vertexTransform;
  const document = { kind: "studio.document", schemaVersion: 1, documentVersion: "1.0.0", revision: 0, project: { ...current.project, id: "p12_import", title: "P12 依赖恢复" }, graphs: { fragment: current.graph, vertex }, geometry, requiredPlugins: { "studio.math": "1.0.0" } };
  const stable = await s.summary();
  assert.match(await s.mutate("workflow_import", { workflow: { ...document, requiredPlugins: {} } }, true), /requiredPlugins/);
  assert.deepEqual((await s.summary()).graph, stable.graph);
  for (const code of ["PLUGIN_PROVIDER_CONFLICT", "PLUGIN_VERSION_CONFLICT", "PLUGIN_PORT_CONFLICT"]) {
    const broken = structuredClone(document), node = broken.graphs.fragment.nodes.find((n) => n.typeId === "studio.math.constant");
    if (code === "PLUGIN_PROVIDER_CONFLICT") { node.plugin.id = "local.other"; broken.requiredPlugins = { "local.other": "1.0.0" }; }
    if (code === "PLUGIN_VERSION_CONFLICT") { node.plugin.version = "2.0.0"; broken.requiredPlugins = { "studio.math": "2.0.0" }; }
    if (code === "PLUGIN_PORT_CONFLICT") node.portSnapshot.inputs.push({ name: "retired", type: "FLOAT" });
    await s.mutate("workflow_import", { workflow: broken });
    const failed = await s.summary();
    assert.equal(failed.graph.nodes.length, document.graphs.fragment.nodes.length);
    assert.equal(failed.graph.links.length, document.graphs.fragment.links.length);
    assert.equal(failed.dependencyDiagnostics[0].code, code);
    await s.mutate("workflow_export_runtime", {}, true);
    await s.mutate("workflow_save");
    await s.mutate("workflow_open", { id: broken.project.id });
    assert.equal((await s.summary()).dependencyDiagnostics[0].code, code);
  }
  await s.mutate("workflow_import", { workflow: document });
  assert.deepEqual((await s.summary()).dependencyDiagnostics, []);
  await s.frame({ longEdge: 2048 }, [51,128,230,255]);
  await s.exportEffect();
  return { ...s.report(), checks: ["按用户目标流程读取后操作，真实提供者可见，MCP 连接链不可被自身停用", "三轮停用与恢复保留节点连线，缺失节点拒绝预览和导出，恢复后三文件原文一致", "不一致依赖原子拒绝，来源、版本和端口冲突可保存重开并明确诊断，正确来源恢复后高清预览及导出成功"] };
}

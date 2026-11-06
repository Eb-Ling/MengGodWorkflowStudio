// 发布版用户验收只调用公开 MCP，不编辑或保存工作流，不读写工作流文件。
import assert from "node:assert/strict";
import { acceptanceSession } from "./final-mcp-acceptance.mjs";

export async function verifyComponentLibrary(client, projectId) {
  const s = acceptanceSession(client),
    before = await s.summary();
  assert.equal(before.project.id, projectId);
  const id = "custom.glsl",
    ids = [],
    check = (name, args) => s.mutate(name, args);
  const resources = () => s.call("workflow_list_resources");
  const getPlugin = async () =>
    (await check("workflow_get_plugin_status")).plugins.find(
      (p) => p.id === id,
    );
  assert.equal((await getPlugin()).enabled, true);
  const original = (await resources()).customNodes;
  const temp = "custom.glsl.check_" + crypto.randomUUID().replaceAll("-", "");
  const input = {
    title: "同名组件验收",
    parameters: [{ name: "color", type: "VEC4", qualifier: "out" }],
    code: "color = vec4(0.5);",
    sourceTargets: ["glsl-es-300", "glsl-430"],
  };
  try {
    for (const suffix of ["a", "b"]) {
      const typeId = temp + suffix;
      const r = await check("workflow_upsert_custom_node", {
        definition: { ...input, typeId, createOnly: true },
      });
      assert.equal(r.result.typeId, typeId);
      ids.push(typeId);
    }
    await check("workflow_upsert_custom_node", {
      definition: { ...input, typeId: ids[0], code: "color = vec4(0.75);" },
    });
    const impact = await check("workflow_preview_plugin_disable", { id });
    assert.deepEqual(
      impact.stop.map((p) => p.id),
      [id],
    );
    assert.deepEqual(impact.restart, []);
    await check("workflow_set_plugin_enabled", {
      id,
      enabled: false,
      reviewKey: impact.reviewKey,
    });
    assert.equal((await resources()).customNodeEditing, false);
    assert.equal(
      (await s.call("workflow_list_node_types")).catalog.some(
        (n) => n.owner === id,
      ),
      false,
    );
    const missing = await s.summary();
    assert.deepEqual(missing.graph, before.graph);
    assert.deepEqual(
      missing.vertexTransform.graph,
      before.vertexTransform.graph,
    );
    for (const n of before.graph.nodes.filter((n) => n.plugin?.id === id))
      assert.ok(
        missing.dependencyDiagnostics.some(
          (d) => d.nodeId === n.id && d.code === "PLUGIN_MISSING",
        ),
      );
    await s.mutate("workflow_upsert_custom_node", { definition: input }, true);
    await check("workflow_set_plugin_enabled", { id, enabled: true });
    const restored = (await resources()).customNodes;
    assert.equal(
      restored.find((n) => n.typeId === ids[0]).glsl.code,
      "color = vec4(0.75);",
    );
    assert.equal(
      restored.find((n) => n.typeId === ids[1]).glsl.code,
      input.code,
    );
    assert.deepEqual(
      (await s.summary()).dependencyDiagnostics,
      before.dependencyDiagnostics,
    );
    return {
      components: original.length,
      stopped: impact.stop.map((p) => p.id),
      restarted: impact.restart,
      graphPreserved: true,
    };
  } finally {
    if (!(await getPlugin()).enabled)
      await check("workflow_set_plugin_enabled", { id, enabled: true });
    for (const typeId of ids)
      await check("workflow_delete_custom_node", { typeId });
    assert.deepEqual((await resources()).customNodes, original);
  }
}

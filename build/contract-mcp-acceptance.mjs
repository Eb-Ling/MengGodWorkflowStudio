// 最终用户契约验收：只使用公开 MCP，不读写测试数据或调用内部业务对象。
import assert from "node:assert/strict";
import { acceptanceSession } from "./final-mcp-acceptance.mjs";
export async function contractAcceptance(client) {
  const s = acceptanceSession(client);
  const tools = (await client.request("tools/list")).tools;
  const commandSchema = tools.find((t) => t.name === "workflow_submit_commands")
    .inputSchema.properties.commands.items.anyOf;
  const addSchema = commandSchema.find((item) =>
    item.properties.type.enum.includes("ADD_NODE"),
  );
  assert.deepEqual(
    [...addSchema.properties.payload.properties.node.required].sort(),
    ["canvasX", "canvasY", "id", "properties", "typeId"],
  );
  await s.fresh("Contract");
  await s.replace(s.colorGraph());
  const before = await s.summary();
  for (const commands of [
    [
      {
        type: "ADD_NODE",
        payload: { node: { id: "incomplete", typeId: "io.output" } },
      },
    ],
    [{ type: "MOVE_NODE", payload: { nodeId: "color", x: "wrong", y: 0 } }],
    [
      { type: "REMOVE_NODE", payload: { nodeId: "color" } },
      { type: "CONNECT", payload: { link: {} } },
    ],
    [{ type: "SET_PROPERTY", payload: { nodeId: "color", key: "value" } }],
  ]) {
    await s.mutate("workflow_submit_commands", { commands }, true);
    const after = await s.summary();
    assert.deepEqual(after.graph, before.graph);
    assert.equal(after.documentRevision, before.documentRevision);
  }
  await s.call(
    "workflow_document_transaction",
    {
      ...s.guard(before),
      expectedDocumentRevision: before.documentRevision,
      transaction: {
        commands: [
          {
            ...s.add("mustRollback", "studio.math.constant", {
              valueType: "FLOAT",
              value: "1",
            }),
            stage: "vertex",
          },
          {
            type: "MOVE_NODE",
            stage: "fragment",
            payload: { nodeId: "color", x: "wrong", y: 0 },
          },
        ],
      },
    },
    true,
  );
  const after = await s.summary();
  assert.deepEqual(after.vertexTransform.graph, before.vertexTransform.graph);
  assert.deepEqual(after.graph, before.graph);
  await s.file("status");
  await s.file("erase", {}, true);
  await s.mutate("workflow_upsert_custom_node", {}, true);
  await s.mutate("workflow_edit", {
    add: [{ id: "easy", typeId: "studio.math.constant" }],
  });
  const node = (await s.summary()).graph.nodes.find((n) => n.id === "easy");
  assert.ok(Number.isFinite(node.canvasX) && Number.isFinite(node.canvasY));
  assert.ok(node.properties);
  await s.mutate("workflow_edit", { remove: ["easy"] });
  await s.frame({ nodeId: "color", longEdge: 128 }, [51, 128, 230, 255]);
  await s.frame({ nodeId: "color", longEdge: 2048 }, [51, 128, 230, 255]);
  await s.exportEffect();
  s.checks.push(
    "公开 schema 必填项与精确图命令一致，不完整节点、错误数值、缺少字段和混合失败批次不提交，双阶段回滚，便捷编辑自动补默认值，普通/高清图片与原始三文件",
  );
  return s.report();
}

/** 用户明确指定同名目标的不同版本，全部使用公开工具完成选择与核对。 */
export async function targetAcceptance(client) {
  const s = acceptanceSession(client);
  await s.fresh("TargetA");
  await s.replace(s.colorGraph());
  await s.mutate("workflow_save");
  const first = await s.summary();
  await s.mutate("workflow_set_project", { title: "目标恢复草稿" });
  await new Promise((r) => setTimeout(r, 500));
  await s.fresh("TargetB");
  await s.mutate("workflow_set_project", { title: first.project.title });
  await s.mutate("workflow_save");
  const before = await s.summary();
  const list = (await s.call("workflow_list_workflows")).workflows;
  assert.ok(
    list.some((v) => v.kind === "draft" && v.id === before.documentToken),
  );
  assert.equal(
    list.filter((v) => v.kind === "saved" && v.title === first.project.title)
      .length,
    2,
  );
  const recovery = list.find(
    (v) => v.kind === "recovery" && v.title === "目标恢复草稿",
  );
  assert.ok(recovery);
  await s.call(
    "workflow_select_workflow",
    { title: first.project.title },
    true,
  );
  assert.equal((await s.summary()).documentToken, before.documentToken);
  await s.call("workflow_select_workflow", {
    kind: "saved",
    id: first.project.id,
  });
  assert.equal((await s.summary()).project.id, first.project.id);
  await s.call(
    "workflow_submit_commands",
    {
      ...s.guard(before),
      commands: [s.add("wrongTarget", "studio.math.constant")],
    },
    true,
  );
  await s.call(
    "workflow_select_workflow",
    { kind: "draft", id: before.documentToken },
    true,
  );
  await s.call("workflow_select_workflow", {
    kind: "recovery",
    id: recovery.id,
  });
  const selected = await s.summary();
  assert.equal(selected.project.title, "目标恢复草稿");
  await s.mutate("workflow_edit", {
    add: [{ id: "selectedDraftOnly", typeId: "studio.math.constant" }],
  });
  assert.ok(
    (await s.summary()).graph.nodes.some((v) => v.id === "selectedDraftOnly"),
  );
  await s.frame({ nodeId: "color", longEdge: 128 }, [51, 128, 230, 255]);
  s.checks.push(
    "按类型与 ID 选择当前、保存和恢复草稿，同名目标不猜选，跨目标旧守卫拒绝，重新读取后编辑核对",
  );
  return s.report();
}

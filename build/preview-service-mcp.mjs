// 只通过正式 MCP 建图、读取真实 GPU 图片与原始三文件导出，不操作测试文件或私有状态。
import assert from "node:assert/strict";
import { acceptanceSession } from "./final-mcp-acceptance.mjs";
export async function previewServiceAcceptance(client) {
  const s = acceptanceSession(client);
  await s.fresh("PreviewService");
  await s.replace([]);
  await s.mutate("workflow_edit", {
    add: [
      {
        id: "tint",
        typeId: "io.input",
        properties: {
          valueType: "VEC4",
          defaultValue: "0.2,0.5,0.9,1",
          previewEnabled: true,
        },
      },
      { id: "out", typeId: "io.output" },
    ],
    connect: [
      {
        fromNode: "tint",
        fromSocket: "value",
        toNode: "out",
        toSocket: "color",
      },
    ],
    output: "out",
  });
  const status = () => s.mutate("workflow_get_preview_status");
  async function mounted(count) {
    for (let i = 0; i < 8; i++) {
      const value = await status();
      if (value.mountedViews === count) return value;
    }
    assert.fail("预览画布数量没有变为 " + count);
  }
  const active = await mounted(1);
  assert.equal(active.available, true);
  assert.ok(active.draws > 0);
  const before = await s.summary();
  await s.frame(
    { nodeId: "tint", width: 128, height: 64 },
    [51, 128, 230, 255],
  );
  await s.mutate("workflow_open_preview", { nodeId: "tint", longEdge: 2048 });
  let state = await status();
  assert.equal(state.viewerOpen, true);
  assert.equal(state.width, 2048);
  assert.deepEqual(await s.summary(), before);
  assert.equal((await s.mutate("workflow_close_preview")).closed, true);
  state = await status();
  assert.equal(state.viewerOpen, false);
  assert.equal(state.width, 0);
  assert.equal((await s.mutate("workflow_close_preview")).closed, false);
  for (let round = 0; round < 3; round++) {
    await s.mutate("workflow_set_node_property", {
      nodeId: "tint",
      key: "previewEnabled",
      value: false,
    });
    await mounted(0);
    await s.mutate("workflow_set_node_property", {
      nodeId: "tint",
      key: "previewEnabled",
      value: true,
    });
    await mounted(1);
  }
  await s.mutate("workflow_set_project", {
    previewWidth: 256,
    previewHeight: 128,
  });
  const hd = await s.frame(
    { nodeId: "tint", longEdge: 2048 },
    [51, 128, 230, 255],
  );
  assert.equal(hd.height, 1024);
  await s.mutate("workflow_open_preview", { nodeId: "tint" });
  await s.mutate("workflow_set_stage", { targetStage: "vertex" });
  assert.equal((await status()).viewerOpen, false);
  await mounted(0);
  await s.mutate("workflow_set_stage", { targetStage: "fragment" });
  await mounted(1);
  await s.mutate("workflow_render_preview", { nodeId: "missing" }, true);
  await s.mutate("workflow_export_runtime_dependency", {
    runtimePath: "data/preview/runtime",
  });
  const files = await s.exportEffect();
  assert.match(files.java.content, /Vector2f position/);
  await s.mutate("workflow_edit", { remove: ["tint"] });
  await mounted(0);
  return {
    ...s.report(),
    preview:
      "节点画布挂载/释放三轮、普通与高清像素、视框关闭归属、切阶段失效、三文件原始导出",
  };
}

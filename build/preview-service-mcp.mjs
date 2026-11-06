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
  await s.mutate("workflow_edit", {
    add: [{ id: "clock", typeId: "input.time", properties: { defaultValue: "0.25", autoAdvance: false } }],
  });
  await s.mutate("workflow_open_preview", { nodeId: "clock", longEdge: 2048 });
  for (const time of [0.25, 0.75]) {
    await s.mutate("workflow_set_preview_time", { time, playing: false });
    const gray = Math.round(255 * time), color = [gray, gray, gray, 255];
    await s.frame({ nodeId: "clock", width: 112, height: 112 }, color);
    await s.frame({ nodeId: "clock", longEdge: 2048 }, color);
    const paused = await status();
    assert.equal(paused.viewerTime, time);
    assert.equal(paused.viewerPlaying, false);
  }
  await s.mutate("workflow_set_preview_time", { playing: true });
  let animated = await status();
  for (let i = 0; i < 20 && animated.viewerTime <= 0.75; i++) {
    await new Promise((resolve) => setTimeout(resolve, 83));
    animated = await status();
  }
  assert.ok(animated.viewerPlaying && animated.viewerTime > 0.75);
  await s.mutate("workflow_close_preview");
  const closed = await status();
  await new Promise(resolve => setTimeout(resolve, 400));
  const still = await status();
  assert.ok(still.mountedFrames > closed.mountedFrames);
  assert.ok(still.playback.time > closed.playback.time);
  assert.equal(still.viewerCanvasPixels, 0);
  assert.equal(still.pending, 0);
  await s.mutate("workflow_set_preview_time", { playing: false });
  const baseline = await status();
  for (let round = 0; round < 5; round++) {
    await s.mutate("workflow_open_preview", { nodeId: "clock", longEdge: 1024 });
    await s.mutate("workflow_close_preview");
    const end = await status();
    for (const field of ["clockSubscribers","changeSubscribers","mountedViews","programs","textures"])
      assert.equal(end[field], baseline[field], field);
  }
  return {
    ...s.report(),
    preview:
      "节点画布挂载/释放三轮、普通与高清像素、视框关闭归属、切阶段失效、三文件原始导出",
  };
}

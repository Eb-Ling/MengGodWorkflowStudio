// 用户验收仅使用公开 MCP，图片、计时和原始导出都在内存核对。
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { acceptanceSession } from "./final-mcp-acceptance.mjs";

export async function cacheAcceptance(client, { diagnostics = false } = {}) {
  const s = acceptanceSession(client),
    timings = {};
  const targets = await s.call("workflow_list_workflows");
  const draft = targets.workflows.find((x) => x.kind === "draft");
  await s.call("workflow_select_workflow", { kind: draft.kind, id: draft.id });
  await s.summary();
  await s.fresh("CacheProbe");
  await s.replace([
    ...s.colorGraph(),
    s.add("clock", "input.time", {}, 40, 400),
  ]);
  await s.mutate("workflow_set_vertex_transform", {
    vertices: [
      [-128, -128],
      [128, -128],
      [-128, 128],
      [128, 128],
    ],
  });
  await s.mutate("workflow_export_runtime_dependency", {
    runtimePath: "data/p13/runtime",
  });
  const sample = async (name, fn, count = 1) => {
    const values = [];
    for (let i = 0; i < count; i++) {
      const start = performance.now();
      await fn();
      values.push(Math.round((performance.now() - start) * 100) / 100);
    }
    timings[name] = values;
  };
  const before = await s.mutate("workflow_get_preview_status");
  const compilationBefore = diagnostics
    ? await s.mutate("workflow_get_compilation_status")
    : null;
  await sample("firstPreviewMcp", () =>
    s.frame(
      { nodeId: "clock", width: 64, height: 64, time: 0.25 },
      [64, 64, 64, 255],
    ),
  );
  await sample(
    "repeatedPreviewMcp",
    () =>
      s.frame(
        { nodeId: "clock", width: 64, height: 64, time: 0.25 },
        [64, 64, 64, 255],
      ),
    5,
  );
  await s.frame(
    { nodeId: "clock", width: 64, height: 64, time: 0.75 },
    [191, 191, 191, 255],
  );
  await s.frame(
    { nodeId: "clock", longEdge: 2048, time: 0.25 },
    [64, 64, 64, 255],
  );
  const after = await s.mutate("workflow_get_preview_status");
  assert.ok(after.draws > before.draws, "同一程序也必须实际绘制新帧");
  if (diagnostics) {
    assert.ok(after.hits > before.hits);
    assert.ok(after.programBytes <= after.limits.programBytes);
    assert.ok(after.textureBytes <= after.limits.textureBytes);
    const impact = await s.mutate("workflow_preview_plugin_disable", {
      id: "studio.noise",
    });
    await s.mutate("workflow_set_plugin_enabled", {
      id: "studio.noise",
      enabled: false,
      reviewKey: impact.reviewKey,
    });
    const stopped = await s.mutate("workflow_get_preview_status");
    await s.frame(
      { nodeId: "clock", width: 64, height: 64, time: 0.25 },
      [64, 64, 64, 255],
    );
    assert.equal(
      (await s.mutate("workflow_get_preview_status")).misses,
      stopped.misses,
      "无关插件停用不重新编译当前程序",
    );
    await s.mutate("workflow_set_plugin_enabled", {
      id: "studio.noise",
      enabled: true,
    });
    await s.frame({ width: 64, height: 64 });
  }
  let files;
  await sample("firstExportMcp", async () => {
    files = await s.exportEffect();
  });
  await sample(
    "repeatedExportMcp",
    async () => assert.deepEqual(await s.exportEffect(), files),
    5,
  );
  const compilationAfter = diagnostics
    ? await s.mutate("workflow_get_compilation_status")
    : null;
  if (diagnostics) {
    assert.ok(
      compilationAfter.hits > compilationBefore.hits,
      "预览与导出复用编译描述",
    );
    assert.ok(compilationAfter.bytes <= compilationAfter.limits.maxBytes);
    assert.ok(compilationAfter.entries <= compilationAfter.limits.maxEntries);
    assert.equal(compilationAfter.inFlight, 0);
  }
  const plugins = await s.mutate("workflow_get_plugin_status");
  return {
    ...s.report(),
    timings,
    preview: { before, after },
    compilation: { before: compilationBefore, after: compilationAfter },
    plugins: plugins.plugins.map(
      ({ id, enabled, active, activationState }) => ({
        id,
        enabled,
        active,
        activationState,
      }),
    ),
  };
}

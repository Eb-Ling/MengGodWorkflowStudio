// 最终用户验收只接收公开 MCP 客户端，不读写磁盘，不调用应用私有对象。
import assert from "node:assert/strict";
import { acceptanceSession } from "./final-mcp-acceptance.mjs";

export async function extensionAcceptance(client, { rounds = 3 } = {}) {
  const s = acceptanceSession(client),
    id = "example.sdk-effect";
  const targets = await s.call("workflow_list_workflows"),
    target = targets.workflows.find((x) => x.kind === "draft");
  assert.ok(target);
  await s.call("workflow_select_workflow", {
    kind: target.kind,
    id: target.id,
  });
  await s.summary();
  const authorized = (await s.mutate("workflow_list_authorized_plugins")).find(
    (p) => p.id === id,
  );
  assert.ok(authorized, "需要用户先在插件中心批准教学目录");
  assert.equal(Object.hasOwn(authorized, "directory"), false);
  const registration = { id, authorizationId: authorized.authorizationId };
  if (!authorized.registered)
    await s.mutate("workflow_register_authorized_plugin", registration);
  const inspectPanels = () => s.mutate("workflow_get_plugin_panels", { id });
  const assertPanel = async () => {
    const panels = (await inspectPanels()).panels;
    assert.equal(panels.length, 1);
    assert.equal(panels[0].id, id + ".guide");
    assert.ok(
      panels[0].controls.some(
        (c) => c.id === "add-tint" && c.type === "button",
      ),
    );
    assert.ok(
      panels[0].controls.every(
        (c) => Object.keys(c).sort().join(",") === "id,type",
      ),
    );
  };
  await assertPanel();
  const installed = (await s.mutate("workflow_get_plugin_status")).plugins.find(
    (p) => p.id === id,
  );
  assert.equal(installed.enabled, true);
  assert.equal(installed.bindings["workflow.nodes"], "studio.node-model");
  assert.equal(
    installed.bindings["studio.extension-ui"],
    "studio.extension-ui",
  );
  await s.fresh("SdkEffect");
  await s.mutate("workflow_set_vertex_transform", {
    vertices: [
      [-128, -128],
      [128, -128],
      [-128, 128],
      [128, 128],
    ],
  });
  await s.mutate("workflow_edit", {
    remove: (await s.summary()).graph.nodes.map((n) => n.id),
    add: [
      { id: "my_blue", typeId: id + ".tint" },
      { id: "fragment_output", typeId: "io.output" },
    ],
    connect: [
      {
        fromNode: "my_blue",
        fromSocket: "color",
        toNode: "fragment_output",
        toSocket: "color",
      },
    ],
    output: "fragment_output",
  });
  await s.mutate("workflow_set_stage", { targetStage: "vertex" });
  await s.mutate("workflow_edit", {
    add: [{ id: "my_scale", typeId: id + ".scale" }],
    disconnect: [
      {
        fromNode: "position",
        fromSocket: "value",
        toNode: "output",
        toSocket: "position",
      },
    ],
    connect: [
      {
        fromNode: "position",
        fromSocket: "value",
        toNode: "my_scale",
        toSocket: "value",
      },
      {
        fromNode: "my_scale",
        fromSocket: "value",
        toNode: "output",
        toSocket: "position",
      },
    ],
  });
  await s.mutate("workflow_set_stage", { targetStage: "fragment" });
  await s.mutate("workflow_export_runtime_dependency", {
    runtimePath: "data/p14/runtime",
  });
  const original = await s.summary(),
    files = await s.exportEffect();
  assert.match(files.vertex.content, /my_scale/);
  assert.match(files.fragment.content, /my_blue/);
  assert.match(files.java.content, /import data.p14.runtime.WorkflowRuntime/);
  await s.frame({ width: 256, height: 256 }, [51, 128, 230, 255]);
  await s.mutate("workflow_open_preview", { longEdge: 2048 });
  await s.frame({ longEdge: 2048 }, [51, 128, 230, 255]);
  await s.mutate("workflow_close_preview");
  await s.mutate("workflow_save");
  for (let i = 0; i < rounds; i++) {
    const impact = await s.mutate("workflow_preview_plugin_disable", { id });
    await s.mutate("workflow_set_plugin_enabled", {
      id,
      enabled: false,
      reviewKey: impact.reviewKey,
    });
    assert.deepEqual((await inspectPanels()).panels, []);
    const missing = await s.summary();
    assert.deepEqual(missing.graph.nodes, original.graph.nodes);
    assert.deepEqual(missing.graph.links, original.graph.links);
    assert.deepEqual(
      missing.vertexTransform.graph,
      original.vertexTransform.graph,
    );
    assert.ok(
      missing.dependencyDiagnostics.some((d) => d.code === "PLUGIN_MISSING"),
    );
    await s.mutate("workflow_render_preview", { width: 64, height: 64 }, true);
    await s.mutate("workflow_export_runtime", {}, true);
    await s.mutate("workflow_remove_plugin", { id });
    assert.equal(
      (await s.mutate("workflow_get_plugin_status")).plugins.some(
        (p) => p.id === id,
      ),
      false,
    );
    assert.deepEqual((await inspectPanels()).panels, []);
    assert.equal(
      (await s.mutate("workflow_list_authorized_plugins")).find(
        (p) => p.id === id,
      ).registered,
      false,
    );
    await s.mutate(
      "workflow_register_authorized_plugin",
      { ...registration, authorizationId: "invalid" },
      true,
    );
    await s.mutate("workflow_register_authorized_plugin", registration);
    await assertPanel();
    assert.deepEqual((await s.summary()).dependencyDiagnostics, []);
    assert.deepEqual(await s.exportEffect(), files);
    await s.frame({ width: 256, height: 256 }, [51, 128, 230, 255]);
  }
  await s.mutate("workflow_reload_plugin", { id });
  await assertPanel();
  assert.deepEqual(await s.exportEffect(), files);
  await s.frame({ longEdge: 2048 }, [51, 128, 230, 255]);
  assert.match(
    await s.mutate(
      "workflow_remove_plugin",
      { id: "studio.workflow-service" },
      true,
    ),
    /中断/,
  );
  return {
    ...s.report(),
    document: {
      graph: original.graph,
      vertexGraph: original.vertexTransform.graph,
    },
    plugin: { id, fingerprint: installed.fingerprint },
    checks: [
      "用户批准目录通过公开 MCP 登记，节点规则与面板均来自独立插件",
      "双阶段用户 ID、256 正方形和 2048 高清图，单点 Vector2f 三文件与自定义依赖包路径",
      `${rounds} 轮停用、移除、重新登记保留双阶段节点连线，缺失拒绝渲染导出，恢复后原文与像素一致`,
      "面板贡献释放与恢复、无效授权拒绝、连接链保护、公开重载",
    ],
  };
}

/** 应用重启由外部进程生命周期负责，这里只使用原公开客户端和已保存目标。 */
export async function restoredExtensionAcceptance(
  client,
  expected,
  { missing = false } = {},
) {
  const s = acceptanceSession(client),
    id = "example.sdk-effect";
  const list = await s.call("workflow_list_workflows");
  assert.ok(
    list.workflows.some(
      (w) => w.kind === "saved" && w.id === "final_SdkEffect",
    ),
  );
  await s.call("workflow_select_workflow", {
    kind: "saved",
    id: "final_SdkEffect",
  });
  const summary = await s.summary();
  assert.deepEqual(summary.graph, expected.document.graph);
  assert.deepEqual(
    summary.vertexTransform.graph,
    expected.document.vertexGraph,
  );
  const grant = (await s.mutate("workflow_list_authorized_plugins")).find(
    (p) => p.id === id,
  );
  assert.equal(grant.registered, !missing);
  if (missing) {
    assert.ok(
      summary.dependencyDiagnostics.some((d) => d.code === "PLUGIN_MISSING"),
    );
    assert.deepEqual(
      (await s.mutate("workflow_get_plugin_panels", { id })).panels,
      [],
    );
    await s.mutate("workflow_register_authorized_plugin", {
      id,
      authorizationId: grant.authorizationId,
    });
  }
  assert.deepEqual((await s.summary()).dependencyDiagnostics, []);
  assert.equal(
    (await s.mutate("workflow_get_plugin_panels", { id })).panels.length,
    1,
  );
  await s.exportEffect();
  await s.frame({ longEdge: 2048 }, [51, 128, 230, 255]);
  const report = s.report();
  assert.deepEqual(report.exports[0].files, expected.exports[0].files);
  assert.equal(
    report.frames[0].hash,
    expected.frames.find((f) => f.width === 2048).hash,
  );
  return {
    ...report,
    checks: [
      missing
        ? "移除后重启保留授权，重新登记恢复全部节点、原文和高清图"
        : "重启复用原 MCP 配置，登记、面板、节点、原文和高清图恢复",
    ],
  };
}

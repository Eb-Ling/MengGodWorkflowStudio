import test from "node:test";
import assert from "node:assert/strict";
import { OperationRegistry, createCommandGateway } from "../packages/kernel/index.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { templatesPlugin, instantiate } from "../plugins/templates/index.mjs";
import { autoLayoutPlugin } from "../plugins/layout/index.mjs";
import { planLayout } from "../plugins/layout/plan.mjs";
import {
  branchOwner,
  branchSide,
} from "../packages/workflow-tools/regions.mjs";
import {
  enlargedSize,
  templateOperations,
  layoutOperations,
} from "../packages/workflow-tools/index.mjs";
import { createPreviewController } from "../plugins/preview/controller.mjs";
import { fitView, zoomView } from "../plugins/preview/view-transform.mjs";
const node = (id, x, y, typeId = "input.uv", properties = {}) => ({
  id,
  typeId,
  canvasX: x,
  canvasY: y,
  properties,
});
test("通用动作结果是请求专属副本，异步序列化失败返回拒绝而非未捕获异常", async () => {
  const state = {
      project: { id: "p" },
      documentToken: "d",
      stage: "fragment",
      graph: { revision: 0 },
    },
    data = { value: [1] };
  const request = {
    documentId: "p",
    documentToken: "d",
    stage: "fragment",
    expectedRevision: 0,
    actions: [{ type: "AUTO_LAYOUT", payload: {} }],
  };
  const gateway = createCommandGateway({
    snapshot: () => state,
    action: async () => data,
  });
  const result = await gateway.execute(request);
  result.result.value[0] = 4;
  assert.equal(data.value[0], 1);
  assert.equal(state.result, undefined);
  const failed = createCommandGateway({
    snapshot: () => state,
    action: async () => ({ bad: 1n }),
  });
  assert.equal((await failed.execute(request)).ok, false);
});
test("高清像素保持横竖比，指针缩放锚点不漂移，适应窗口留边", () => {
  assert.deepEqual(enlargedSize(1024, 512, 2048), {
    width: 2048,
    height: 1024,
  });
  assert.deepEqual(enlargedSize(300, 840, 4096), { width: 1463, height: 4096 });
  assert.throws(() => enlargedSize(0, 100, 2048));
  const fit = fitView(2048, 1024, 1032, 532);
  assert.deepEqual(fit, { scale: 1000 / 2048, x: 16, y: 16 });
  const anchor = { x: 200, y: 150 },
    next = zoomView(fit, 2, anchor);
  assert.equal(
    (anchor.x - fit.x) / fit.scale,
    (anchor.x - next.x) / next.scale,
  );
  assert.equal(
    (anchor.y - fit.y) / fit.scale,
    (anchor.y - next.y) / next.scale,
  );
});
test("布局对有环连线可终止，If/For 与嵌套、重叠区域保持成员及分支", () => {
  const graph = {
    nodes: [
      node("if", 0, 0, "logic.if"),
      node("a", 20, 80),
      node("loop", 470, 80, "logic.for", { width: 300, height: 200 }),
      node("b", 500, 150),
      node("var", 950, 450, "logic.variable"),
      node("outer", 1400, 500),
    ],
    links: [
      { fromNode: "a", toNode: "b" },
      { fromNode: "b", toNode: "var" },
      { fromNode: "var", toNode: "outer" },
      { fromNode: "outer", toNode: "var" },
    ],
  };
  const original = structuredClone(graph);
  for (const direction of ["LR", "TB"]) {
    const result = planLayout({ graph, direction }),
      moved = {
        ...graph,
        nodes: graph.nodes.map((n) => {
          const p = result.positions.find((p) => p.nodeId === n.id);
          return { ...n, canvasX: p.x, canvasY: p.y };
        }),
      };
    assert.equal(result.positions.length, 6);
    for (const n of graph.nodes) {
      const before = branchOwner(graph, n),
        after = branchOwner(
          moved,
          moved.nodes.find((p) => p.id === n.id),
        );
      assert.equal(before?.id, after?.id);
      if (before)
        assert.equal(
          branchSide(before, n),
          branchSide(
            after,
            moved.nodes.find((p) => p.id === n.id),
          ),
        );
    }
    assert.deepEqual(planLayout({ graph, direction }), result);
  }
  assert.deepEqual(graph, original);
  assert.throws(() => planLayout({ graph, gapX: NaN }));
  assert.throws(() => planLayout({ graph, direction: "up" }));
});
test("模板重映射全部内部端点，保存数据隔离，坏连线在提交前拒绝", () => {
  const graph = {
    nodes: [node("a", 10, 20), node("b", 50, 60)],
    links: [{ fromNode: "a", fromSocket: "uv", toNode: "b", toSocket: "uv" }],
  };
  const a = instantiate(graph, 0, 0),
    b = instantiate(graph, 0, 0, a.nodeIds);
  assert.notEqual(a.nodeIds[0], b.nodeIds[0]);
  assert.equal(a.commands[0].payload.node.canvasX, 0);
  assert.equal(a.commands[2].payload.link.fromNode, a.nodeIds[0]);
  assert.equal(graph.nodes[0].id, "a");
  assert.throws(() =>
    instantiate({ ...graph, links: [{ fromNode: "bad", toNode: "b" }] }),
  );
});
test("模板与布局仅靠公开宿主挂载，三轮启停无操作残留，展开与布局各只提交一次事务", async () => {
  const host = new PluginRuntime(),
    registry = new OperationRegistry(),
    calls = [];
  let saved = [];
  const snapshot = {
    project: { id: "p" },
    documentToken: "d",
    stage: "fragment",
    documentRevision: 0,
    graph: { revision: 0, nodes: [node("uv", 10, 10)], links: [] },
    selection: ["uv"],
  };
  snapshot.document = { graphs: { fragment: snapshot.graph, vertex: { nodes: [], links: [] } } };
  host.provide("workflow.editor", "1.0.0", {
    snapshot: () => structuredClone(snapshot),
    execute: (r) => {
      calls.push(r);
      return { ok: true };
    },
  });
  host.provide(
    "workflow.operations",
    "1.0.0",
    (owner, own) => registry.createApi(owner, own),
    true,
  );
  host.provide("workflow.template-storage", "1.0.0", {
    read: () => structuredClone(saved),
    write: (x) => {
      saved = structuredClone(x);
    },
  });
  host.register(templatesPlugin);
  host.register(autoLayoutPlugin);
  for (let i = 0; i < 3; i++) {
    await host.setEnabled("studio.layout", true);
    await host.setEnabled("studio.templates", true);
    const item = registry.execute(templateOperations.save, {
      title: "模板" + i,
    });
    const count = calls.length;
    registry.execute(templateOperations.expand, { id: item.id, x: 0, y: 0 });
    registry.execute(layoutOperations.arrange, {});
    assert.equal(calls.length, count + 2);
    assert.equal(calls.at(-2).commands[0].payload.node.canvasX, 0);
    await host.setEnabled("studio.templates", false);
    assert.equal(registry.has(layoutOperations.plan), true);
    assert.throws(() => registry.execute(templateOperations.list, {}));
    await host.setEnabled("studio.layout", false);
    assert.equal(registry.list().length, 0);
  }
  assert.equal(saved.length, 3);
  await host.dispose();
});
function previewFixture() {
  let notify = () => {},
    disposed = 0,
    finish;
  const state = {
    documentToken: "one",
    documentRevision: 1,
    catalogRevision: 0,
    stage: "fragment",
    project: { id: "p", previewWidth: 1024, previewHeight: 512 },
    fragmentGraph: { nodes: [node("uv", 0, 0)], links: [] },
    vertexTransform: { graph: { nodes: [], links: [] } },
    catalog: [{ typeId: "input.uv", outputs: [{ name: "uv" }] }],
  };
  const workflow = {
      snapshot: () => structuredClone(state),
      subscribe: (fn) => {
        notify = fn;
        return () => {
          notify = () => {};
        };
      },
    },
    model = {};
  const renderer = {
    render: async (request, receive) => {
      await new Promise((r) => {
        finish = r;
      });
      return receive({
        width: request.width,
        height: request.height,
        surface: { toDataURL: () => "data:image/png;base64,test" },
      });
    },
    status: () => ({ available: true }),
    dispose() {
      disposed++;
    },
  };
  const controller = createPreviewController({
    workflow,
    renderer,
    surfaces: { present: () => true, error() {} },
    model,
  });
  return {
    state,
    model,
    controller,
    finish: () => finish(),
    notify: () => notify(),
    disposed: () => disposed,
  };
}
test("高清视框关闭、换文档和停用时拒绝迟到结果，失效帧不能复活窗口", async () => {
  const f = previewFixture(),
    pending = f.controller.open({ nodeId: "uv" });
  assert.equal(f.model.visible, true);
  f.controller.close();
  f.finish();
  assert.equal((await pending).opened, false);
  assert.equal(f.model.dataUrl, "");
  const p = f.controller.frame({ nodeId: "uv" });
  f.state.documentRevision++;
  f.finish();
  await assert.rejects(p, /过期/);
  const p2 = f.controller.open({ nodeId: "uv" });
  f.controller.dispose();
  f.controller.dispose();
  f.finish();
  await assert.rejects(p2, /停用/);
  assert.equal(f.disposed(), 1);
  assert.equal(f.model.visible, false);
});
test("视框重新选择清晰度覆盖打开时的 longEdge，保持原始宽高比", async () => {
  const f = previewFixture();
  const initial = f.controller.open({ nodeId: "uv", longEdge: 1024 });
  f.finish(); await initial;
  assert.equal(f.model.width, 1024);
  f.model.longEdge = 4096;
  const changed = f.controller.refresh(); f.finish(); await changed;
  assert.equal(f.model.width, 4096); assert.equal(f.model.height, 2048);
  f.controller.dispose();
});
test("节点插件变化使当前文档和显式文档的在途预览失效，恢复后可重新请求", async () => {
  const f = previewFixture();
  const document = {
    config: f.state.project,
    fragment: f.state.fragmentGraph,
    geometry: f.state.vertexTransform,
  };
  for (const input of [{}, { document }]) {
    const stale = f.controller.frame(input);
    f.state.catalogRevision++;
    f.finish();
    await assert.rejects(stale, /节点插件已变化/);
    const fresh = f.controller.frame(input);
    f.finish();
    assert.match((await fresh).dataUrl, /^data:image\/png/);
  }
  f.controller.dispose();
});

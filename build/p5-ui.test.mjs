import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceState } from "../plugins/ui/workspace-registry.ts";
import { createPresentationApi } from "../plugins/workflow-service/presentation.mjs";
import { createGraphSemantics } from "../packages/workflow-tools/graph-semantics.mjs";
import { mathContribution } from "../plugins/math/contribution.mjs";
import { tintContribution } from "../plugins/example-showcase/tint-node.mjs";
import { createViewSession } from "../plugins/workflow-ui/session.mjs";
const { createWorkspaceRegistration, workspaceViews, resolveRenderer } =
  createWorkspaceState();
const component = { render: () => null };
function owner(id) {
  const cleanups = [];
  return {
    api: createWorkspaceRegistration(id, (c) => cleanups.push(c)),
    dispose: () =>
      cleanups
        .splice(0)
        .reverse()
        .forEach((c) => c()),
  };
}
test("P5 插槽独占、命名空间和卸载后撤销，旧句柄不删除新视图", () => {
  const a = owner("test.a"),
    b = owner("test.b");
  try {
    assert.throws(
      () => a.api.addView({ id: "test.b.view", slot: "graph", component }),
      /命名空间/,
    );
    const first = a.api.addView({
      id: "test.a.view",
      slot: "graph",
      component,
    });
    assert.throws(
      () => b.api.addView({ id: "test.b.view", slot: "graph", component }),
      /占用/,
    );
    first.dispose();
    const replacement = a.api.addView({
      id: "test.a.view",
      slot: "graph",
      component,
    });
    first.dispose();
    assert.equal(workspaceViews.value.length, 1);
    replacement.dispose();
    a.dispose();
    assert.throws(
      () => a.api.addView({ id: "test.a.view", slot: "graph", component }),
      /撤销/,
    );
  } finally {
    a.dispose();
    b.dispose();
  }
});
test("P5 精确渲染器覆盖通配项、声明隔离和三轮启停恢复默认项", () => {
  const base = owner("test.base");
  base.api.addRenderer({
    id: "test.base.node",
    kind: "node",
    typeIds: ["*"],
    priority: 99,
    component,
  });
  try {
    for (let i = 0; i < 3; i++) {
      const a = owner("test.ext"),
        types = ["example.tint"];
      a.api.addRenderer({
        id: "test.ext.tint",
        kind: "node",
        typeIds: types,
        component,
      });
      types[0] = "changed";
      assert.equal(resolveRenderer("node", "example.tint").id, "test.ext.tint");
      assert.equal(resolveRenderer("node", "changed").id, "test.base.node");
      assert.throws(
        () =>
          a.api.addRenderer({
            id: "test.ext.duplicate",
            kind: "node",
            typeIds: ["example.tint"],
            component,
          }),
        /重复/,
      );
      assert.throws(
        () =>
          a.api.addRenderer({
            id: "test.ext.bad",
            kind: "field",
            typeIds: [""],
            component,
          }),
        /无效/,
      );
      a.dispose();
      assert.equal(
        resolveRenderer("node", "example.tint").id,
        "test.base.node",
      );
    }
  } finally {
    base.dispose();
  }
  assert.equal(resolveRenderer("node", "example.tint"), undefined);
});
function fixture() {
  const catalog = mathContribution().nodes,
    graph = {
      nodes: [
        {
          id: "constant",
          typeId: "studio.math.constant",
          title: "常量",
          canvasX: 10,
          canvasY: 20,
          properties: { valueType: "VEC3", value: "1,2,3" },
        },
      ],
      links: [],
      revision: 0,
    };
  const data = {
    project: { id: "project" },
    documentToken: "open-1",
    stage: "fragment",
    graph,
    catalog,
    selection: ["constant"],
    vertexTransform: { parameterModes: {} },
  };
  const semantics = createGraphSemantics(
    () => catalog,
    () => data.stage,
  );
  const presentation = createPresentationApi({
    snapshot: () => structuredClone(data),
    semantics,
    parameters: {
      list: () => [],
      effectiveScope: () => "shared",
      name: (node) => node.id,
    },
    describeNode: (d) => d.title,
    report() {},
    activity() {},
  });
  return { data, presentation };
}
test("P5 插件数值字段遵循 schema、空值与越界拒绝，复杂字段保留 JSON 类型", () => {
  const catalog = tintContribution().nodes,
    semantics = createGraphSemantics(
      () => catalog,
      () => "fragment",
    );
  const node = {
    typeId: catalog[0].typeId,
    properties: { ...catalog[0].properties },
  };
  const check = (value) =>
    semantics.validateNodeProperty(node, catalog[0], "red", value);
  assert.deepEqual(check("0.75"), { valid: true, value: 0.75 });
  assert.equal(check("").valid, false);
  assert.equal(check("1.1").valid, false);
  assert.equal(check("NaN").valid, false);
  node.properties.points = [1, 2];
  const definition = {
    ...catalog[0],
    propertySchema: {
      properties: { points: { type: "array", items: { type: "number" } } },
    },
  };
  assert.deepEqual(
    semantics.validateNodeProperty(node, definition, "points", "[3,4]").value,
    [3, 4],
  );
  assert.equal(
    semantics.validateNodeProperty(node, definition, "points", '["bad"]').valid,
    false,
  );
});
test("P5 检查器投影为独立数据，编辑意图不直接写文档", () => {
  const { data, presentation } = fixture(),
    view = presentation.snapshot();
  view.nodes[0].node.properties.value = "9,9,9";
  assert.equal(data.graph.nodes[0].properties.value, "1,2,3");
  const result = presentation.edit({
    nodeId: "constant",
    key: "value",
    value: ".1,.2,.3",
  });
  assert.equal(result.commands[0].payload.value, "0.1, 0.2, 0.3");
  assert.equal(data.graph.revision, 0);
  assert.throws(
    () => presentation.edit({ nodeId: "constant", key: "value", value: "1,2" }),
    /3|vec3|VEC3/,
  );
  assert.throws(
    () =>
      presentation.edit({
        nodeId: "constant",
        key: "parameterId",
        value: "invalid-name",
      }),
    /参数 ID/,
  );
  assert.throws(
    () =>
      presentation.edit({ nodeId: "removed", key: "$title", value: "不存在" }),
    /不存在/,
  );
});
test("P5 字段编辑携带规范化类型意图，不丢失已有实例参数作用域", () => {
  const { data, presentation } = fixture();
  data.vertexTransform.parameterModes.other = "instance";
  const type = presentation.edit({
    nodeId: "constant",
    key: "valueType",
    value: "FLOAT",
  });
  assert.equal(type.commands.length, 2);
  assert.equal(type.commands[1].payload.value, "0");
  const scope = presentation.edit({
    nodeId: "constant",
    key: "$scope",
    value: "instance",
  });
  assert.deepEqual(scope.actions[0].payload.parameterModes, {
    other: "instance",
    constant: "instance",
  });
  assert.deepEqual(data.vertexTransform.parameterModes, { other: "instance" });
});
test("P5 会话使用最新修订，拒绝旧文档回调，切阶段清空局部编辑并撤销订阅", async () => {
  const { data, presentation } = fixture(),
    subscribers = new Set(),
    opsSubscribers = new Set(),
    calls = [];
  const workflow = {
    inspect: () => presentation.snapshot(),
    report: message => presentation.report({message}),
    snapshot: () => structuredClone(data),
    subscribe: (f) => {
      subscribers.add(f);
      return () => subscribers.delete(f);
    },
    execute: async (request) => {
      calls.push(request);
      return request.documentToken === data.documentToken &&
        request.expectedRevision === data.graph.revision
        ? { ok: true }
        : { ok: false, error: "过期工作流" };
    },
  };
  const session = createViewSession({
    workflow,
    presentation,
    operations: {
      list: () => [],
      subscribe: (f) => {
        opsSubscribers.add(f);
        return () => opsSubscribers.delete(f);
      },
    },
    targets: {},
    ui: {},
    preferences: { get: () => null, set() {} },
  });
  await Promise.resolve();
  const original = session.snapshot.value;
  assert.throws(() => {
    original.graph.nodes[0].title = "越权";
  }, TypeError);
  data.graph.revision++;
  await session.batch([
    { type: "RENAME_NODE", payload: { nodeId: "constant", title: "新名字" } },
  ]);
  assert.equal(calls.at(-1).expectedRevision, 1);
  data.documentToken = "open-2";
  await assert.rejects(session.execute({ commands: [] }, original), /过期/);
  session.model.custom = { draft: true };
  data.stage = "vertex";
  for (const f of subscribers) f();
  await Promise.resolve();
  assert.equal(session.model.custom, null);
  assert.equal(session.snapshot.value.stage, "vertex");
  session.dispose();
  assert.equal(subscribers.size, 0);
  assert.equal(opsSubscribers.size, 0);
  await assert.rejects(
    session.batch([{ type: "DELETE_NODE", payload: { nodeId: "constant" } }]),
    /停用/,
  );
});

test("三个节点连续平移只更新一层变换，不量端口、不读新快照，松开只提交一次", async () => {
  const { createGraphGestures } = await import("../plugins/workflow-ui/gestures.ts");
  const { createRenderer, shallowRef, h } = await import("vue");
  const listeners = new Map(), frames = new Map(), submissions = [];
  const prior = Object.fromEntries(["window","requestAnimationFrame","cancelAnimationFrame"].map(k => [k, globalThis[k]]));
  let frame = 0, measured = 0, session, app;
  try {
    globalThis.window = { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
    globalThis.requestAnimationFrame = fn => (frames.set(++frame, fn), frame);
    globalThis.cancelAnimationFrame = id => frames.delete(id);
    const viewport = { focus() {}, setPointerCapture() {}, hasPointerCapture: () => false,
      getBoundingClientRect() { throw Error("平移不应读取布局"); } };
    const snapshot = shallowRef({ view: { x: 0, y: 0, zoom: 0.6 }, graph: { nodes: [{id:"a"},{id:"b"},{id:"c"}] }, selection: [] });
    const s = { snapshot, model: {}, workflow: { activity() {}, snapshot() { throw Error("平移不应读取文档"); } },
      action: async (name, value) => { submissions.push([name, {...value}]); snapshot.value = { ...snapshot.value, view: {...value} }; } };
    const renderer = createRenderer({ createElement: () => ({}), insert() {}, patchProp() {}, remove() {}, setElementText() {} });
    app = renderer.createApp({ setup() { session = createGraphGestures(s, {value:viewport}, () => measured++); return () => h("div"); } });
    app.mount({});
    const event = (x,y) => ({ pointerId:1, button:0, clientX:x, clientY:y, target:{closest:()=>null}, preventDefault(){} });
    session.background(event(100,100));
    for (let i=1; i<=90; i++) listeners.get("pointermove")(event(100+i,100+i));
    assert.equal(frames.size,1);
    [...frames.values()][0]();
    assert.deepEqual({...session.view.value},{x:90,y:90,zoom:0.6});
    assert.equal(submissions.length,0);
    await listeners.get("pointerup")(event(193,192));
    assert.deepEqual(submissions,[["SET_VIEW",{x:93,y:92,zoom:0.6}]]);
    assert.equal(measured,0);
  } finally {
    app?.unmount();
    for (const [k,v] of Object.entries(prior)) if (v === undefined) delete globalThis[k]; else globalThis[k]=v;
  }
});

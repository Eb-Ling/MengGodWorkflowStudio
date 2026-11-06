import test from "node:test";
import assert from "node:assert/strict";
import { previewVertex } from "../plugins/compiler/preview.mjs";
import { normalizeTransform } from "../packages/workflow-tools/geometry.mjs";
import { pipelineHarness } from "./compiler-pipeline-support.mjs";
import { createNodeContributions } from "../frontend/application/node-contributions.js";
import { createNodeCatalog } from "../plugins/node-model/node-catalog.mjs";
import { createComponentLibrary } from "../plugins/custom-nodes/library.mjs";
import { defineGlslNode } from "../packages/plugin-sdk/glsl-node.mjs";
import { adoptCustomSettings } from "../frontend/project/adopt-custom-components.mjs";
import { createPluginSettings } from "../frontend/application/plugin-settings.mjs";
import { readWorkflowDocument } from "../packages/workflow-tools/custom-component-import.mjs";
import { createDocument } from "../packages/plugin-sdk/document.mjs";
import { memory } from "./layer-test-support.mjs";

const p = { name: "value", type: "FLOAT", qualifier: "inout" };
const targets = ["glsl-es-300", "glsl-430"];
const draft = {
  title: "发光",
  parameters: [p],
  code: "value += 0.5;",
  sourceTargets: targets,
};
function start(settings) {
  const c = createNodeContributions(createNodeCatalog()),
    cleanup = [];
  const lib = createComponentLibrary(
    c.createApi("custom.glsl", (fn) => cleanup.push(fn)),
    settings,
  );
  return {
    c,
    lib,
    stop() {
      for (const fn of cleanup.reverse()) fn();
      c.dispose();
    },
  };
}
test("同名组件各自登记，编辑、写入失败、释放和重新启用都不影响其他组件", () => {
  const storage = memory(),
    settings = createPluginSettings(storage, "custom.glsl");
  const { c, lib, stop } = start(settings);
  const a = lib.upsert(draft).typeId,
    b = lib.upsert(draft).typeId;
  assert.notEqual(a, b);
  assert.throws(
    () => lib.upsert({ ...draft, typeId: a, createOnly: true }),
    /已存在/,
  );
  const other = c.registry.identity([b]);
  const states = [],
    off = c.registry.subscribe(() => states.push(c.registry.owner(a)));
  lib.upsert({ ...draft, typeId: a, code: "value *= 2.0;" });
  assert.deepEqual(states, [{ id: "custom.glsl", version: "1.0.0" }]);
  assert.deepEqual(c.registry.identity([b]), other);
  const identity = c.registry.identity([a]);
  assert.throws(
    () => lib.upsert({ ...draft, typeId: a, sourceTargets: [] }),
    /目标/,
  );
  assert.throws(
    () => lib.upsert({ ...draft, typeId: "someone.other.tint" }),
    /命名空间/,
  );
  const write = settings.set;
  settings.set = () => {
    throw Error("quota");
  };
  assert.throws(() => lib.upsert({ ...draft, typeId: a }), /quota/);
  assert.deepEqual(c.registry.identity([a]), identity);
  settings.set = write;
  assert.throws(() => lib.remove("someone.other.tint"));
  lib.remove(b);
  off();
  stop();
  const restored = start(settings);
  assert.equal(restored.c.registry.get(a).glsl.code, "value *= 2.0;");
  assert.equal(restored.c.registry.get(b), null);
  restored.stop();
});
test("UI 与异名目录插件的函数共用输出，双阶段双目标支持 inout、辅助函数与缺失诊断", () => {
  const h = pipelineHarness(),
    a = "custom.glsl.radialFade",
    d = h.registry.get(a);
  const external = "example.unrelated.tint";
  const handle = h
    .createApi("example.unrelated")
    .register({ nodes: [{ ...d, typeId: external }], compilers: [] });
  const graph = (typeId) => ({
    revision: 0,
    nodes: [{ id: "one", typeId, properties: {}, canvasX: 0, canvasY: 0 }],
    links: [],
    outputNodeId: "one",
  });
  for (const target of targets)
    for (const stage of ["fragment", "vertex"]) {
      const source = (id) => {
        const g = graph(id);
        if (stage === "fragment") return h.fragmentSource(g, target);
        const geometry = normalizeTransform();
        const vertex = geometry.graph;
        const position = vertex.links.find((l) => l.toSocket === "position");
        Object.assign(position, { fromNode: "scale", fromSocket: "value" });
        vertex.nodes.push(...g.nodes, {
          id: "scale",
          typeId: "studio.math.vector.scale",
          canvasX: 0,
          canvasY: 1,
          properties: { valueType: "VEC2" },
        });
        vertex.links.push(
          {
            fromNode: "position",
            fromSocket: "value",
            toNode: "scale",
            toSocket: "value",
          },
          {
            fromNode: "one",
            fromSocket: "value",
            toNode: "scale",
            toSocket: "scale",
          },
        );
        return h.emit(
          previewVertex(h.lower(vertex, target, stage), geometry),
          target,
        );
      };
      assert.equal(source(a), source(external));
    }
  const bad = { ...d, typeId: external, outputs: [] };
  assert.throws(() => handle.replace({ nodes: [bad], compilers: [] }), /端口/);
  assert.equal(h.registry.get(external).title, d.title);
  const constrained = defineGlslNode({
    typeId: external,
    title: "函数",
    targets: ["glsl-430"],
    glsl: {
      name: "my_value",
      parameters: [p],
      code: "value = halfValue(value);",
      helpers: "float halfValue(float v) { return v * 0.5; }",
    },
  });
  handle.replace({ nodes: [constrained], compilers: [] });
  assert.match(
    h.fragmentSource(graph(external), "glsl-430"),
    /inout float value/,
  );
  assert.throws(
    () => h.fragmentSource(graph(external), "glsl-es-300"),
    /未声明支持目标/,
  );
  const g = graph(external);
  h.semantics.validateStageGraph(g, "fragment");
  handle.dispose();
  assert.throws(() => h.fragmentSource(g), /未启用|缺少节点插件/);
  assert.throws(
    () => handle.replace({ nodes: [constrained], compilers: [] }),
    /释放/,
  );
});
test("已有库和文档保留实例 ID 与连线，不接管第三方记录，删除的组件不会被重新导入", () => {
  const storage = memory(),
    settings = createPluginSettings(storage, "custom.glsl");
  storage.setItem(
    "workflow.customNodes",
    JSON.stringify([
      { typeId: "custom.user1", title: "发光", properties: draft },
    ]),
  );
  adoptCustomSettings(storage);
  let lib = start(settings);
  assert.equal(lib.c.registry.get("custom.glsl.user1").glsl.code, draft.code);
  lib.lib.remove("custom.glsl.user1");
  lib.stop();
  adoptCustomSettings(storage);
  lib = start(settings);
  assert.equal(lib.c.registry.get("custom.glsl.user1"), null);
  lib.stop();
  const graph = {
    nodes: [
      {
        id: "fade",
        typeId: "custom.radialFade",
        canvasX: 0,
        canvasY: 0,
        properties: {},
      },
      {
        id: "other",
        typeId: "custom.other.value",
        plugin: { id: "custom.other", version: "1.0.0" },
        canvasX: 0,
        canvasY: 1,
        properties: {},
      },
    ],
    links: [
      { fromNode: "fade", fromSocket: "value", toNode: "other", toSocket: "v" },
    ],
  };
  const doc = createDocument({
    project: { id: "example" },
    graphs: { vertex: { nodes: [], links: [] }, fragment: graph },
  });
  const out = readWorkflowDocument(doc);
  assert.equal(out.graphs.fragment.nodes[0].id, "fade");
  assert.equal(out.graphs.fragment.nodes[0].typeId, "custom.glsl.radialFade");
  assert.equal(
    out.graphs.fragment.nodes[0].portSnapshot.inputs[0].type,
    "FLOAT",
  );
  assert.deepEqual(out.graphs.fragment.nodes[1], graph.nodes[1]);
  assert.deepEqual(out.graphs.fragment.links, graph.links);
  assert.deepEqual(doc.graphs.fragment, graph);
});

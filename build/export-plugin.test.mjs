import {installExportPorts} from './layer-test-support.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { OperationRegistry } from "../packages/kernel/index.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { starsectorPlugin } from "../plugins/starsector/index.mjs";
import { starsectorOperations as ids } from "../packages/starsector-contract/export-api.mjs";
import { normalizeTransform } from "../packages/workflow-tools/geometry.mjs";
import {pipelineHarness,backend} from "./compiler-pipeline-support.mjs";
import {loweredVertex,loweredFragment} from "./module-export-fixture.mjs";
import { validatePreviewParameters } from "../plugins/preview/parameters.mjs";
import { noiseHarness } from "./noise-test-support.mjs";

const template = await fs.readFile(
  new URL(
    "../plugins/starsector/runtime/WorkflowRuntime.java",
    import.meta.url,
  ),
  "utf8",
);
const node = (id, typeId, properties = {}) => ({
  id,
  typeId,
  properties,
  canvasX: 0,
  canvasY: 0,
});
function document() {
  return {
    config: {
      className: "ExportExample",
      shaderDir: "data/shaders/workflow",
      runtimePath: "data/custom",
    },
    geometry: normalizeTransform({}),
    fragment: {
      revision: 0,
      outputNodeId: "output",
      nodes: [
        node("color", "io.input", {
          uniform: "u_color",
          parameterId: "color",
          valueType: "VEC4",
          scope: "instance",
          defaultValue: "1,0.3,0.1,1",
        }),
        node("output", "io.output"),
      ],
      links: [
        {
          fromNode: "color",
          fromSocket: "value",
          toNode: "output",
          toSocket: "color",
        },
      ],
    },
  };
}
function compilation(){return pipelineHarness().compilation;}
async function mount(
  api = compilation(),
  assets = template,
  registry = new OperationRegistry(),
) {
  const host = new PluginRuntime();
  host.provide(
    "workflow.operations",
    "1.0.0",
    (...args) => registry.createApi(...args),
    true,
    { methods: { register: { capability: "operations.register" } } },
  );
  host.provide("workflow.compilation", "1.0.0", api, false, {
    methods: {
      describe: { capability: "shaders.compile" },
      lower: { capability: "shaders.compile" },
    },
  });
  host.provide(
    "platform.assets",
    "1.0.0",
    { readText: async () => assets },
    false,
    { methods: { readText: { capability: "assets.read" } } },
  );
  host.provide("shader.backend.glsl","1.0.0",backend,false,{methods:{emit:{capability:"shaders.emit"}}});
  installExportPorts(host);
  host.register(starsectorPlugin,{allowLocalApis:true});
  await host.setEnabled("studio.starsector", true);
  return { host, registry };
}
const operation = (id, run = (x) => x) => ({
  id,
  title: id,
  inputSchema: {
    type: "object",
    required: ["n"],
    properties: { n: { type: "number" } },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    required: ["n"],
    properties: { n: { type: "number" } },
    additionalProperties: false,
  },
  run,
});

test("通用操作原子注册、命名空间、schema 与 JSON 副本隔离", () => {
  const r = new OperationRegistry();
  assert.throws(
    () =>
      r.register("test.export", "1.0.0", [
        operation("test.export.ok"),
        operation("other.export.no"),
      ]),
    /越权/,
  );
  assert.equal(r.list().length, 0);
  const value = { n: 1 };
  const h = r.register("test.export", "1.0.0", [
    operation("test.export.ok", (x) => {
      x.n++;
      return x;
    }),
  ]);
  assert.deepEqual(r.execute("test.export.ok", value), { n: 2 });
  assert.equal(value.n, 1);
  const list = r.list();
  list[0].inputSchema.type = "string";
  assert.throws(() => r.execute("test.export.ok", { n: "x" }), /有限数值/);
  h.dispose();
  h.dispose();
  assert.equal(r.list().length, 0);
  assert.throws(() => r.execute("test.export.ok", value), /缺少/);
});
test("停用/替换拒绝旧异步操作结果，输出 schema 失败不污染后续调用", async () => {
  const r = new OperationRegistry();
  let resolve;
  const h = r.register("test.export", "1.0.0", [
    operation("test.export.slow", () => new Promise((r) => (resolve = r))),
  ]);
  const pending = r.execute("test.export.slow", { n: 1 });
  h.dispose();
  r.register("test.export", "1.0.0", [operation("test.export.slow")]);
  resolve({ n: 9 });
  await assert.rejects(pending, /停用或替换/);
  r.register("test.export", "1.0.0", [
    operation("test.export.bad", () => ({ n: "bad" })),
  ]);
  assert.throws(() => r.execute("test.export.bad", { n: 1 }), /有限数值/);
  assert.deepEqual(r.execute("test.export.slow", { n: 1 }), { n: 1 });
});
test("导出插件仅凭公开快照与自身模板即可单独挂载，三轮启停回收所有操作", async () => {
  const data = {
    config: document().config,
    geometry: document().geometry,
    inputs: [],
    textures: [],
    uniforms: [],
  };
  const api = {
    describe: () => structuredClone(data),
    lower: async ({stage})=>structuredClone(stage==='vertex'?loweredVertex:loweredFragment),
  };
  const { host, registry } = await mount(api);
  for (let i = 0; i < 3; i++) {
    if (i) await host.setEnabled("studio.starsector", true);
    assert.equal(registry.list().length, 4);
    const configuration = registry.execute(ids.configuration, {runtimePath:'data.custom', edit:{field:'v1y', value:125}});
    assert.equal(configuration.geometry.vertices[1][1],125);
    assert.equal(configuration.fields.length,13);
    assert.equal(configuration.runtime.path,'data/custom');
    const files = await registry.execute(ids.export, { document: document() });
    assert.equal(Object.keys(files).length, 3);
    assert.match(files.java.content, /import data.custom.WorkflowRuntime/);
    const dependency = registry.execute(ids.dependency, {
      runtimePath: "data/custom",
    });
    assert.equal(dependency.filename, "data/custom/WorkflowRuntime.java");
    assert.match(dependency.content, /^package data.custom;/);
    await host.setEnabled("studio.starsector", false);
    assert.equal(registry.list().length, 0);
    assert.throws(() => registry.execute(ids.configuration, {}), /缺少/);
    assert.throws(
      () => registry.execute(ids.guide, { document: document() }),
      /缺少/,
    );
  }
  await host.dispose();
});
test("真实双阶段编译保持实例数组 ABI，快照校验不修改传入图", async () => {
  const d = document(),
    before = structuredClone(d),
    { host, registry } = await mount();
  const files = await registry.execute(ids.export, { document: d }),
    guide = await registry.execute(ids.guide, { document: d, count: 8 });
  assert.match(files.java.content, /Vector4f\[\] color/);
  assert.match(files.fragment.content, /flat in vec4 wf_v_u_color/);
  assert.match(guide.signature, /List<Vector2f> positions/);
  assert.match(guide.example, /new Vector4f\[\]/);
  const single = await registry.execute(ids.guide, { document: d, count: 1 });
  assert.match(single.signature, /Vector2f position/);
  assert.match(single.signature, /Vector4f color/);
  assert.doesNotMatch(single.example, /\[\]/);
  assert.deepEqual(d, before);
  assert.throws(
    () => registry.execute(ids.dependency, { runtimePath: "data/../escape" }),
    /有效/,
  );
  await host.dispose();
});
test("导出检查保留重复参数，拒绝跨阶段不同类型/ID/作用域与保留 uniform", async () => {
  const { host, registry } = await mount();
  for (const properties of [
    { valueType: "FLOAT", defaultValue: "1" },
    { parameterId: "different" },
    { scope: "shared" },
    { uniform: "u_time", parameterId: "clock" },
    { uniform: "u_viewProjection", parameterId: "projection" },
  ]) {
    const d = document();
    d.geometry.graph.nodes.push(
      node("second", "io.input", {
        ...d.fragment.nodes[0].properties,
        ...properties,
      }),
    );
    await assert.rejects(
      () => registry.execute(ids.export, { document: d }),
      /冲突|保留/,
    );
  }
  await host.dispose();
});
test("预览自己的参数约束与 Java 命名无关，仍拒绝 GPU 声明冲突", () => {
  const p = { name: "u_color", id: "class", type: "VEC4", scope: "shared" };
  assert.doesNotThrow(() =>
    validatePreviewParameters([p], [], (n) => n + "_aspect"),
  );
  assert.throws(
    () =>
      validatePreviewParameters(
        [p, { ...p, type: "FLOAT" }],
        [],
        (n) => n + "_aspect",
      ),
    /冲突/,
  );
  assert.throws(
    () =>
      validatePreviewParameters(
        [{ ...p, name: "wf_preview_extent" }],
        [],
        (n) => n + "_aspect",
      ),
    /保留/,
  );
});
test("缺失模板时激活失败，不残留导出操作", async () => {
  const registry = new OperationRegistry();
  await assert.rejects(mount(compilation(), "missing", registry), /模板/);
  assert.equal(registry.list().length, 0);
});

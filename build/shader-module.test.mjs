import {installExportPorts} from './layer-test-support.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import fs from "node:fs/promises";
import { shader as s, constant as c } from "../packages/shader-ir/index.mjs";
import { formatShaderLog } from "../packages/shader-ir/diagnostics.mjs";
import { emitModule } from "../plugins/glsl-backend/emitter.mjs";
import { lowerGraph } from "../plugins/compiler/lower.mjs";
import { previewFragment } from "../plugins/compiler/preview.mjs";
import { compilerPlugin } from "../plugins/compiler/index.mjs";
import { glslPlugin } from "../plugins/glsl-backend/index.mjs";
import { starsectorPlugin } from "../plugins/starsector/index.mjs";
import {
  backendApi,
  compilationOperations,
} from "../packages/shader-ir/contracts.mjs";
import { starsectorOperations } from "../packages/starsector-contract/export-api.mjs";
import { OperationRegistry, createCommandGateway } from "../packages/kernel/index.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import {createExportSession} from "../plugins/starsector/session.mjs";
import { pipelineHarness } from "./compiler-pipeline-support.mjs";

const origin = { nodeId: "source-node", stage: "fragment", socket: "value" };
function fragment(body = []) {
  const m = s.module("fragment");
  m.resources = [{ storage: "out", name: "color", type: "VEC4" }];
  m.body = [...body, s.assign(s.symbol("VEC4", "color"), c("VEC4", 1))];
  return m;
}
const emit = (module, target = "glsl-430") => emitModule({ module, target });
function rejected(module, pattern, target) {
  const r = emit(module, target);
  assert.equal(r.ok, false);
  assert.match(r.diagnostics[0].message, pattern);
  return r;
}
const node = (id, typeId, properties = {}, x = 0, y = 0) => ({
  id,
  typeId,
  properties,
  canvasX: x,
  canvasY: y,
});
const link = (fromNode, fromSocket, toNode, toSocket) => ({
  fromNode,
  fromSocket,
  toNode,
  toSocket,
});
function document(h) {
  return h.document({
    revision: 0,
    outputNodeId: "output",
    nodes: [
      node("color", "io.input", {
        uniform: "u_color",
        parameterId: "color",
        valueType: "VEC4",
        defaultValue: "1,0.3,0.1,1",
        scope: "instance",
      }),
      node("output", "io.output"),
    ],
    links: [link("color", "value", "output", "color")],
  });
}

test("完整模块验证作用域、只读资源、循环下标和数值范围，错误保留节点来源", () => {
  const r = rejected(
    fragment([s.declare("x", "FLOAT", s.symbol("FLOAT", "missing"), origin)]),
    /未知符号/,
  );
  assert.deepEqual(r.diagnostics[0].origin, origin);
  rejected(
    fragment([
      {
        kind: "if",
        condition: c("BOOL", true),
        yes: [s.declare("inside", "FLOAT", c("FLOAT", 1))],
        no: [],
      },
      s.declare("outside", "FLOAT", s.symbol("FLOAT", "inside")),
    ]),
    /未知符号/,
  );
  const readonly = fragment([
    s.assign(s.symbol("FLOAT", "u_time"), c("FLOAT", 2)),
  ]);
  readonly.resources.push({
    storage: "uniform",
    name: "u_time",
    type: "FLOAT",
  });
  rejected(readonly, /只读/);
  rejected(
    fragment([
      {
        kind: "for",
        index: "i",
        count: c("FLOAT", 3),
        body: [s.assign(s.symbol("INT", "i"), c("INT", 2))],
      },
    ]),
    /只读/,
  );
  rejected(
    fragment([
      { kind: "for", index: "i", count: c("INT", 3), body: [] },
      s.declare("j", "INT", s.symbol("INT", "i")),
    ]),
    /未知符号/,
  );
  for (const [type, value] of [
    ["INT", 2147483648],
    ["UINT", 4294967296],
    ["FLOAT", 1e39],
  ])
    rejected(fragment([s.declare("x", type, c(type, value))]), /32 位/);
});

test("结构化函数签名和目标资源限制在发射前校验", () => {
  const m = fragment([
    {
      kind: "call",
      value: s.call("VOID", "setValue", s.symbol("FLOAT", "u_value")),
    },
  ]);
  m.resources.push({ storage: "uniform", name: "u_value", type: "FLOAT" });
  m.functions = [
    {
      name: "setValue",
      returns: "VOID",
      parameters: [{ name: "v", type: "FLOAT", qualifier: "out" }],
      body: [s.assign(s.symbol("FLOAT", "v"), c("FLOAT", 2))],
    },
  ];
  rejected(m, /可写/);
  m.body.unshift(s.declare("x", "FLOAT", c("FLOAT", 0)));
  m.body[1].value.args[0] = s.symbol("FLOAT", "x");
  assert.equal(emit(m).ok, true);
  m.resources.push({
    storage: "buffer",
    name: "Values",
    layout: "std430",
    binding: 0,
    readonly: true,
    members: [{ name: "values", type: "VEC4", array: true }],
  });
  assert.equal(emit(m).ok, true);
  rejected(m, /SSBO/, "glsl-es-300");
});

test("原始 GLSL 必须声明目标，驱动日志映射回节点", () => {
  const m = fragment([{ kind: "call", value: s.call("VOID", "custom") }]);
  m.functions = [
    {
      name: "custom",
      returns: "VOID",
      parameters: [],
      raw: true,
      code: "invalidFunction();",
      helpers: "",
      targets: ["glsl-430"],
      origin,
    },
  ];
  rejected(m, /未声明支持目标/, "glsl-es-300");
  const result = emit(m);
  assert.equal(result.ok, true);
  const line =
    result.source.split("\n").findIndex((s) => s.includes("invalidFunction")) +
    1;
  const log = `ERROR: 0:${line}: undefined function\n0(${line}) : error\nunknown driver text`;
  const mapped = formatShaderLog(log, result.sourceMap, "fragment");
  assert.equal(mapped.match(/节点 source-node/g).length, 2);
  assert.ok(mapped.endsWith("unknown driver text"));
  m.functions[0].code = "#version 330";
  rejected(m, /版本/);
});

test("If 分支共享表达式在各自作用域重新声明，For 反馈变量和 i 使用结构化 IR", () => {
  const h = pipelineHarness();
  const g = {
    revision: 0,
    outputNodeId: "sum",
    nodes: [
      node("condition", "io.input", {
        uniform: "u_condition",
        valueType: "BOOL",
        defaultValue: "true",
      }),
      node("if", "logic.if", {}, 100, 100),
      node(
        "a",
        "logic.variable",
        { valueType: "FLOAT", initialValue: 0 },
        150,
        180,
      ),
      node(
        "b",
        "logic.variable",
        { valueType: "FLOAT", initialValue: 0 },
        650,
        180,
      ),
      node("outside", "studio.math.add", { valueType: "FLOAT" }, 0, 600),
      node("sum", "studio.math.add", { valueType: "FLOAT" }, 950, 550),
    ],
    links: [
      link("condition", "value", "if", "condition"),
      link("outside", "value", "a", "value"),
      link("outside", "value", "b", "value"),
      link("a", "value", "sum", "a"),
      link("b", "value", "sum", "b"),
    ],
  };
  const lowered = h.lower(g),
    branch = lowered.body.find((s) => s.kind === "if");
  assert.ok(branch);
  assert.equal(branch.yes.filter((s) => s.kind === "declare").length, 1);
  assert.equal(branch.no.filter((s) => s.kind === "declare").length, 1);
  assert.notEqual(branch.yes[0].name, branch.no[0].name);
  assert.equal(emit(previewFragment(lowered)).ok, true);
  const loop = {
    revision: 0,
    outputNodeId: "acc",
    nodes: [
      node(
        "count",
        "io.input",
        { uniform: "u_count", valueType: "FLOAT", defaultValue: 4 },
        0,
        0,
      ),
      node("for", "logic.for", {}, 100, 100),
      node(
        "acc",
        "logic.variable",
        { valueType: "FLOAT", initialValue: 0 },
        130,
        200,
      ),
      node("add", "studio.math.add", { valueType: "FLOAT" }, 330, 200),
    ],
    links: [
      link("count", "value", "for", "count"),
      link("acc", "value", "add", "a"),
      link("for", "i", "add", "b"),
      link("add", "value", "acc", "value"),
    ],
  };
  const l = h.lower(loop);
  const loopStatement = l.body.find(s => s.kind === "for");
  assert.ok(loopStatement);
  assert.equal(loopStatement.body.at(-1).kind, "assign");
  assert.equal(emit(previewFragment(l)).ok, true);
  const escaped = structuredClone(loop);
  escaped.outputNodeId = "add";
  escaped.nodes.find((n) => n.id === "add").canvasY = 700;
  assert.throws(() => h.lower(escaped), /分支|循环|连接/);
});

test("节点预览独立于另一个阶段的坏图，完整导出仍检查两阶段", () => {
  const h = pipelineHarness(),
    d = document(h);
  d.geometry.graph.nodes.push(node("broken", "missing.plugin"));
  assert.throws(() => h.snapshots.describe(d), /未知|缺少|不存在/);
  assert.ok(
    lowerGraph(
      h.snapshots.prepare({
        document: d,
        target: "glsl-es-300",
        stage: "fragment",
        nodeId: "color",
        sockets: ["value"],
      }),
    ).outputs.value,
  );
});

test("自定义函数支持 in/out/inout，名称相同而正文不同不会被覆盖", () => {
  const input = {
      node: node("in", "io.input", { uniform: "u_value" }),
      inputs: [],
      outputs: [{ name: "value", type: "FLOAT" }],
    },
    custom = (id) => ({
      node: node(id, "custom.test"),
      inputs: [{ name: "value", type: "FLOAT" }],
      outputs: [{ name: "value", type: "FLOAT" }],
      custom: {
        name: "testValue",
        parameters: [{ name: "value", type: "FLOAT", qualifier: "inout" }],
        code: "value *= 2.0;",
        helpers: "",
        targets: ["glsl-es-300", "glsl-430"],
      },
    });
  const snap = {
    stage: "fragment",
    target: "glsl-430",
    finalNode: "b",
    sockets: ["value"],
    nodes: [input, custom("a"), custom("b")],
    links: [
      link("in", "value", "a", "value"),
      link("a", "value", "b", "value"),
    ],
    inputs: [{ name: "u_value", type: "FLOAT" }],
    textures: [],
  };
  const lowered = lowerGraph(snap);
  assert.equal(lowered.functions.length, 1);
  assert.equal(lowered.body.filter((s) => s.kind === "call").length, 2);
  assert.equal(emit(previewFragment(lowered)).ok, true);
  snap.nodes[2].custom.code = "value *= 3.0;";
  assert.throws(() => lowerGraph(snap), /名称冲突/);
});

async function mount(extra) {
  const h = pipelineHarness(),
    host = new PluginRuntime(),
    registry = new OperationRegistry();
  host.provide("workflow.graph-snapshot", "1.0.0", h.snapshots, false, {
    methods: {
      describe: { capability: "graph.snapshot" },
      prepare: { capability: "graph.snapshot" },
    },
  });
  host.provide(
    "workflow.operations",
    "1.0.0",
    (...args) => registry.createApi(...args),
    true,
    { methods: { register: { capability: "operations.register" } } },
  );
  host.provide(
    "platform.assets",
    "1.0.0",
    {
      readText: () =>
        fs.readFile(
          new URL(
            "../plugins/starsector/runtime/WorkflowRuntime.java",
            import.meta.url,
          ),
          "utf8",
        ),
    },
    false,
    { methods: { readText: { capability: "assets.read" } } },
  );
  installExportPorts(host);
  for (const p of [glslPlugin, compilerPlugin, starsectorPlugin])
    host.register(p,{allowLocalApis:p===starsectorPlugin});
  if (extra) {
    host.register(extra);
    host.selectProvider("shader.backend.glsl", extra.manifest.id);
  }
  await host.setEnabled("studio.starsector", true);
  return { host, registry, d: document(h) };
}
test("编译插件按依赖启停三轮，停用后删除所有编译/导出操作", async () => {
  const { host, registry, d } = await mount();
  for (let i = 0; i < 3; i++) {
    const r = await registry.execute(compilationOperations.preview, {
      document: d,
    });
    assert.ok(r.vertex.ok && r.fragment.ok);
    const files = await registry.execute(starsectorOperations.export, {
      document: d,
    });
    assert.deepEqual(Object.keys(files), ["java", "vertex", "fragment"]);
    assert.deepEqual(
      new Set(host.impact("studio.glsl").stop),
      new Set(["studio.glsl", "studio.compiler", "studio.starsector"]),
    );
    await host.setEnabled("studio.glsl", false);
    assert.equal(registry.list().length, 0);
    assert.ok(host.list().every((p) => !p.enabled));
    await host.setEnabled("studio.starsector", true);
    assert.deepEqual(
      new Set(registry.list().map(item => item.id)),
      new Set([...Object.values(compilationOperations), ...Object.values(starsectorOperations)]),
    );
  }
  await host.setEnabled("studio.glsl", false);
});

test("替换为 Worker JSON 后端仍产出一致源码，迟到请求不能越过停用边界", async () => {
  const worker = new Worker(
    new URL("./fixtures/glsl-worker.mjs", import.meta.url),
  );
  let serial = 0;
  const pending = new Map();
  worker.on("message", (text) => {
    const { id, result } = JSON.parse(text);
    pending.get(id)?.(result);
    pending.delete(id);
  });
  const remote = (request) =>
    new Promise((resolve) => {
      const id = ++serial;
      pending.set(id, resolve);
      worker.postMessage(JSON.stringify({ id, request }));
    });
  let release,
    started,
    slow = false;
  const gate = new Promise((resolve) => (release = resolve)),
    firstCall = new Promise((resolve) => (started = resolve));
  const plugin = {
    manifest: {
      id: "test.remote",
      name: "JSON 后端",
      version: "1.0.0",
      apiVersion: "1.0.0",
      requiredApis: {},
      providesApis: { "shader.backend.glsl": backendApi },
      capabilities: [],
    },
    activate(ctx) {
      ctx.provide("shader.backend.glsl", {
        emit: async (request) => {
          const r = await remote(request);
          if (slow) {
            started();
            await gate;
          }
          return r;
        },
      });
    },
  };
  try {
    const { host, registry, d } = await mount(plugin),
      native = await mount();
    assert.deepEqual(
      await registry.execute(starsectorOperations.export, { document: d }),
      await native.registry.execute(starsectorOperations.export, {
        document: d,
      }),
    );
    slow = true;
    const promise = registry.execute(compilationOperations.preview, {
      document: d,
    });
    promise.catch(() => {});
    // 单独调用 lower 不依赖 emit，preview 的两个 emit 都必须经过可撤销 API。
    await firstCall;
    await host.setEnabled("test.remote", false);
    release();
    await assert.rejects(promise, /停用|释放|失效|撤销/);
    await native.host.setEnabled("studio.glsl", false);
  } finally {
    await worker.terminate();
  }
});

test('导出会话拒绝旧文档和停用后的异步结果，缓存仅属于当前文档',async()=>{
 let id=1,resolvers=[];const snapshot=()=>({project:{id:'test',runtimePath:'data/method'},documentToken:'t',documentRevision:id,fragmentGraph:{id},vertexTransform:{}});
 const session=createExportSession({workflow:{snapshot,subscribe:()=>()=>{},report(){}},service:{generate:({document})=>new Promise(resolve=>resolvers.push(()=>resolve(document)))},files:{save:async()=>({})},history:{status:()=>({state:'current'})},downloads:{}});
 assert.equal(session.readiness().pending,true);const stale=session.exportEffect({download:false});await new Promise(setImmediate);id=2;resolvers.shift()();await assert.rejects(stale,/过期|改变/);
 const current=session.exportEffect({download:false});await new Promise(setImmediate);resolvers.shift()();assert.deepEqual((await current).fragment,{id:2});assert.equal(session.readiness().ready,true);
 id=3;const stopped=session.exportEffect({download:false});await new Promise(setImmediate);session.dispose();resolvers.shift()();await assert.rejects(stopped,/停用|过期/);assert.throws(()=>session.readiness(),/停用/);
});

test("工作流命令等待异步导出完成并正确报告失败", async () => {
  const snap = {
    project: { id: "test" },
    documentToken: "token",
    stage: "fragment",
    graph: { revision: 1 },
    documentRevision: 1,
  };
  let finish;
  const api = createCommandGateway({
    snapshot: () => snap,
    action: () =>
      new Promise((resolve, reject) => (finish = { resolve, reject })),
  });
  const request = {
    documentId: "test",
    documentToken: "token",
    stage: "fragment",
    expectedRevision: 1,
    actions: [{ type: "EXPORT_RUNTIME", payload: {} }],
  };
  const ok = api.execute(request);
  assert.ok(ok instanceof Promise);
  finish.resolve();
  assert.equal((await ok).ok, true);
  const bad = api.execute(request);
  finish.reject(Error("生成失败"));
  assert.deepEqual(await bad, { ok: false, error: "生成失败" });
});

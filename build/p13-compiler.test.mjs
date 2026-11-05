import test from "node:test";
import assert from "node:assert/strict";
import { pipelineHarness } from "./compiler-pipeline-support.mjs";
import { compilerPlugin } from "../plugins/compiler/index.mjs";
import { mathContribution } from "../plugins/math/contribution.mjs";
import { noiseContribution } from "../plugins/noise/contribution.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { OperationRegistry } from "../packages/kernel/index.mjs";
import { glslPlugin } from "../plugins/glsl-backend/index.mjs";

const node = (id, typeId, properties = {}) => ({
  id,
  typeId,
  properties,
  canvasX: 0,
  canvasY: 0,
});
function graph() {
  return {
    revision: 0,
    outputNodeId: "output",
    nodes: [
      node("value", "studio.math.constant", { value: "0.4" }),
      node("wave", "studio.math.sin"),
      node("output", "io.output"),
    ],
    links: [
      { fromNode: "value", fromSocket: "value", toNode: "wave", toSocket: "x" },
      {
        fromNode: "wave",
        fromSocket: "value",
        toNode: "output",
        toSocket: "color",
      },
    ],
  };
}
function fixture() {
  const h = pipelineHarness(),
    counts = { prepare: 0, emit: 0 },
    cleanup = [];
  let api;
  const snapshots = {
    ...h.snapshots,
    prepare(r) {
      counts.prepare++;
      return h.snapshots.prepare(r);
    },
  };
  compilerPlugin.activate({
    api: (id) =>
      ({
        "workflow.graph-snapshot": snapshots,
        "shader.backend.glsl": {
          async emit(r) {
            counts.emit++;
            return h.backend.emit(r);
          },
        },
        "workflow.operations": { register() {} },
      })[id],
    provide: (_, v) => (api = v),
    onDispose: (f) => cleanup.push(f),
  });
  return {
    h,
    counts,
    api,
    document: h.document(graph()),
    dispose() {
      cleanup.forEach((f) => f());
      Object.values(h.handles).forEach((x) => x.dispose());
      h.dispose();
    },
  };
}

test("真实编译同键并发合并，目标与阶段分开，结果与无缓存管线一致", async () => {
  const f = fixture();
  try {
    const request = {
      document: f.document,
      stage: "fragment",
      target: "glsl-430",
      nodeId: "wave",
      sockets: ["value"],
    };
    const results = await Promise.all(
      Array.from({ length: 12 }, () => f.api.lower(request)),
    );
    assert.equal(f.counts.prepare, 1);
    assert.deepEqual(results[0], await f.h.compilation.lower(request));
    results[0].body.push({ bad: true });
    assert.notDeepEqual(results[0], results[1]);
    await f.api.lower({ ...request, target: "glsl-es-300" });
    assert.equal(f.counts.prepare, 2);
    await f.api.lower({
      document: f.document,
      stage: "vertex",
      target: "glsl-430",
    });
    assert.equal(f.counts.prepare, 3);
    const changed = structuredClone(request);
    changed.document.fragment.nodes[0].properties.value = "0.8";
    const newResult = await f.api.lower(changed);
    assert.notDeepEqual(newResult, results[1]);
    assert.equal(f.counts.prepare, 4);
  } finally {
    f.dispose();
  }
});

test("无关插件重载保留缓存，同版本所用节点重新登记使缓存失效", async () => {
  const f = fixture();
  try {
    const r = {
      document: f.document,
      stage: "fragment",
      target: "glsl-430",
      nodeId: "wave",
      sockets: ["value"],
    };
    const first = await f.api.lower(r);
    const key = (await f.api.identity(r)).key;
    f.h.handles["studio.noise"].dispose();
    f.h.handles["studio.noise"] = f.h.registry.register(
      "studio.noise",
      "1.0.0",
      noiseContribution(),
      { fingerprint: "noise-new" },
    );
    assert.equal((await f.api.identity(r)).key, key);
    assert.deepEqual(await f.api.lower(r), first);
    assert.equal(f.counts.prepare, 1);
    f.h.registry.invalidate("studio.noise");
    assert.equal((await f.api.identity(r)).key, key);
    f.h.handles["studio.math"].dispose();
    await assert.rejects(f.api.lower(r), /节点|类型|依赖/);
    f.h.handles["studio.math"] = f.h.registry.register(
      "studio.math",
      "1.0.0",
      mathContribution(),
      { fingerprint: "math-new" },
    );
    assert.notEqual((await f.api.identity(r)).key, key);
    assert.deepEqual(await f.api.lower(r), first);
    assert.equal(f.counts.prepare, 3);
  } finally {
    f.dispose();
  }
});

test("完整预览包含两个阶段的提供者，单节点预览只跟随自身阶段", async () => {
  const f = fixture();
  try {
    f.document.geometry.graph.nodes.push(node("vertexWave", "studio.math.sin"));
    const full = { document: f.document, stage: "fragment" },
      single = { ...full, nodeId: "value", socket: "value" };
    // 片段只保留基础节点，让 Math 只出现在顶点阶段。
    f.document.fragment = {
      revision: 0,
      nodes: [node("value", "input.time")],
      links: [],
    };
    const beforeFull = (await f.api.identity(full)).key,
      beforeSingle = (await f.api.identity(single)).key;
    f.h.handles["studio.math"].dispose();
    f.h.handles["studio.math"] = f.h.registry.register(
      "studio.math",
      "1.0.0",
      mathContribution(),
    );
    assert.notEqual((await f.api.identity(full)).key, beforeFull);
    assert.equal((await f.api.identity(single)).key, beforeSingle);
  } finally {
    f.dispose();
  }
});

test("编译插件重建隔离旧缓存，后端替换经唯一内核重启消费者并撤销旧结果", async () => {
  const h = pipelineHarness(),
    runtime = new PluginRuntime(),
    ops = new OperationRegistry();
  let api;
  runtime.provide("workflow.graph-snapshot", "1.0.0", h.snapshots);
  runtime.provide(
    "workflow.operations",
    "1.0.0",
    (...args) => ops.createApi(...args),
    true,
  );
  runtime.register(glslPlugin);
  runtime.register(compilerPlugin);
  runtime.register({
    manifest: {
      id: "test.cache",
      name: "cache",
      version: "1.0.0",
      apiVersion: "1.0.0",
      requiredApis: { "workflow.compilation": "1.0.0" },
      capabilities: ["shaders.compile"],
    },
    activate(c) {
      api = c.api("workflow.compilation");
    },
  });
  try {
    await runtime.setEnabled("test.cache", true);
    assert.equal(
      runtime.list().find((p) => p.id === "studio.glsl").activationState,
      "waiting",
    );
    const document = h.document(graph()),
      request = {
        document,
        nodeId: "value",
        socket: "value",
        stage: "fragment",
      };
    const first = await api.preview(request),
      key = await api.identity(request),
      old = api;
    assert.equal(
      runtime.list().find((p) => p.id === "studio.glsl").active,
      true,
    );
    await runtime.replace({ ...glslPlugin, fingerprint: "new-same-version" });
    assert.throws(() => old.status(), /撤销/);
    assert.notDeepEqual(await api.identity(request), key);
    assert.equal((await api.status()).entries, 0);
    assert.deepEqual(await api.preview(request), first);
  } finally {
    await runtime.dispose();
    Object.values(h.handles).forEach((x) => x.dispose());
    h.dispose();
  }
});

export async function compilationBenchmark(rounds = 20) {
  const cold = [],
    warm = [];
  let stats;
  for (let i = 0; i < rounds; i++) {
    const f = fixture();
    try {
      const r = {
        document: f.document,
        nodeId: "wave",
        socket: "value",
        stage: "fragment",
      };
      let t = performance.now();
      await f.api.preview(r);
      cold.push(performance.now() - t);
      t = performance.now();
      await f.api.preview(r);
      warm.push(performance.now() - t);
      stats = f.api.status();
    } finally {
      f.dispose();
    }
  }
  const median = (a) => [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)];
  return {
    rounds,
    coldMedianMs: median(cold),
    warmMedianMs: median(warm),
    stats,
  };
}

test("固定样本记录纯编译冷缓存与热缓存耗时，热调用不重复发射", async () => {
  const result = await compilationBenchmark();
  assert.ok(result.stats.hits >= 1);
  assert.equal(result.stats.inFlight, 0);
  console.log("P13_COMPILATION_BENCHMARK " + JSON.stringify(result));
});

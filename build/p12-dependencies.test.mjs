import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDocument, readDocument } from "../packages/plugin-sdk/document.mjs";
import { DocumentStore } from "../packages/kernel/document-store.mjs";
import { documentPolicy } from "../plugins/workflow-service/document-policy.mjs";
import { defaultVertexGraph } from "../packages/workflow-tools/defaults.mjs";
import { pipelineHarness } from "./compiler-pipeline-support.mjs";
import { createPluginRepository } from "../packages/native-host/plugin-repository.mjs";
import { pluginContentFingerprint } from "../packages/native-host/plugin-files.mjs";
import { pluginManifestDraft } from "../packages/plugin-sdk/plugin-manifest.mjs";
import { createPluginManagement } from "../plugins/plugin-service/management.mjs";
import { createPluginControl } from "../frontend/application/plugin-control.mjs";
import { externalPlugin } from "../frontend/application/external-plugin.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { commandPermission } from "../plugins/mcp/access-policy.mjs";
import { readPluginCall } from "../packages/plugin-sdk/plugin-management.mjs";
import { createEditorApplication } from "../plugins/workflow-service/application.mjs";
import { workspacePorts, nodeModelFixture } from "./layer-test-support.mjs";
import { mathContribution } from "../plugins/math/contribution.mjs";

const ports = { inputs: [], outputs: [{ name: "value", type: "VEC4" }] };
const pluginNode = () => ({ id: "value", typeId: "local.test.value", canvasX: 0, canvasY: 0, properties: {}, plugin: { id: "local.test", version: "1.0.0" }, portSnapshot: structuredClone(ports) });
const doc = (nodes = [pluginNode()]) => createDocument({ project: { id: "dependencies" }, graphs: { vertex: defaultVertexGraph(), fragment: { nodes, links: [], outputNodeId: "value" } } });
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await tick(); } assert.ok(check(), "异步清理未完成"); }

test("P12 实际编辑应用向编译快照完整提供依赖诊断，两个阶段均可准备", () => {
  const ports = workspacePorts(), model = nodeModelFixture(ports);
  const app = createEditorApplication(ports, model.catalog);
  const handle = model.nodeApi("studio.math").register(mathContribution());
  try {
    const snapshot = app.workflowApi.snapshot();
    const document = { config: snapshot.project, fragment: snapshot.fragmentGraph, geometry: snapshot.vertexTransform };
    assert.deepEqual(snapshot.dependencyDiagnostics, []);
    for (const stage of ["vertex", "fragment"])
      assert.equal(model.snapshots.prepare({ document, target: "glsl-430", stage,
        ...(stage === "fragment" ? { nodeId: snapshot.fragmentGraph.nodes.at(-1).id, sockets: [snapshot.fragmentGraph.nodes.at(-1).portSnapshot.outputs[0].name] } : {}),
      }).stage, stage);
  } finally { handle.dispose(); app.dispose(); model.dispose(); }
});

test("P12 文档精确依赖必须与两个阶段的节点来源一致，拒绝前后均不改原文", () => {
  const source = doc();
  assert.deepEqual(source.requiredPlugins, { "local.test": "1.0.0" });
  for (const map of [{}, { "local.test": "2.0.0" }, { "local.test": "1.0.0", extra: "1.0.0" }]) {
    const bad = { ...structuredClone(source), requiredPlugins: map }, before = structuredClone(bad);
    assert.throws(() => readDocument(bad), /requiredPlugins/);
    assert.deepEqual(bad, before);
  }
  const conflict = structuredClone(source);
  conflict.graphs.vertex.nodes.push({ ...pluginNode(), id: "other", plugin: { id: "local.test", version: "2.0.0" } });
  assert.throws(() => readDocument(conflict), /版本冲突/);
  const store = new DocumentStore(source, { policies: () => ({}) });
  const before = store.snapshot();
  assert.throws(() => store.reset(conflict), /版本冲突/);
  assert.deepEqual(store.snapshot(), before);
});

test("P12 多工作流摘要批量读取来源索引，库条目增多不重复读取整库，更新立即可见", () => {
  const ports = workspacePorts(), local = ports.preferences();
  const documents = Array.from({ length: 120 }, (_, i) => createDocument({
    project: { id: "saved_" + i, title: "工作流 " + i },
    graphs: { vertex: { nodes: [], links: [] }, fragment: { nodes: [], links: [] } },
  }));
  local.setItem("workflow.documents", JSON.stringify(documents));
  local.setItem("workflow.fileBindings", JSON.stringify({ saved_0: { fileId: "first" } }));
  const model = nodeModelFixture(ports), app = createEditorApplication(ports, model.catalog), originalGet = local.getItem;
  let libraryReads = 0;
  local.getItem = (key) => {
    if (["workflow.documents", "workflow.fileBindings"].includes(key)) libraryReads++;
    return originalGet(key);
  };
  try {
    const before = app.workflowApi.snapshot();
    assert.equal(before.savedWorkflows.length, 120);
    assert.equal(before.savedWorkflows[0].file.fileId, "first");
    assert.ok(libraryReads <= 4, "摘要不应为每个条目重新读取并验证整个库");
    local.setItem("workflow.fileBindings", JSON.stringify({ saved_119: { fileId: "latest" } }));
    const after = app.workflowApi.snapshot();
    assert.equal(after.savedWorkflows[0].file, null);
    assert.equal(after.savedWorkflows.at(-1).file.fileId, "latest");
  } finally { app.dispose(); model.dispose(); }
});

test("P12 缺失、来源、版本与端口冲突保留节点连线，正确提供者恢复后源码一致", () => {
  const h = pipelineHarness();
  const definition = { typeId: "local.test.value", title: "值", ...ports, properties: {}, stages: ["vertex", "fragment"], targets: ["glsl-430", "glsl-es-300"] };
  let handle;
  const register = (version = "1.0.0", type = "VEC4") => h.registry.register("local.test", version, {
    nodes: [{ ...definition, outputs: [{ name: "value", type }] }],
    compilers: definition.targets.map((target) => ({ typeId: definition.typeId, target, compile: () => type === "VEC4" ? { kind: "call", name: "vec4", type, args: Array.from({ length: 4 }, () => ({ kind: "literal", type: "FLOAT", value: 0.5 })) } : { kind: "literal", type, value: true } })),
  });
  try {
    handle = register();
    const source = doc();
    source.graphs.fragment.nodes.push({ id: "output", typeId: "io.output", canvasX: 400, canvasY: 0, properties: {} });
    source.graphs.fragment.links.push({ fromNode: "value", fromSocket: "value", toNode: "output", toSocket: "color" });
    source.graphs.fragment.outputNodeId = "output";
    const store = new DocumentStore(source, documentPolicy(() => h.catalog));
    const original = store.snapshot(), code = h.fragmentSource(original.graphs.fragment);
    handle.dispose();
    assert.equal(h.semantics.dependencyIssue(pluginNode()).code, "PLUGIN_MISSING");
    assert.equal(store.transact({ commands: [{ stage: "fragment", type: "MOVE_NODE", payload: { nodeId: "value", x: 50, y: 50 } }] }).ok, true);
    assert.deepEqual(store.graph("fragment").links, original.graphs.fragment.links);
    assert.deepEqual(store.graph("fragment").nodes[0].plugin, pluginNode().plugin);
    for (const [version, type, expected] of [["2.0.0", "VEC4", "PLUGIN_VERSION_CONFLICT"], ["1.0.0", "BOOL", "PLUGIN_PORT_CONFLICT"]]) {
      handle = register(version, type);
      assert.equal(h.semantics.dependencyIssue(pluginNode()).code, expected);
      store.reset(original);
      assert.deepEqual(store.graph("fragment").nodes, original.graphs.fragment.nodes);
      assert.deepEqual(store.graph("fragment").links, original.graphs.fragment.links);
      assert.throws(() => h.fragmentSource(store.graph("fragment")), /冲突|端口/);
      handle.dispose();
    }
    handle = register();
    const wrong = pluginNode(); wrong.plugin.id = "local.other";
    assert.equal(h.semantics.dependencyIssue(wrong).code, "PLUGIN_PROVIDER_CONFLICT");
    assert.equal(h.fragmentSource(store.graph("fragment")), code);
  } finally { handle?.dispose(); Object.values(h.handles).forEach((x) => x.dispose()); h.dispose(); }
});

async function repository(t, kind = "nodes") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-p12-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "plugin"); await fs.mkdir(directory);
  const indexFile = path.join(root, "index.json"), repo = createPluginRepository({ indexFile });
  const draft = await repo.inspect(1, directory), manifest = pluginManifestDraft("p12", "index.mjs", kind);
  const prepared = await repo.prepare(1, { token: draft.token, manifest, createTemplate: true, approvePermissions: true });
  await repo.commit(1, prepared.generation);
  return { root, directory, indexFile, repo, manifest, prepared };
}

test("P12 内容指纹覆盖入口与辅助文件，同版本变化不沿用节点或扩展授权", async (t) => {
  for (const kind of ["nodes", "extension", "declarative"]) {
    const { directory, repo, manifest, prepared, indexFile } = await repository(t, kind);
    assert.match(prepared.fingerprint, /^[a-f0-9]{64}$/);
    assert.deepEqual(JSON.parse(repo.bundle(1, prepared.generation).files["studio-plugin.json"]), prepared.manifest);
    assert.equal((await createPluginRepository({ indexFile }).restore(2))[0].fingerprint, prepared.fingerprint);
    await fs.writeFile(path.join(directory, "helper.mjs"), "export const value = 2");
    const draft = await repo.inspectRegistered(1, manifest.id);
    assert.equal(draft.permissionsApproved, false);
    assert.equal(draft.contentChanged, true);
    await assert.rejects(repo.prepare(1, { token: draft.token, manifest }), /确认/);
    assert.match((await repo.restore(2))[0].error, /确认/);
    const changed = await repo.prepare(1, { token: draft.token, manifest, approvePermissions: true });
    assert.notEqual(changed.fingerprint, prepared.fingerprint);
    assert.notEqual(changed.generation, prepared.generation);
    await repo.commit(1, changed.generation);
    assert.equal((await repo.inspectRegistered(1, manifest.id)).permissionsApproved, true);
    assert.equal((await createPluginRepository({ indexFile }).restore(3))[0].fingerprint, changed.fingerprint);
  }
  assert.equal(pluginContentFingerprint({ "b.js": "2", "a.js": "1" }), pluginContentFingerprint({ "a.js": "1", "b.js": "2" }));
  assert.notEqual(pluginContentFingerprint({ "style.css": "red" }), pluginContentFingerprint({ "style.css": "blue" }));
});

test("P12 审阅和加载之间的文件变化拒绝提交，磁盘 ID 不会被登记 ID 覆盖", async (t) => {
  const { directory, repo, manifest } = await repository(t);
  let draft = await repo.inspectRegistered(1, manifest.id);
  await fs.writeFile(path.join(directory, "helper.mjs"), "export const value = 1");
  await assert.rejects(repo.prepare(1, { token: draft.token, manifest, approvePermissions: true }), /已变化/);
  draft = await repo.inspectRegistered(1, manifest.id);
  const p = await repo.prepare(1, { token: draft.token, manifest, approvePermissions: true });
  const before = await repo.list();
  await fs.writeFile(path.join(directory, "helper.mjs"), "export const value = 2");
  await assert.rejects(repo.commit(1, p.generation), /已变化/);
  assert.deepEqual(await repo.list(), before);
  await fs.writeFile(path.join(directory, "studio-plugin.json"), JSON.stringify({ ...manifest, id: "local.changed" }));
  draft = await repo.inspectRegistered(1, manifest.id);
  assert.equal(draft.manifest.id, "local.changed");
  assert.match(draft.error, /ID/);
  assert.match((await repo.restore(3))[0].error, /ID/);
});

test("P12 编译代次隔离，停用后缓存和迟到结果不能进入新代次", async () => {
  const manifest = pluginManifestDraft("late"), cleanups = [], registered = [], pending = [];
  const platform = { call: async (method) => method === "start" ? { apis: [], nodes: [{}], compilers: [{ typeId: "local.late.value", target: "glsl-430" }] } : method === "compile" ? new Promise((resolve) => pending.push(resolve)) : null };
  const context = { onDispose: (fn) => cleanups.push(fn), hasApi: () => true, api: () => ({ register: (v) => registered.push(v) }) };
  await externalPlugin({ manifest, generation: "a" }, platform).activate(context);
  const old = registered[0].compilers[0];
  const oldResult = old.compile({});
  await cleanups[0]();
  await externalPlugin({ manifest, generation: "b" }, platform).activate(context);
  const current = registered[1].compilers[0];
  const currentResult = current.compile({});
  pending[0]({ value: "old" }); pending[1]({ value: "new" });
  await assert.rejects(oldResult, /撤销/);
  assert.throws(() => old.compile({}), /撤销/);
  assert.deepEqual(await currentResult, { value: "new" });
  assert.deepEqual(await current.compile({}), { value: "new" });
  for (const stop of cleanups) await stop();
});

test("P12 管理诊断保留故障、持久化停用，重载失败保留旧实现，迟到故障不影响新代次", async () => {
  const runtime = new PluginRuntime(), manifest = pluginManifestDraft("fault"), states = [], stopped = [];
  runtime.provide("workflow.nodes", "1.0.0", { register() {} });
  let onFault, serial = 1, failPrepare = false;
  const initial = { manifest, generation: "g1", fingerprint: "hash1", enabled: true, directory: "selected" };
  const platform = {
    onFault(fn) { onFault = fn; return () => {}; },
    async call(method, input) {
      if (method === "restore") return [initial];
      if (method === "start") return { nodes: [], compilers: [], apis: [] };
      if (method === "stop") stopped.push(input.generation);
      if (method === "setEnabled") states.push(input);
      if (method === "inspect") return { token: "selected", manifest };
      if (method === "prepare") { if (failPrepare) throw Error("内容变化需要确认"); serial++; return { ...initial, generation: "g" + serial, fingerprint: "hash" + serial }; }
      return null;
    },
  };
  const management = createPluginManagement({ host: createPluginControl(runtime, platform, () => {}), platform, invalidate() {}, builtinIds: new Set(), setBuiltin() {} });
  try {
    await management.initialize();
    assert.equal(management.api.snapshot().plugins[0].bindings["workflow.nodes"], "$host");
    onFault({ generation: "g1", error: "进程崩溃" });
    await until(() => !management.busy && states.at(-1)?.enabled === false);
    assert.equal(management.api.snapshot().plugins[0].diagnostic.code, "PLUGIN_PROCESS_FAULT");
    assert.ok(stopped.includes("g1"));
    await management.api.setEnabled(manifest.id, true);
    failPrepare = true;
    await assert.rejects(management.api.reload(manifest.id), /确认/);
    assert.equal(management.api.snapshot().plugins[0].enabled, true);
    assert.equal(management.api.snapshot().plugins[0].fingerprint, "hash1");
    assert.equal(management.api.snapshot().plugins[0].diagnostic.code, "PLUGIN_RELOAD_FAILED");
    failPrepare = false;
    await management.api.reload(manifest.id);
    onFault({ generation: "g1", error: "旧故障" });
    await tick(); await tick();
    assert.equal(management.api.snapshot().plugins[0].enabled, true);
    assert.equal(management.api.snapshot().plugins[0].fingerprint, "hash2");
    assert.equal(management.api.snapshot().plugins[0].diagnostic, null);
  } finally { management.dispose(); await runtime.dispose(); }
});

test("P12 MCP 管理调用按实际方法分读写，拒绝混合请求、任意路径与批准入口", () => {
  for (const [method, input, permission] of [["snapshot", {}, "session.read"], ["previewDisable", { id: "studio.noise" }, "session.read"], ["setEnabled", { id: "studio.noise", enabled: false }, "session.write"], ["reload", { id: "local.test" }, "session.write"]]) {
    assert.equal(commandPermission({ pluginCall: { method, input } }), permission);
    assert.throws(() => commandPermission({ pluginCall: { method, input }, previewCall: { method: "status", input: {} } }), /混入/);
  }
  for (const value of [{ method: "install", input: {} }, { method: "reload", input: { id: "local.test", approvePermissions: true } }, { method: "reload", input: { path: "C:/arbitrary" } }]) assert.throws(() => readPluginCall(value));
});

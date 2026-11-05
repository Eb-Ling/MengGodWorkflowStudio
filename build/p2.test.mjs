import {documentPolicy} from '../plugins/workflow-service/document-policy.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { DocumentStore } from "../packages/kernel/document-store.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { ContributionRegistry } from "../packages/kernel/contribution-registry.mjs";
import { readDocument } from "../packages/plugin-sdk/document.mjs";
import { createDocumentController } from "../frontend/application/document-controller.js";
import { createNodeContributions } from "../frontend/application/node-contributions.js";
import { createNodeCatalog } from "../plugins/node-model/node-catalog.mjs";
import { WorkflowService } from "../plugins/workflow-service/document-session.mjs";
import { WorkflowRepository } from "../frontend/project/workflow-repository.js";
import { tintContribution } from "../plugins/example-showcase/tint-node.mjs";
import { layoutPlugin } from "../plugins/example-layout/index.mjs";
import { emitModule } from "../plugins/glsl-backend/emitter.mjs";
import { shader } from "../packages/shader-ir/index.mjs";
const emitExpression = (e) => {
  const m = shader.module("fragment");
  m.resources = [{ storage: "out", name: "color", type: e.type }];
  m.body = [shader.assign(shader.symbol(e.type, "color"), e)];
  const r = emitModule({ module: m, target: "glsl-430" });
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  return r.source;
};
import { createCommandGateway } from "../packages/kernel/command-gateway.mjs";
import { ir, validateExpression } from "../packages/plugin-sdk/ir.mjs";
const memory = () => {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => map.set(key, value),
  };
};
function fixture() {
  const session = memory(),
    local = memory(),
    catalog = createNodeCatalog(),
    service = new WorkflowService(new WorkflowRepository({ session, local }));
  const controller = createDocumentController({
    service,
    ...documentPolicy(()=>catalog),
    getStage: () => "fragment",
    onError: () => {},
  });
  return { ...controller, service, session, catalog };
}
const rename = (stage, nodeId, title) => ({
  stage,
  type: "RENAME_NODE",
  payload: { nodeId, title },
});

test("canonical document isolates current data and rejects all other document shapes", () => {
  const value = fixture().document.snapshot(),
    copy = readDocument(value);
  copy.graphs.fragment.nodes[0].title = "changed";
  assert.notEqual(value.graphs.fragment.nodes[0].title, "changed");
  assert.throws(() => readDocument({ ...value, documentVersion: "99.0.0" }));
  assert.throws(() =>
    readDocument({
      schemaVersion: 1,
      project: value.project,
      graph: value.graphs.fragment,
      vertexTransform: { ...value.geometry, graph: value.graphs.vertex },
    }),
  );
});

test("cross-stage eighth failure leaves document, both histories, redo and notifications untouched", () => {
  const { document } = fixture(),
    v = document.graph("vertex").nodes[0].id;
  document.transact({ commands: [rename("fragment", "uv_start", "first")] });
  document.undo("fragment");
  const before = document.snapshot(),
    history = document.history("fragment");
  let events = 0;
  document.subscribe(() => events++);
  const commands = Array.from({ length: 7 }, (_, i) =>
    rename(i % 2 ? "vertex" : "fragment", i % 2 ? v : "uv_start", "trial" + i),
  );
  commands.push({
    stage: "vertex",
    type: "CONNECT",
    payload: {
      link: { fromNode: "missing", fromSocket: "x", toNode: v, toSocket: "y" },
    },
  });
  assert.equal(document.transact({ commands }).ok, false);
  assert.deepEqual(document.snapshot(), before);
  assert.deepEqual(document.history("fragment"), history);
  assert.equal(events, 0);
});
test("joint history restores both stages, blocks conflicting later edits and preserves independent histories", () => {
  const { document } = fixture(),
    v = document.graph("vertex").nodes[0].id;
  assert.equal(
    document.transact({
      commands: [rename("vertex", v, "V"), rename("fragment", "uv_start", "F")],
    }).ok,
    true,
  );
  document.transact({ commands: [rename("fragment", "uv_start", "Later")] });
  assert.equal(document.undo("vertex").ok, false);
  assert.equal(document.undo("fragment").ok, true);
  assert.equal(document.undo("vertex").ok, true);
  assert.notEqual(document.graph("vertex").nodes[0].title, "V");
  assert.notEqual(document.graph("fragment").nodes[0].title, "F");
  assert.equal(document.redo("fragment").ok, true);
  assert.equal(document.graph("vertex").nodes[0].title, "V");
  assert.equal(document.redo("fragment").ok, true);
  assert.equal(document.graph("fragment").nodes[0].title, "Later");
  const revision = document.snapshot().revision;
  document.transact({ commands: [rename("vertex", v, "independent")] });
  document.undo("vertex");
  assert.equal(document.graph("fragment").nodes[0].title, "Later");
  assert.ok(document.snapshot().revision > revision);
  assert.equal(
    document.graph("fragment").revision,
    document.snapshot().revision,
  );
});
test("document metadata and geometry share an atomic commit and a single draft storage envelope", () => {
  const { document, service, session } = fixture();
  let events = 0;
  document.subscribe(() => events++);
  const before = document.snapshot();
  const result = document.transact({
    patch: { project: { title: "P2" }, geometry: { sx: 2 } },
    commands: [rename("fragment", "uv_start", "UV")],
  });
  assert.equal(result.ok, true);
  assert.equal(events, 1);
  assert.equal(service.config().title, "P2");
  assert.equal(service.transform().sx, 2);
  assert.equal(
    JSON.parse(session.getItem("workflow.document")).project.title,
    "P2",
  );
  assert.equal(document.undo("vertex").ok, true);
  assert.equal(service.config().title, before.project.title);
});
test("document gateway requires document revision and never mixes file actions into transactions", () => {
  const { document } = fixture();
  let actions = 0;
  const snapshot = () => ({
    project: document.snapshot().project,
    documentToken: "token",
    documentRevision: document.snapshot().revision,
    stage: "fragment",
    graph: document.graph("fragment"),
  });
  const gateway = createCommandGateway({
    snapshot,
    graphTransaction: (commands) =>
      document.transact({
        commands: commands.map((c) => ({ ...c, stage: "fragment" })),
      }),
    documentTransaction: (input) => document.transact(input),
    action: () => actions++,
  });
  const s = snapshot(),
    base = {
      documentId: s.project.id,
      documentToken: "token",
      stage: "fragment",
      expectedRevision: s.graph.revision,
    };
  const transaction = { patch: { project: { title: "changed" } } };
  assert.equal(
    gateway.execute({
      ...base,
      commands: [rename("vertex", "uv_start", "wrong stage")],
    }).ok,
    false,
  );
  assert.equal(document.snapshot().revision, s.documentRevision);
  assert.equal(gateway.execute({ ...base, transaction }).ok, false);
  assert.equal(
    gateway.execute({
      ...base,
      expectedDocumentRevision: 0,
      transaction,
      actions: [{ type: "SAVE_WORKFLOW", payload: {} }],
    }).ok,
    false,
  );
  assert.equal(actions, 0);
  assert.equal(
    gateway.execute({ ...base, expectedDocumentRevision: 0, transaction }).ok,
    true,
  );
});
test("node and target compiler registration is atomic, owned and produces validated typed IR", () => {
  const registry = new ContributionRegistry(),
    batch = tintContribution();
  assert.throws(() =>
    registry.register("example.showcase", "1.0.0", {
      ...batch,
      compilers: batch.compilers.slice(0, 1),
    }),
  );
  assert.equal(registry.list().length, 0);
  const handle = registry.register("example.showcase", "1.0.0", batch);
  assert.throws(() => registry.register("example.showcase", "1.0.0", batch));
  const expression = registry.compile("example.showcase.tint", "glsl-430", {
    node: { properties: batch.nodes[0].properties },
    socket: "color",
    outputType: "VEC4",
    inputs: {},
  });
  assert.match(emitExpression(expression), /vec4\(/);
  assert.throws(() =>
    registry.compile("example.showcase.tint", "glsl-430", {
      node: { properties: { red: 2, green: 0, blue: 0, alpha: 1 } },
      socket: "color",
      inputs: {},
    }),
  );
  handle.dispose();
  handle.dispose();
  assert.equal(registry.list().length, 0);
  assert.throws(() =>
    registry.compile("example.showcase.tint", "glsl-430", {}),
  );
});
test("registered node contracts feed the actual document policies and missing plugin content survives", () => {
  const { catalog, registry } = createNodeContributions(createNodeCatalog()),
    service = new WorkflowService(
      new WorkflowRepository({ session: memory(), local: memory() }),
    );
  const { document } = createDocumentController({
    service,
    ...documentPolicy(()=>catalog),
    getStage: () => "fragment",
    onError: () => {},
  });
  const batch = tintContribution(),
    handle = registry.register("example.showcase", "1.0.0", batch);
  const node = {
    id: "plugin-node",
    typeId: "example.showcase.tint",
    canvasX: 10,
    canvasY: 10,
    properties: batch.nodes[0].properties,
  };
  assert.equal(
    document.transact({
      commands: [{ stage: "fragment", type: "ADD_NODE", payload: { node } }],
    }).ok,
    true,
  );
  assert.equal(
    document.snapshot().requiredPlugins["example.showcase"],
    "1.0.0",
  );
  handle.dispose();
  assert.equal(
    document.transact({
      commands: [rename("fragment", "uv_start", "still-editable")],
    }).ok,
    true,
  );
  assert.ok(
    document.graph("fragment").nodes.some((n) => n.id === "plugin-node"),
  );
  registry.register("example.showcase", "1.0.0", batch);
  assert.equal(
    document.graph("fragment").nodes.find((n) => n.id === "plugin-node")
      .properties.blue,
    1,
  );
});
const manifest = (id, extra = {}) => ({
  id,
  name: id,
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {},
  ...extra,
});
const numberApi = {
  version: "1.0.0",
  methods: {
    value: {
      arguments: { type: "array", maxItems: 0 },
      returns: { type: "number" },
    },
  },
};
test("providers resolve without manual load order; cascading stop revokes cached calls and permits restart", async () => {
  const host = new PluginRuntime();
  let handle,
    stops = 0;
  host.register({
    manifest: manifest("test.consumer", {
      requiredApis: { "example.layout.grid": "^1.0.0" },
    }),
    activate(context) {
      handle = context.api("example.layout.grid").positions;
      context.onDispose(() => stops++);
    },
  });
  host.register(layoutPlugin);
  await host.setEnabled("test.consumer", true);
  assert.equal(handle({ count: 8 }).length, 8);
  assert.throws(() => handle({ count: -1 }));
  const stale = handle;
  const impact = await host.setEnabled("example.layout", false);
  assert.ok(impact.stop.includes("test.consumer"));
  assert.equal(stops, 1);
  assert.throws(() => stale({ count: 1 }), /撤销/);
  await host.setEnabled("test.consumer", true);
  assert.equal(handle({ count: 1 }).length, 1);
  await host.dispose();
});
test("optional API consumers restart in degraded mode when provider stops", async () => {
  const host = new PluginRuntime(),
    modes = [];
  host.register(layoutPlugin);
  host.register({
    manifest: manifest("test.optional", {
      optionalApis: { "example.layout.grid": "^1.0.0" },
    }),
    activate(context) {
      modes.push(context.hasApi("example.layout.grid"));
    },
  });
  await host.setEnabled("test.optional", true);
  assert.deepEqual(modes, [false]);
  await host.setEnabled("example.layout", true);
  assert.deepEqual(modes, [false, true]);
  await host.setEnabled("example.layout", false);
  assert.deepEqual(modes, [false, true, false]);
  assert.equal(host.list().find((p) => p.id === "test.optional").enabled, true);
  await host.dispose();
});
test("cycles, failed activation and undeclared capabilities roll back without registrations", async () => {
  const host = new PluginRuntime();
  const cycle = (id, other) => ({
    manifest: manifest(id, {
      requiredApis: { [other + ".api"]: "1.0.0" },
      providesApis: { [id + ".api"]: numberApi },
    }),
    activate(c) {
      c.provide(id + ".api", { value: () => 1 });
    },
  });
  host.register(cycle("test.a", "test.b"));
  assert.throws(() => host.register(cycle("test.b", "test.a")), /循环/);
  await assert.rejects(host.setEnabled("test.a", true), /缺少兼容/);
  assert.ok(host.list().every((p) => !p.enabled));
  const registry = new ContributionRegistry(),
    other = new PluginRuntime();
  other.provide(
    "workflow.nodes",
    "1.0.0",
    (owner, own) => ({
      register: (batch) => {
        const resource = registry.register(owner, "1.0.0", batch);
        own(() => resource.dispose());
        return resource;
      },
    }),
    true,
    { methods: { register: { capability: "nodes.register" } } },
  );
  other.register({
    manifest: manifest("example.showcase", {
      requiredApis: { "workflow.nodes": "1.0.0" },
      capabilities: ["nodes.register"],
    }),
    activate(c) {
      c.api("workflow.nodes").register(tintContribution());
      throw Error("activation failed");
    },
  });
  await assert.rejects(other.setEnabled("example.showcase", true));
  assert.equal(registry.list().length, 0);
  assert.throws(() =>
    other.register(
      {
        manifest: manifest("test.denied", { capabilities: ["nodes.register"] }),
        activate() {},
      },
      { grantedCapabilities: [] },
    ),
  );
});
test("explicit provider choice resolves ambiguity and enforces isolated schema-checked API data", async () => {
  const host = new PluginRuntime();
  for (const [id, value] of [
    ["test.one", 1],
    ["test.two", 2],
  ])
    host.register({
      manifest: manifest(id, {
        providesApis: { "contract.number": numberApi },
      }),
      activate: (c) => c.provide("contract.number", { value: () => value }),
    });
  let api;
  host.register({
    manifest: manifest("test.consumer", {
      requiredApis: { "contract.number": "^1.0.0" },
    }),
    activate: (c) => {
      api = c.api("contract.number");
    },
  });
  await assert.rejects(host.setEnabled("test.consumer", true), /多个提供者/);
  host.selectProvider("contract.number", "test.two");
  await host.setEnabled("test.consumer", true);
  assert.equal(api.value(), 2);
  assert.throws(
    () => host.selectProvider("contract.number", "test.one"),
    /停用/,
  );
  await host.dispose();
});
test("typed IR rejects mismatched operators, unknown functions and forged source escapes", () => {
  assert.throws(() =>
    validateExpression(
      ir.binary("FLOAT", "+", ir.literal("BOOL", true), ir.literal("FLOAT", 1)),
    ),
  );
  assert.throws(() =>
    validateExpression(ir.call("VEC4", "not_a_registered_function", [])),
  );
  assert.throws(() =>
    validateExpression({ kind: "source", type: "FLOAT", code: "injected" }),
  );
  assert.throws(() => validateExpression(ir.literal("UINT", -1)));
  assert.throws(() =>
    validateExpression(ir.call("VEC4", "vec4", [ir.input("VEC2", "uv")])),
  );
  assert.throws(() =>
    validateExpression(ir.call("MAT3", "mat3", [ir.input("VEC2", "uv")])),
  );
  assert.throws(() =>
    validateExpression(
      ir.call("BOOL", "pow", [
        ir.literal("BOOL", true),
        ir.literal("BOOL", false),
      ]),
    ),
  );
  const valid = ir.call("VEC4", "vec4", [ir.literal("FLOAT", 1)]);
  assert.match(emitExpression(validateExpression(valid)), /vec4/);
});
test("post-commit persistence failures keep committed state and still notify remaining observers", () => {
  const { document } = fixture();
  let notified = 0;
  document.subscribe(() => {
    throw Error("disk failure");
  });
  document.subscribe(() => notified++);
  document.onObserverError = () => {
    throw Error("observer failure");
  };
  assert.equal(
    document.transact({
      commands: [rename("fragment", "uv_start", "committed")],
    }).ok,
    true,
  );
  assert.equal(notified, 1);
  assert.equal(document.graph("fragment").nodes[0].title, "committed");
});

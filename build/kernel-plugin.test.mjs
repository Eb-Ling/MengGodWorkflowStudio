import ts from "typescript";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { GraphStore } from "../packages/kernel/graph-store.mjs";
import { compatibleVersion } from "../packages/kernel/index.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { createCommandGateway } from "../packages/kernel/command-gateway.mjs";
import { createNodeCatalog } from "../plugins/node-model/node-catalog.mjs";
import {starterGraph} from '../packages/workflow-tools/defaults.mjs';
import { createGraphSemantics } from "../packages/workflow-tools/graph-semantics.mjs";
import { createBridgeService } from "../plugins/mcp/bridge-service.mjs";
import { createMcpTools } from "../plugins/mcp/tool-service.mjs";
import { createStudioServer } from "../packages/native-host/http-server.mjs";
import { mcpServerPlugin } from "../plugins/mcp/server-plugin.mjs";
import { createEditorClient } from "../plugins/mcp-connection/editor-client.mjs";
const require = createRequire(import.meta.url);
const { openStdioClient } = require("../packages/native-host/stdio-client.cjs");
const root = path.resolve(import.meta.dirname, "..");
function editor() {
  let stage = "fragment",
    token = "test-document";
  const semantics = createGraphSemantics(
    () => createNodeCatalog(),
    () => stage,
  );
  const store = new GraphStore(starterGraph(), {
    starterGraph,
    nodeTitle: (node) => node.typeId,
    outputType: () => (stage === "vertex" ? "vertex.output" : "io.output"),
    connectionError: (graph, link) =>
      semantics.isInvalidBranchConnection(graph, link)
        ? "Invalid branch"
        : null,
    resolveTypes: semantics.resolveTypes,
    pruneInvalidLinks: semantics.pruneInvalidLinks,
    validateCommand: semantics.validateCommand,
  });
  let actions = 0;
  const gateway = createCommandGateway({
    snapshot: () => ({
      documentToken: token,
      stage,
      project: { id: "test" },
      graph: store.snapshot(),
      catalog: createNodeCatalog(),
    }),
    graphTransaction: (items) => store.batch(items),
    action: () => {
      actions++;
    },
  });
  const api = {
    ...gateway,
    subscribe: (listener) => store.subscribe(listener),
    onActivity: () => () => {},
  };
  const envelope = (commands) => ({
    documentId: "test",
    documentToken: token,
    stage,
    expectedRevision: store.snapshot().revision,
    commands,
  });
  return {
    store,
    api,
    envelope,
    setStage: (value) => {
      stage = value;
    },
    replace: () => {
      token += "-new";
    },
    actions: () => actions,
  };
}
const rename = (title) => ({
  type: "RENAME_NODE",
  payload: { nodeId: "uv_start", title },
});
const move = (x) => ({
  type: "MOVE_NODE",
  payload: { nodeId: "uv_start", x, y: 45 },
});

test("eighth invalid graph operation rolls back nodes, links, history, revision and events", () => {
  const { store } = editor();
  store.command("MOVE_NODE", move(15).payload);
  store.undo();
  const before = store.snapshot(),
    undo = [...store.undoStack],
    redo = [...store.redoStack];
  let events = 0;
  const stop = store.subscribe(() => {
    events++;
  });
  events = 0;
  const commands = Array.from({ length: 7 }, (_, index) => ({
    type: "ADD_NODE",
    payload: {
      node: {
        id: "batch_" + index,
        typeId: "studio.math.constant",
        title: "Constant",
        canvasX: index * 250,
        canvasY: 10,
        properties: { valueType: "FLOAT", value: "1" },
      },
    },
  }));
  commands.push({
    type: "CONNECT",
    payload: {
      link: {
        fromNode: "batch_0",
        fromSocket: "missing",
        toNode: "center_start",
        toSocket: "uv",
      },
    },
  });
  assert.equal(store.batch(commands).ok, false);
  assert.deepEqual(store.snapshot(), before);
  assert.deepEqual(store.undoStack, undo);
  assert.deepEqual(store.redoStack, redo);
  assert.equal(events, 0);
  stop();
});
test("UI and public graph API share atomic semantics and a single undo entry", () => {
  const ui = editor(),
    plugin = editor(),
    commands = [move(40), rename("Together")];
  assert.equal(ui.store.batch(commands).ok, true);
  assert.equal(plugin.api.execute(plugin.envelope(commands)).ok, true);
  assert.deepEqual(plugin.store.snapshot(), ui.store.snapshot());
  assert.equal(plugin.store.undoStack.length, 1);
  plugin.store.undo();
  assert.equal(plugin.store.node("uv_start").canvasX, 120);
  assert.notEqual(plugin.store.node("uv_start").title, "Together");
});
test("a failing post-commit observer does not turn a successful edit into a rejected transaction", () => {
  const { store } = editor();
  let fail = false,
    notified = 0,
    warnings = 0;
  store.policies.onListenerError = () => {
    warnings++;
  };
  store.subscribe(() => {
    if (fail) throw new Error("observer failure");
  });
  store.subscribe(() => {
    notified++;
  });
  notified = 0;
  fail = true;
  assert.equal(
    store.command("RENAME_NODE", rename("Committed").payload).ok,
    true,
  );
  assert.equal(store.node("uv_start").title, "Committed");
  assert.equal(warnings, 1);
  assert.equal(notified, 1);
});
test("public API rejects stale revisions, stage/project changes and mixed side effects before mutation", () => {
  const fixture = editor(),
    request = fixture.envelope([rename("Stale")]);
  fixture.store.command("MOVE_NODE", move(21).payload);
  fixture.store.undo();
  assert.equal(
    fixture.api.execute(request).ok,
    false,
    "Undo cannot resurrect a stale revision",
  );
  const current = fixture.envelope([rename("Wrong stage")]);
  fixture.setStage("vertex");
  assert.equal(fixture.api.execute(current).ok, false);
  fixture.setStage("fragment");
  fixture.replace();
  assert.equal(fixture.api.execute(current).ok, false);
  assert.equal(
    fixture.api.execute({
      ...fixture.envelope([rename("Mixed")]),
      actions: [{ type: "SAVE_WORKFLOW", payload: {} }],
    }).ok,
    false,
  );
  assert.equal(fixture.actions(), 0);
  const snapshot = fixture.api.snapshot();
  snapshot.graph.nodes.length = 0;
  assert.equal(fixture.store.snapshot().nodes.length, 3);
  const revision = fixture.store.snapshot().revision;
  fixture.store.reset();
  assert.ok(fixture.store.snapshot().revision > revision);
});
test("plugin lifecycle validates APIs, rolls back failed activation and revokes cached call handles", async () => {
  const host = new PluginRuntime();
  let active = 0,
    retained;
  host.provide("test.api", "1.2.0", Object.freeze({ run: () => "ok" }));
  const manifest = {
    id: "test.plugin",
    name: "Test",
    version: "1.0.0",
    apiVersion: "1.0.0",
    requiredApis: { "test.api": "^1.0.0" },
  };
  host.register({
    manifest,
    activate(context) {
      active++;
      context.onDispose(() => {
        active--;
      });
      retained = context.api("test.api").run;
      assert.throws(() => context.api("other.private"), /未声明/);
    },
  });
  await host.setEnabled("test.plugin", true);
  assert.equal(retained(), "ok");
  await host.setEnabled("test.plugin", false);
  assert.equal(active, 0);
  assert.throws(() => retained(), /撤销/);
  for (let i = 0; i < 3; i++) {
    await host.setEnabled("test.plugin", true);
    await host.setEnabled("test.plugin", false);
  }
  assert.equal(active, 0);
  host.register({
    manifest: { ...manifest, id: "test.failed" },
    activate(context) {
      active++;
      context.onDispose(() => {
        active--;
      });
      throw new Error("activation failure");
    },
  });
  await assert.rejects(
    host.setEnabled("test.failed", true),
    /activation failure/,
  );
  assert.equal(active, 0);
  host.register({
    manifest: {
      ...manifest,
      id: "test.missing",
      requiredApis: { "test.api": "^2.0.0" },
    },
    activate() {
      throw Error("must not run");
    },
  });
  await assert.rejects(host.setEnabled("test.missing", true), /兼容 API/);
  assert.equal(compatibleVersion("0.2.5", "^0.2.3"), true);
  assert.equal(compatibleVersion("0.3.0", "^0.2.3"), false);
  assert.equal(compatibleVersion("1.1.0", "^1.2.0"), false);
  await host.dispose();
});
function publish(bridge, fixture, editorId = "one", incarnation = "inc-one") {
  const identity = { editorId, incarnation };
  bridge.publish({ ...fixture.api.snapshot(), ...identity });
  return identity;
}
test("MCP lease is explicit, requests bind to an editor and are delivered at most once", async () => {
  const bridge = createBridgeService(),
    fixture = editor();
  const first = publish(bridge, fixture);
  assert.equal(bridge.state().editorConnected, false);
  bridge.activate(first);
  const second = publish(bridge, fixture, "two", "inc-two");
  assert.equal(bridge.state().activeEditorId, "one");
  const pending = bridge.submit(fixture.envelope([rename("Once")]));
  assert.equal(bridge.pull(second).requests.length, 0);
  const delivered = bridge.pull(first).requests;
  assert.equal(delivered.length, 1);
  assert.equal(bridge.pull(first).requests.length, 0);
  const result = fixture.api.execute(delivered[0]);
  assert.equal(result.ok, true);
  bridge.acknowledge({
    ...first,
    ...result,
    requestId: delivered[0].requestId,
  });
  assert.equal((await pending).ok, true);
  bridge.publish({ ...fixture.api.snapshot(), ...first });
  const cancelled = bridge.submit(fixture.envelope([rename("Cancelled")]));
  bridge.activate(second);
  assert.equal((await cancelled).ok, false);
  assert.equal(bridge.pull(second).requests.length, 0);
  bridge.dispose();
});
test("MCP reload, disable and timeout cancel pending work without replaying it", async () => {
  const fixture = editor(),
    bridge = createBridgeService({ timeoutMs: 20 });
  let identity = publish(bridge, fixture);
  bridge.activate(identity);
  const reload = bridge.submit(fixture.envelope([rename("Reload")]));
  identity = publish(bridge, fixture, "one", "reloaded");
  assert.equal((await reload).ok, false);
  bridge.activate(identity);
  const timed = bridge.submit(fixture.envelope([rename("Timeout")]));
  bridge.pull(identity);
  assert.equal((await timed).ok, false);
  assert.equal(bridge.pull(identity).requests.length, 0);
  const stopped = bridge.submit(fixture.envelope([rename("Disabled")]));
  bridge.dispose();
  assert.equal((await stopped).ok, false);
  assert.equal(bridge.state().editorConnected, false);
});
test("MCP tools run against the public contract without an editor implementation import", async () => {
  const fixture = editor();
  const service = createMcpTools({
    bridge: "memory",
    readState: async () => ({
      ...fixture.api.snapshot(),
      editorConnected: true,
    }),
    submit: async (request) => {
      const result = fixture.api.execute(request);
      if (!result.ok) throw Error(result.error);
      return result;
    },
  });
  await service.call(
    "workflow_submit_commands",
    fixture.envelope([rename("API only")]),
  );
  const summary = await service.call("workflow_get_summary");
  assert.equal(summary.graph.nodes[0].title, "API only");
  await assert.rejects(
    service.call("workflow_submit_commands", { commands: [move(1)] }),
    /expectedRevision/,
  );
});
test("real stdio tools reach the kernel through the optional MCP HTTP and editor adapters", async () => {
  const controlToken="a".repeat(64);
  const app = await createStudioServer({
    controlToken,
    frontendRoot: path.join(root, "build/ui"),
    plugins: [mcpServerPlugin],
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + app.server.address().port,
    fixture = editor(),
    preferences = new Map();
  const browser = createEditorClient({
    workflow: fixture.api,
    platform: {
      fetch:(url,options={})=>fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+controlToken}}),
      preferences: {
        get: (key) => preferences.get(key),
        set: (key, value) => preferences.set(key, value),
      },
    },
    port: app.server.address().port,
  });
  const grant=await (await fetch(base+'/host/access',{method:'POST',headers:{Authorization:'Bearer '+controlToken,'Content-Type':'application/json'},body:JSON.stringify({action:'issue',mode:'write'})})).json();
  const client = openStdioClient({
    executablePath: process.execPath,
    entry: path.join(root, "ai-gateway/mcp-client.mjs"),
    env: { WORKFLOW_BRIDGE_URL: base,WORKFLOW_MCP_TOKEN:grant.token },
  });
  try {
    await browser.activate();
    const init = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "integration", version: "1.0.0" },
    });
    assert.equal(init.protocolVersion, "2025-06-18");
    client.notify("notifications/initialized");
    const tools = await client.request("tools/list");
    assert.equal(tools.tools.length, 53);
    assert.ok(tools.tools.some(tool => tool.name === "workflow_project_file"));
    const edited = await client.request("tools/call", {
      name: "workflow_submit_commands",
      arguments: fixture.envelope([move(33), rename("Through stdio")]),
    });
    assert.notEqual(edited.isError, true);
    assert.equal(fixture.store.node("uv_start").title, "Through stdio");
    assert.equal(fixture.store.undoStack.length, 1);
    const before = fixture.store.snapshot();
    const rejected = await client.request("tools/call", {
      name: "workflow_submit_commands",
      arguments: fixture.envelope([
        rename("Partial"),
        {
          type: "CONNECT",
          payload: {
            link: {
              fromNode: "uv_start",
              fromSocket: "missing",
              toNode: "center_start",
              toSocket: "uv",
            },
          },
        },
      ]),
    });
    assert.equal(rejected.isError, true);
    assert.deepEqual(fixture.store.snapshot(), before);
    await app.host.setEnabled("studio.mcp", false);
    const disabled = await client.request("tools/call", {
      name: "workflow_get_summary",
      arguments: {},
    });
    assert.equal(disabled.isError, true);
    assert.match(disabled.content[0].text, /已撤销/);
    assert.equal(
      fixture.store.command("MOVE_NODE", move(99).payload).ok,
      true,
      "Editing works with MCP disabled",
    );
  } finally {
    client.close();
    await browser.dispose();
    await app.dispose();
  }
});
test("kernel and MCP imports respect the declared architecture boundary", async () => {
  for (const name of (await fs.readdir(path.join(root, "packages/kernel"))).filter(name=>name.endsWith(".mjs"))) {
    const text = await fs.readFile(
      path.join(root, "packages/kernel", name),
      "utf8",
    );
    assert.doesNotMatch(
      text,
      /(?:from|import\s*\()[^\n]*(?:frontend|plugins\/|electron|vue|node:)/,
      name,
    );
    const ast=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true);
    const inspect=node=>{if(ts.isPropertyAccessExpression(node)&&ts.isIdentifier(node.expression))assert.ok(!['document','window','localStorage','sessionStorage'].includes(node.expression.text),name+': DOM global');ts.forEachChild(node,inspect);};inspect(ast);
  }
  for (const name of (await fs.readdir(path.join(root, "plugins/mcp"))).filter(name=>/\.(mjs|cjs|ts|vue)$/.test(name))) {
    const text = await fs.readFile(
      path.join(root, "plugins/mcp", name),
      "utf8",
    );
    assert.doesNotMatch(
      text,
      /(?:from|import\s*\(|require\s*\()[^\n]*(?:frontend|packages\/kernel|packages\/native-host)/,
      name,
    );
    assert.doesNotMatch(
      text,
      /\bdocument\s*\.(?:querySelector|getElementById)/,
      name,
    );
  }
});

test("空闲轮询续租不发布文档，过期或未知的编辑器必须重新发布", () => {
  let ms = 1000;
  const bridge = createBridgeService({now:()=>ms,leaseMs:100});
  const id = {editorId:"pan",incarnation:"one"};
  try {
    assert.equal(bridge.pull(id).needsState,true);
    bridge.publish({...id,documentToken:"doc",project:{id:"p"},graph:{nodes:[]}});
    bridge.activate(id);
    for(let i=0;i<5;i++){ms+=70; assert.deepEqual(bridge.pull(id).requests,[]);}
    assert.equal(bridge.state().editorConnected,true);
    ms+=120;
    assert.equal(bridge.pull(id).needsState,true);
    assert.equal(bridge.state().editorConnected,false);
  } finally { bridge.dispose(); }
});

test("组件反复取消订阅立即释放宿主登记，剩余订阅仍由宿主兜底", async () => {
  const {ownCleanup}=await import("../packages/plugin-sdk/registration.mjs");
  const callbacks=new Set();
  const own=fn=>{callbacks.add(fn);return ()=>callbacks.delete(fn);};
  let releases=0;
  for (let i=0;i<100;i++){
    const stop=ownCleanup(own,()=>releases++);
    stop(); stop();
    assert.equal(callbacks.size,0);
  }
  ownCleanup(own,()=>releases++);
  for(const release of callbacks) release();
  assert.equal(releases,101);
  assert.equal(callbacks.size,0);
});

test("窗口异常退出且无新请求时，租约到期自行释放快照并结清命令", async (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  let now=1000;
  const f=editor(), bridge=createBridgeService({leaseMs:100,timeoutMs:8000,now:()=>now});
  try {
    const id=publish(bridge,f);
    bridge.activate(id);
    const pending=bridge.submit(f.envelope([rename("Expired")]));
    now+=101;
    t.mock.timers.tick(101);
    assert.match((await pending).error,/连接已过期/);
    assert.equal(bridge.pull(id).needsState,true);
    assert.equal(bridge.state().graph,null);
  } finally { bridge.dispose(); }
});

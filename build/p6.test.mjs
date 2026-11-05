import {createPluginControl} from '../frontend/application/plugin-control.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import {
  readPluginManifest,
  pluginManifestDraft,
} from "../packages/plugin-sdk/plugin-manifest.mjs";
import {
  validateRemoteCall,
  readExtensionMessage,
  extensionJson,
} from "../packages/plugin-sdk/extension-protocol.mjs";
import {
  readUiTree,
  extensionUiContract,
} from "../packages/plugin-sdk/extension-ui.mjs";
import { createExtensionRuntime } from "../packages/extension-host/runtime.mjs";
import { createExtensionUiService } from "../plugins/extension-ui/service.mjs";
import { createPluginRepository } from "../packages/native-host/plugin-repository.mjs";
import { createPluginManagement } from "../plugins/plugin-service/management.mjs";
const manifest = (id) => ({
  ...pluginManifestDraft(id, "index.mjs", "extension"),
  id,
});
const tree = {
  id: "root",
  type: "column",
  children: [
    { id: "go", type: "button", label: "执行" },
    { id: "step", type: "number", value: 32, min: 1, max: 1000 },
  ],
};
const scalarApi = {
  version: "1.0.0",
  methods: {
    value: {
      arguments: { type: "array", maxItems: 0 },
      returns: { type: "number" },
    },
  },
};
test("隔离协议拒绝旧版本、非 JSON、越权 API 与文件管理动作", () => {
  const m = manifest("local.test");
  assert.throws(() => readExtensionMessage({ protocol: 2, id: 1 }), /版本/);
  assert.throws(() => extensionJson({ fn() {} }), /JSON/);
  assert.throws(() => extensionJson("汉".repeat(800000)), /2 MB/);
  assert.throws(
    () =>
      readPluginManifest({
        ...m,
        providesApis: {
          "local.test.api": {
            version: "1.0.0",
            methods: {
              value: {
                arguments: {
                  type: "array",
                  items: { type: "string", pattern: "(a+)+$" },
                },
                returns: { type: "string" },
              },
            },
          },
        },
      }),
    /schema/,
  );
  assert.deepEqual(
    validateRemoteCall(m, {
      api: "workflow.editor",
      method: "snapshot",
      args: [],
      generation: "another-plugin",
      requestId: 77,
      protocol: 9,
    }),
    { api: "workflow.editor", method: "snapshot", args: [] },
  );
  assert.throws(
    () =>
      validateRemoteCall(m, {
        api: "platform.browser",
        method: "fetch",
        args: [],
      }),
    /未声明/,
  );
  assert.throws(
    () =>
      validateRemoteCall(m, {
        api: "workflow.editor",
        method: "subscribe",
        args: [],
      }),
    /未开放/,
  );
  assert.throws(
    () =>
      validateRemoteCall(
        { ...m, capabilities: ["workflow.read"] },
        { api: "workflow.editor", method: "execute", args: [{}] },
      ),
    /缺少能力/,
  );
  assert.throws(
    () =>
      validateRemoteCall(m, {
        api: "workflow.editor",
        method: "execute",
        args: [{ actions: [{ type: "DELETE_WORKFLOW" }] }],
      }),
    /草稿/,
  );
  assert.throws(
    () =>
      readPluginManifest({
        ...m,
        requiredApis: { "platform.browser": "^1.0.0" },
        capabilities: ["platform.network"],
      }),
    /未开放/,
  );
  assert.throws(
    () =>
      readPluginManifest({ ...m, providesApis: { "foreign.api": scalarApi } }),
    /命名空间/,
  );
  assert.throws(
    () =>
      readPluginManifest({
        ...m,
        providesApis: { "local.test.api": { ...scalarApi, scoped: true } },
      }),
    /JSON/,
  );
});
test("目录扩展首次能力确认、磁盘提权拒绝、重新审阅与当前协议恢复", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-p6-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, "plugin");
  await fs.mkdir(folder);
  const indexFile = path.join(root, "index.json"),
    repo = createPluginRepository({ indexFile }),
    draft = await repo.inspect(1, folder),
    m = manifest("local.ui");
  await assert.rejects(
    repo.prepare(1, { token: draft.token, manifest: m, createTemplate: true }),
    /确认/,
  );
  const p = await repo.prepare(1, {
    token: draft.token,
    manifest: m,
    createTemplate: true,
    approvePermissions: true,
  });
  await repo.commit(1, p.generation);
  assert.equal((await repo.restore(2))[0].error, undefined);
  const changed = { ...m, optionalApis: { "local.calc.api": "^1.0.0" } };
  await fs.writeFile(
    path.join(folder, "studio-plugin.json"),
    JSON.stringify(changed),
  );
  assert.match((await repo.restore(3))[0].error, /确认/);
  const edit = await repo.inspectRegistered(1, m.id);
  assert.equal(edit.permissionsApproved, false);
  const approved = await repo.prepare(1, {
    token: edit.token,
    manifest: edit.manifest,
    approvePermissions: true,
  });
  await repo.commit(1, approved.generation);
  assert.equal(
    (await repo.inspectRegistered(1, m.id)).permissionsApproved,
    true,
  );
  await repo.remove(m.id);
  assert.ok(await fs.stat(path.join(folder, "index.mjs")));
});
test("声明式 UI 校验、所有者隔离、旧事件拒绝与重复启停清理", () => {
  const mounted = [],
    service = createExtensionUiService(
      (p) => {
        const value = { ...p, disposed: false };
        mounted.push(value);
        return {
          dispose() {
            value.disposed = true;
          },
        };
      },
      (v) => v,
    ),
    cleanups = [];
  const a = service.scoped("local.a", (f) => cleanups.push(f)),
    b = service.scoped("local.b", (f) => cleanups.push(f));
  assert.throws(
    () => readUiTree({ ...tree, html: "<script>x</script>" }),
    /未开放/,
  );
  assert.throws(
    () =>
      readUiTree({
        ...tree,
        children: [
          { id: "a", type: "button" },
          { id: "a", type: "text" },
        ],
      }),
    /重复/,
  );
  a.create({ id: "local.a.panel", title: "A", tree });
  assert.throws(() => b.update({ id: "local.a.panel", tree }), /不属于/);
  mounted[0].send({ controlId: "go", type: "click", value: null, revision: 1 });
  assert.equal(a.events({}).events.length, 1);
  assert.equal(b.events({}).events.length, 0);
  a.update({ id: "local.a.panel", tree });
  mounted[0].send({ controlId: "go", type: "click", value: null, revision: 1 });
  assert.equal(a.events({}).cursor, 1);
  a.remove({ id: "local.a.panel" });
  a.create({ id: "local.a.panel", title: "New", tree });
  assert.equal(
    a.events({}).events.length,
    0,
    "removed/replaced trees cannot replay queued clicks",
  );
  mounted[0].send({ controlId: "go", type: "click", value: null, revision: 1 });
  assert.equal(a.events({}).cursor, 1);
  for (let i = 0; i < 500; i++)
    mounted[1].send({
      controlId: "step",
      type: "change",
      value: i,
      revision: 1,
    });
  assert.ok(a.events({}).events.length <= 2);
  for (let i = 0; i < 130; i++)
    mounted[1].send({
      controlId: "go",
      type: "click",
      value: null,
      revision: 1,
    });
  a.update({ id: "local.a.panel", tree });
  assert.equal(
    a.events({}).truncated,
    true,
    "loss remains observable after queue shrinks",
  );
  for (const cleanup of cleanups) cleanup();
  service.dispose();
  assert.ok(mounted.every((p) => p.disposed));
  assert.throws(() => a.events({}), /撤销/);
});
test("三种界面放置共用所有权和配额，非法位置无注册，更新及移除不串消费者", () => {
  const mounted = [], cleanups = [];
  const service = createExtensionUiService(p => {
    const record = { ...p, disposed: false }; mounted.push(record);
    return { dispose() { record.disposed = true; } };
  }, x => x);
  const a = service.scoped("local.a", f => cleanups.push(f));
  const b = service.scoped("local.b", f => cleanups.push(f));
  for (const placement of ["dock", "settings", "dialog"]) {
    a.create({ id: "local.a." + placement, title: placement, placement, tree });
    assert.equal(mounted.at(-1).placement, placement);
  }
  assert.throws(() => a.create({id:"local.a.invalid",title:"Invalid",placement:"html",tree}), /放置/);
  assert.equal(mounted.length, 3);
  assert.throws(() => b.update({id:"local.a.dialog",tree}), /不属于/);
  a.update({id:"local.a.dialog",tree});
  mounted[2].send({controlId:"go",type:"click",value:null,revision:1});
  assert.equal(a.events({}).events.length, 0);
  for (let i=3;i<8;i++) a.create({id:"local.a.panel"+i,title:"Quota",placement:"settings",tree});
  assert.throws(() => a.create({id:"local.a.ninth",title:"Over",placement:"dialog",tree}), /上限/);
  b.create({id:"local.b.dialog",title:"B",placement:"dialog",tree});
  a.remove({id:"local.a.dialog"});
  assert.equal(mounted[2].disposed,true);
  assert.equal(mounted.at(-1).disposed,false);
  for (const stop of cleanups) stop();
  assert.ok(mounted.every(p=>p.disposed));
  service.dispose();
});
test("JSON 作用域由内核注入所有者，三轮停用回收且不跨所有者", async () => {
  const host = new PluginRuntime(),
    scopes = new Set();
  host.register({
    manifest: {
      id: "local.provider",
      name: "Provider",
      version: "1.0.0",
      apiVersion: "1.0.0",
      requiredApis: {},
      providesApis: {
        "local.provider.api": {
          version: "1.0.0",
          transport: "json",
          scoped: true,
          methods: {
            owner: {
              arguments: { type: "array" },
              returns: { type: "string" },
            },
          },
        },
      },
    },
    activate(c) {
      c.provide("local.provider.api", (owner, own) => {
        scopes.add(owner);
        own(() => scopes.delete(owner));
        return { owner: () => owner };
      });
    },
  });
  let cached;
  host.register({
    manifest: {
      ...manifest("local.consumer"),
      requiredApis: { "local.provider.api": "^1.0.0" },
      capabilities: [],
    },
    activate(c) {
      cached = c.api("local.provider.api").owner;
      assert.equal(cached(), "local.consumer");
    },
  });
  for (let i = 0; i < 3; i++) {
    await host.setEnabled("local.consumer", true);
    assert.equal(scopes.size, 1);
    await host.setEnabled("local.provider", false);
    assert.equal(scopes.size, 0);
    assert.throws(() => cached(), /撤销/);
  }
  await host.dispose();
});
test("隔离 SDK 调用公开异步 API、提供 JSON API、停用撤销缓存", async () => {
  const m = {
      ...manifest("local.logic"),
      providesApis: { "local.logic.calc": scalarApi },
    },
    calls = [];
  let cached,
    cleaned = false;
  const runtime = createExtensionRuntime({
    load: async () => ({
      plugin: {
        async activate(c) {
          cached = c.api("workflow.editor");
          const value = await cached.snapshot();
          assert.equal(value.n, 4);
          c.provide("local.logic.calc", { value: () => value.n + 1 });
          c.onDispose(() => {
            cleaned = true;
          });
        },
      },
    }),
    call: async (request) => {
      calls.push(request);
      return { n: 4 };
    },
  });
  const result = await runtime.execute({
    method: "activate",
    payload: { manifest: m, entryUrl: "ignored" },
  });
  assert.deepEqual(result.apis, ["local.logic.calc"]);
  assert.equal(
    await runtime.execute({
      method: "invoke",
      payload: { api: "local.logic.calc", method: "value", args: [] },
    }),
    5,
  );
  assert.equal(calls.length, 1);
  await runtime.execute({ method: "dispose", payload: {} });
  assert.equal(cleaned, true);
  assert.throws(() => cached.snapshot(), /停用/);
});
test("重启先登记全部声明，消费者排在提供者之前也由内核安排激活", async () => {
  const host = new PluginRuntime(),
    provider = {
      ...manifest("local.provider"),
      requiredApis: {},
      capabilities: [],
      providesApis: { "local.provider.api": scalarApi },
    },
    consumer = {
      ...manifest("local.consumer"),
      requiredApis: { "local.provider.api": "^1.0.0" },
      capabilities: [],
    },
    started = [];
  const platform = {
    onFault: () => () => {},
    call: async (method, input) => {
      if (method === "restore")
        return [
          { manifest: consumer, generation: "c", enabled: true },
          { manifest: provider, generation: "p", enabled: true },
        ];
      if (method === "start") {
        started.push(input.generation);
        return {
          nodes: [],
          compilers: [],
          apis: input.generation === "p" ? ["local.provider.api"] : [],
        };
      }
      return null;
    },
  };
  const management = createPluginManagement({host:createPluginControl(host,platform,()=>{}),
    platform,
    invalidate() {},
    builtinIds: new Set(),
    setBuiltin() {},
  });
  await management.initialize();
  assert.deepEqual(started, ["p", "c"]);
  assert.ok(host.list().every((p) => p.enabled));
  await host.dispose();
  management.dispose();
});
test("资源提前释放可取消内核兜底登记，失败清理不跳过剩余项", async () => {
  const host = new PluginRuntime();
  let calls = 0;
  host.register({
    manifest: {
      ...manifest("local.cleanup"),
      requiredApis: {},
      capabilities: [],
    },
    activate(c) {
      for (let i = 0; i < 100; i++) {
        const cleanup = () => calls++;
        const forget = c.onDispose(cleanup);
        cleanup();
        forget();
      }
      c.onDispose(() => calls++);
    },
  });
  await host.setEnabled("local.cleanup", true);
  await host.setEnabled("local.cleanup", false);
  assert.equal(calls, 101);
});

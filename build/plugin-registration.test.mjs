import {createPluginControl} from '../frontend/application/plugin-control.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ContributionRegistry } from "../packages/kernel/index.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { createPluginRepository } from "../packages/native-host/plugin-repository.mjs";
import {
  pluginManifestDraft,
  readPluginManifest,
} from "../packages/plugin-sdk/plugin-manifest.mjs";
import { externalPlugin } from "../frontend/application/external-plugin.mjs";
import { createPluginManagement } from "../plugins/plugin-service/management.mjs";
import { ir } from "../packages/plugin-sdk/ir.mjs";

async function repositoryFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-plugins-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "my-nodes");
  await fs.mkdir(directory);
  const indexFile = path.join(root, "profile", "plugins.json");
  return {
    root,
    directory,
    indexFile,
    repo: createPluginRepository({ indexFile, reservedIds: ["studio.math"] }),
  };
}
test("目录声明、生成入口、持久化、重启停用状态及移除仅删除登记", async (t) => {
  const { repo, directory, indexFile } = await repositoryFixture(t),
    draft = await repo.inspect(1, directory);
  assert.equal(draft.hasManifest, false);
  assert.deepEqual(draft.entries, []);
  await assert.rejects(
    repo.prepare(2, { token: draft.token, manifest: draft.manifest }),
    /失效/,
  );
  const prepared = await repo.prepare(1, {
    token: draft.token,
    manifest: draft.manifest,
    createTemplate: true,
  });
  assert.match(
    repo.bundle(1, prepared.generation).files["index.mjs"],
    /workflow.nodes/,
  );
  await repo.commit(1, prepared.generation);
  await repo.setEnabled(prepared.manifest.id, false);
  const restored = await createPluginRepository({ indexFile }).restore(3);
  assert.equal(restored[0].enabled, false);
  await repo.remove(prepared.manifest.id);
  assert.equal((await repo.list()).length, 0);
  assert.ok(await fs.stat(path.join(directory, "index.mjs")));
});
test("打开插件目录只解析内置映射与已登记 ID，支持停用项并报告丢失目录", async (t) => {
  const { directory, indexFile } = await repositoryFixture(t);
  const repo = createPluginRepository({
    indexFile,
    builtinDirectories: { "studio.math": directory },
    reservedIds: ["studio.math"],
  });
  assert.equal(await repo.directory("studio.math"), await fs.realpath(directory));
  await assert.rejects(repo.directory(directory), /未登记/);
  await assert.rejects(repo.directory("__proto__"), /未登记/);
  await assert.rejects(repo.directory({ path: directory }), /ID 无效/);
  const draft = await repo.inspect(1, directory);
  const prepared = await repo.prepare(1, { token: draft.token, manifest: draft.manifest, createTemplate: true });
  await repo.commit(1, prepared.generation, false);
  assert.equal(await repo.directory(prepared.manifest.id), await fs.realpath(directory));
  // 仅移动本测试刚创建的临时目录，模拟用户在系统中移动插件。
  await fs.rename(directory, directory + "-moved");
  await assert.rejects(repo.directory(prepared.manifest.id), /不存在或已移动/);
  await repo.remove(prepared.manifest.id);
  await assert.rejects(repo.directory(prepared.manifest.id), /未登记/);
});
test("越界入口、未知能力、重复 ID、覆盖模板与失效目录被拒绝", async (t) => {
  const { repo, directory } = await repositoryFixture(t),
    d = await repo.inspect(1, directory);
  for (const changes of [
    { entry: "../x.mjs" },
    { entry: "C:/x.mjs" },
    { kind: "ui" },
    { capabilities: ["filesystem.write"] },
  ])
    assert.throws(() => readPluginManifest({ ...d.manifest, ...changes }));
  await assert.rejects(
    repo.prepare(1, {
      token: d.token,
      manifest: { ...d.manifest, id: "studio.math" },
      createTemplate: true,
    }),
    /冲突/,
  );
  const p = await repo.prepare(1, {
    token: d.token,
    manifest: d.manifest,
    createTemplate: true,
  });
  await repo.commit(1, p.generation);
  await assert.rejects(
    repo.prepare(1, { token: d.token, manifest: d.manifest }),
    /已登记/,
  );
  const again = await repo.inspectRegistered(1, p.manifest.id);
  await assert.rejects(
    repo.prepare(1, {
      token: again.token,
      manifest: again.manifest,
      createTemplate: true,
    }),
    /覆盖/,
  );
  repo.releaseOwner(1);
  assert.throws(() => repo.bundle(1, p.generation), /失效/);
});
test("写登记失败回滚新声明和模板，保留已有代码", async (t) => {
  const { repo, directory, indexFile } = await repositoryFixture(t),
    d = await repo.inspect(1, directory);
  await fs.mkdir(path.dirname(indexFile), { recursive: true });
  await fs.mkdir(indexFile);
  const p = await repo.prepare(1, {
    token: d.token,
    manifest: d.manifest,
    createTemplate: true,
  });
  await assert.rejects(repo.commit(1, p.generation));
  assert.equal(
    await fs.stat(path.join(directory, "index.mjs")).then(
      () => true,
      () => false,
    ),
    false,
  );
  assert.equal(
    await fs.stat(path.join(directory, "studio-plugin.json")).then(
      () => true,
      () => false,
    ),
    false,
  );
});
test("链接目录不能导出读取范围", async (t) => {
  const { repo, directory, root } = await repositoryFixture(t),
    outside = path.join(root, "outside");
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, "secret.mjs"), "secret");
  await fs.symlink(outside, path.join(directory, "linked"), "junction");
  await assert.rejects(repo.inspect(1, directory), /链接/);
});
const manifest = pluginManifestDraft("test");
test("内核替换失败恢复旧贡献，卸载回收，旧 API 句柄撤销", async () => {
  const host = new PluginRuntime();
  let mounted = 0,
    ctx;
  host.provide("workflow.nodes", "1.0.0", {});
  const old = {
    manifest,
    activate(c) {
      ctx = c;
      mounted++;
      c.onDispose(() => mounted--);
    },
  };
  host.register(old);
  await host.setEnabled(manifest.id, true);
  const before = ctx;
  await assert.rejects(
    host.replace({
      manifest,
      activate() {
        throw Error("bad update");
      },
    }),
    /bad update/,
  );
  assert.equal(mounted, 1);
  assert.equal(host.list()[0].enabled, true);
  assert.equal(before.hasApi("workflow.nodes"), false);
  await host.unregister(manifest.id);
  assert.equal(mounted, 0);
  assert.deepEqual(host.list(), []);
});
function setup() {
  const host = new PluginRuntime(),
    registry = new ContributionRegistry();
  host.provide(
    "workflow.nodes",
    "1.0.0",
    (_id, own) => ({
      register(batch) {
        const h = registry.register(manifest.id, "1.0.0", batch);
        own(() => h.dispose());
        return h;
      },
    }),
    true,
  );
  return { host, registry };
}
const contribution = {
  nodes: [
    {
      typeId: manifest.id + ".value",
      title: "Value",
      inputs: [],
      outputs: [{ name: "value", type: "FLOAT" }],
      properties: {},
      targets: ["glsl-es-300"],
    },
  ],
  compilers: [{ typeId: manifest.id + ".value", target: "glsl-es-300" }],
};
const ctx = {
  node: { properties: {} },
  socket: "value",
  outputType: "FLOAT",
  inputs: {},
};
test("隔离编译首次等待受检结果，同键合并，停用释放贡献并拒绝迟到结果", async () => {
  const { host, registry } = setup();
  let finish,
    stops = 0,
    calls = 0;
  const platform = {
    call: async (method) =>
      method === "start"
        ? contribution
        : method === "stop"
          ? (stops++, null)
          : (calls++, new Promise((r) => (finish = r))),
  };
  host.register(
    externalPlugin(
      { manifest, generation: "test" },
      platform,
    ),
  );
  await host.setEnabled(manifest.id, true);
  const first = registry.compile(manifest.id + ".value", "glsl-es-300", ctx);
  const same = registry.compile(manifest.id + ".value", "glsl-es-300", ctx);
  assert.equal(calls, 1);
  finish(ir.literal("FLOAT", 2));
  assert.equal((await first).value, 2);
  assert.equal((await same).value, 2);
  assert.equal(
    (await registry.compile(manifest.id + ".value", "glsl-es-300", ctx)).value,
    2,
  );
  assert.equal(calls, 1);
  const other = { ...ctx, node: { properties: { value: 2 } } };
  const late = registry.compile(manifest.id + ".value", "glsl-es-300", other);
  await host.setEnabled(manifest.id, false);
  finish(ir.literal("FLOAT", 3));
  await assert.rejects(late, /撤销/);
  assert.equal(calls, 2);
  assert.equal(stops, 1);
  assert.deepEqual(registry.list(), []);
});
test("目录插件不能绕过受检 IR 注入 GLSL", async () => {
  const { host, registry } = setup(),
    platform = {
      call: async (method) =>
        method === "start"
          ? contribution
          : method === "compile"
            ? { kind: "source", type: "FLOAT", code: "evil()" }
            : null,
    };
  host.register(
    externalPlugin({ manifest, generation: "test" }, platform),
  );
  await host.setEnabled(manifest.id, true);
  await assert.rejects(() =>
    registry.compile(manifest.id + ".value", "glsl-es-300", ctx),
  );
  await host.dispose();
});
test("管理 API 安装失败不留定义，登记写失败恢复旧插件", async () => {
  const { host, registry } = setup();
  let number = 0,
    commitFail = false;
  const platform = {
    onFault: () => () => {},
    call: async (method, input) => {
      if (method === "prepare")
        return { manifest, generation: String(++number), directory: "fixture" };
      if (method === "start") return contribution;
      if (method === "compile")
        return ir.literal("FLOAT", Number(input.generation));
      if (method === "commit" && commitFail) throw Error("disk full");
    },
  };
  const management = createPluginManagement({host:createPluginControl(host,platform,()=>{}),
    platform,
    invalidate: () => {},
    builtinIds: new Set(),
    setBuiltin: () => {},
  });
  await management.api.install({ token: "fixture" }, manifest);
  assert.equal(registry.list().length, 1);
  commitFail = true;
  await assert.rejects(
    management.api.install({ token: "fixture" }, manifest),
    /disk full/,
  );
  assert.equal(host.list()[0].enabled, true);
  assert.equal(registry.list().length, 1);
  await management.api.remove(manifest.id);
  assert.deepEqual(registry.list(), []);
  assert.deepEqual(host.list(), []);
});

test("目录消费者自动启用提供者和级联停用的实际状态同步保存，后续同步不撤销用户操作", async () => {
  const {host}=setup();
  host.register({manifest:{id:'test.provider',name:'Provider',version:'1.0.0',apiVersion:'1.0.0',requiredApis:{},providesApis:{'test.value':{version:'1.0.0',methods:{get:{arguments:{type:'array'},returns:{type:'number'}}}}}},activate(c){c.provide('test.value',{get:()=>1});}});
  const local={...manifest,requiredApis:{...manifest.requiredApis,'test.value':'^1.0.0'}};
  const persisted=new Map();
  const platform={onFault:()=>()=>{},call:async(method,input)=>{
    if(method==='prepare')return {manifest:local,generation:'g',directory:'fixture'};
    if(method==='start')return contribution;
    if(method==='setEnabled')persisted.set(input.id,input.enabled);
  }};
  const management=createPluginManagement({host:createPluginControl(host,platform,()=>{}),platform,builtinIds:new Set(['test.provider']),invalidate(){},
    setBuiltin:(id,enabled)=>host.setEnabled(id,enabled),
    persistBuiltinState:async()=>{persisted.set('test.provider',host.list().find(p=>p.id==='test.provider').enabled);}});
  await management.api.install({token:'fixture'},local);
  assert.equal(persisted.get('test.provider'),true);assert.equal(persisted.get(local.id),true);
  const impact=management.api.previewDisable('test.provider');
  await management.api.setEnabled('test.provider',false,impact.reviewKey);
  assert.equal(persisted.get('test.provider'),false);assert.equal(persisted.get(local.id),false);
  await management.api.setEnabled(local.id,true);
  assert.equal(persisted.get('test.provider'),true);assert.equal(persisted.get(local.id),true);
  await host.setEnabled('test.provider',persisted.get('test.provider'));
  assert.equal(host.list().find(p=>p.id===local.id).enabled,true);
  management.dispose();await host.dispose();
});
test("MCP 目标阶段与当前上下文守卫互不覆盖", async () => {
  const { createMcpTools } = await import("../plugins/mcp/tool-service.mjs");
  let request;
  const service = createMcpTools({
    readState: async () => ({}),
    submit: async (value) => ((request = value), { ok: true }),
    bridge: "fixture",
  });
  const guards = {
    documentId: "doc",
    documentToken: "token",
    stage: "fragment",
    expectedRevision: 3,
  };
  await service.call("workflow_set_stage", {
    ...guards,
    targetStage: "vertex",
  });
  assert.equal(request.stage, "fragment");
  assert.deepEqual(request.actions, [
    { type: "SET_STAGE", payload: { stage: "vertex" } },
  ]);
  await assert.rejects(
    service.call("workflow_set_stage", guards),
    /targetStage/,
  );
});

test("内核热替换提供者后可选消费者重新绑定", async () => {
  const host = new PluginRuntime(),
    states = [];
  const provider = {
    manifest: {
      id: "test.provider",
      version: "1.0.0",
      apiVersion: "1.0.0",
      requiredApis: {},
      providesApis: {
        "test.service": {
          version: "1.0.0",
          methods: {
            get: {
              arguments: { type: "array", items: {} },
              returns: { type: "number" },
            },
          },
        },
      },
    },
    activate(c) {
      c.provide("test.service", { get: () => 1 });
    },
  };
  const consumer = {
    manifest: {
      id: "test.consumer",
      version: "1.0.0",
      apiVersion: "1.0.0",
      requiredApis: {},
      optionalApis: { "test.service": "^1.0.0" },
    },
    activate(c) {
      states.push(c.hasApi("test.service") ? c.api("test.service").get() : 0);
    },
  };
  host.register(provider);
  host.register(consumer);
  await host.setEnabled("test.provider", true);
  await host.setEnabled("test.consumer", true);
  await host.replace({
    ...provider,
    activate(c) {
      c.provide("test.service", { get: () => 2 });
    },
  });
  assert.deepEqual(states, [1, 0, 2]);
  await host.dispose();
});


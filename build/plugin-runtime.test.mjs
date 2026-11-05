// 开发者边界测试，用户验收另通过真实发布版的公开 MCP 执行。
import test from "node:test";
import assert from "node:assert/strict";
import { PluginHost } from "../packages/kernel/index.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { createPluginContext } from "../packages/plugin-runtime/context.mjs";
import { createExtensionRuntime } from "../packages/extension-host/runtime.mjs";

const manifest = (id, extra = {}) => ({
  id,
  name: id,
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {},
  capabilities: [],
  ...extra,
});
const contextKeys = ["api", "hasApi", "onDispose", "pluginId", "provide"];
const scalar = {
  version: "1.0.0",
  methods: {
    value: {
      arguments: { type: "array", maxItems: 0 },
      returns: { type: "number" },
    },
  },
};

test("接入层不把管理端口的 API、函数和清理句柄直接交给插件", () => {
  let alive = true;
  const cleanups = [],
    internalCancel = () => {},
    inner = { value: () => 8 };
  const context = createPluginContext({
    owner: "test.boundary",
    resolve() {
      if (!alive) throw Error("revoked");
      return inner;
    },
    has: () => alive,
    publish() {},
    own(fn) {
      cleanups.push(fn);
      return internalCancel;
    },
  });
  const api = context.api("test.api");
  assert.notEqual(api, inner);
  assert.notEqual(api.value, inner.value);
  assert.equal(api.value(), 8);
  assert.equal(context.api("test.api"), api);
  assert.notEqual(
    context.onDispose(() => {}),
    internalCancel,
  );
  alive = false;
  cleanups.forEach((fn) => fn());
  assert.throws(() => context.api("test.api"), /revoked/);
});

test("L0 只接受宿主执行单元，不再创建 SDK 上下文或解释插件返回值", async () => {
  const core = new PluginHost();
  let port,
    returnedDisposed = false;
  assert.throws(
    () => core.register({ manifest: manifest("test.direct"), activate() {} }),
    /清单无效/,
  );
  core.register({
    manifest: manifest("test.unit"),
    start(value) {
      port = value;
      return {
        dispose() {
          returnedDisposed = true;
        },
      };
    },
  });
  await core.setEnabled("test.unit", true);
  assert.deepEqual(Object.keys(port).sort(), [
    "has",
    "own",
    "owner",
    "publish",
    "resolve",
  ]);
  assert.equal(port.pluginId, undefined);
  assert.equal(port.onDispose, undefined);
  assert.throws(() => port.resolve("test.undeclared"), /未声明/);
  await core.dispose();
  assert.equal(returnedDisposed, false, "公开插件返回值由上层接入层解释");
  assert.throws(() => port.own(() => {}), /停用/);
});

test("L1 构造受限 SDK，三轮启停、动态清理和返回 dispose 都归唯一内核", async () => {
  const runtime = new PluginRuntime(),
    cleaned = [];
  let context, late;
  runtime.provide("test.host-api", "1.0.0", { value: () => 3 });
  runtime.register({
    manifest: manifest("test.facade", {
      requiredApis: { "test.host-api": "^1.0.0" },
    }),
    activate(value) {
      context = value;
      assert.deepEqual(Object.keys(value).sort(), contextKeys);
      assert.equal(Object.isFrozen(value), true);
      for (const key of [
        "host",
        "broker",
        "store",
        "port",
        "resolve",
        "publish",
        "own",
      ])
        assert.equal(value[key], undefined);
      const cancel = value.onDispose(() => cleaned.push("cancelled"));
      cancel();
      cancel();
      value.onDispose(() => cleaned.push("registered"));
      late = () => value.onDispose(() => cleaned.push("late"));
      return { dispose: () => cleaned.push("returned") };
    },
  });
  for (let round = 0; round < 3; round++) {
    await runtime.setEnabled("test.facade", true);
    late();
    assert.equal(context.api("test.host-api").value(), 3);
    const old = context,
      cached = context.api("test.host-api");
    await runtime.setEnabled("test.facade", false);
    assert.deepEqual(cleaned.splice(0), ["late", "returned", "registered"]);
    assert.equal(old.hasApi("test.host-api"), false);
    assert.throws(() => cached.value(), /撤销/);
    assert.throws(() => old.provide("test.any", {}), /停用/);
  }
  assert.equal(runtime.host, undefined);
  await runtime.dispose();
});

test("上层激活失败回滚发布与清理，无效返回值不能留下活动插件", async () => {
  const runtime = new PluginRuntime();
  let cleaned = 0,
    old;
  runtime.register({
    manifest: manifest("test.failed", {
      providesApis: { "test.failed.api": scalar },
    }),
    activate(context) {
      old = context;
      context.provide("test.failed.api", { value: () => 9 });
      context.onDispose(() => cleaned++);
      return { dispose: "invalid" };
    },
  });
  await assert.rejects(runtime.setEnabled("test.failed", true), /dispose/);
  assert.equal(cleaned, 1);
  assert.equal(runtime.list()[0].enabled, false);
  assert.throws(
    () => old.provide("test.failed.api", { value: () => 4 }),
    /停用/,
  );
  await runtime.dispose();
  assert.equal(cleaned, 1);
});

test("热替换失败经同一内核恢复旧定义，旧消费者句柄保持撤销", async () => {
  const runtime = new PluginRuntime();
  let api;
  const provider = manifest("test.provider", {
    providesApis: { "test.provider.api": scalar },
  });
  runtime.register({
    manifest: provider,
    activate: (context) =>
      context.provide("test.provider.api", { value: () => 7 }),
  });
  runtime.register({
    manifest: manifest("test.consumer", {
      requiredApis: { "test.provider.api": "^1.0.0" },
    }),
    activate: (context) => {
      api = context.api("test.provider.api");
    },
  });
  await runtime.setEnabled("test.consumer", true);
  const old = api;
  await assert.rejects(
    runtime.replace({
      manifest: provider,
      activate() {
        throw Error("failed replacement");
      },
    }),
    /failed replacement/,
  );
  assert.equal(api.value(), 7);
  assert.throws(() => old.value(), /撤销/);
  assert.ok(runtime.list().every((p) => p.enabled));
  await runtime.dispose();
});

test("隔离侧复用同一上下文契约，远程调用与停止仍由隔离执行器控制", async () => {
  let context,
    cleaned = 0;
  const runtime = createExtensionRuntime({
    load: async () => ({
      plugin: {
        activate(value) {
          context = value;
          value.onDispose(() => cleaned++);
          return { dispose: () => cleaned++ };
        },
      },
    }),
    call: async () => ({ stage: "fragment" }),
  });
  await runtime.execute({
    method: "activate",
    payload: {
      manifest: {
        ...manifest("test.remote", {
          requiredApis: { "workflow.editor": "^1.0.0" },
          capabilities: ["workflow.read"],
        }),
        exportName: "plugin",
      },
    },
  });
  assert.deepEqual(Object.keys(context).sort(), contextKeys);
  assert.equal(context.resolve, undefined);
  assert.equal(context.port, undefined);
  assert.equal(
    (await context.api("workflow.editor").snapshot()).stage,
    "fragment",
  );
  await runtime.execute({ method: "dispose", payload: {} });
  assert.equal(cleaned, 2);
  assert.throws(() => context.api("workflow.editor"), /停用/);
});

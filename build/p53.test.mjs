import test from "node:test";
import assert from "node:assert/strict";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { createStrategyRegistry } from "../plugins/interaction/registry.mjs";
import { uiManifest } from "../plugins/ui/manifest.mjs";
const manifest = (id, extra = {}) => ({
  id,
  name: id,
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {},
  ...extra,
});
const jsonApi = {
  version: "1.0.0",
  methods: {
    run: { arguments: { type: "array" }, returns: { type: "object" } },
  },
};
test("激活之后通过事件登记的资源仍由同一生命周期列表回收", async () => {
  const host = new PluginRuntime(),
    resources = new Set();
  let add, lateCleanup;
  host.provide(
    "test.registration",
    "1.0.0",
    (_owner, own) => ({
      add(id) {
        resources.add(id);
        own(() => resources.delete(id));
      },
    }),
    true,
  );
  host.register({
    manifest: manifest("test.late", {
      requiredApis: { "test.registration": "1.0.0" },
    }),
    activate(c) {
      add = c.api("test.registration").add;
      lateCleanup = c.onDispose;
    },
  });
  for (let i = 0; i < 3; i++) {
    await host.setEnabled("test.late", true);
    add("first");
    add("second");
    let cleaned = false;
    lateCleanup(() => {
      cleaned = true;
    });
    await host.setEnabled("test.late", false);
    assert.equal(resources.size, 0);
    assert.equal(cleaned, true);
    assert.throws(() => add("stale"), /撤销/);
  }
});
test("必需、可选与自引用 API 环在注册时原子拒绝", () => {
  for (const field of ["requiredApis", "optionalApis"]) {
    const host = new PluginRuntime();
    host.register({
      manifest: manifest("test.first", {
        [field]: { "test.second.api": "^1.0.0" },
        providesApis: { "test.first.api": jsonApi },
      }),
      activate() {},
    });
    assert.throws(
      () =>
        host.register({
          manifest: manifest("test.second", {
            requiredApis: { "test.first.api": "^1.0.0" },
            providesApis: { "test.second.api": jsonApi },
          }),
          activate() {},
        }),
      /循环/,
    );
    assert.equal(host.list().length, 1);
    host.register({
      manifest: manifest("test.second", {
        providesApis: { "test.second.api": jsonApi },
      }),
      activate() {},
    });
  }
  const host = new PluginRuntime();
  assert.throws(
    () =>
      host.register({
        manifest: manifest("test.self", {
          optionalApis: { "test.self.api": "1.0.0" },
          providesApis: { "test.self.api": jsonApi },
        }),
        activate() {},
      }),
    /循环/,
  );
  assert.equal(host.list().length, 0);
});
test("本地作用域 API 需宿主明确授权，三轮启停撤销缓存与所有者资源", async () => {
  const host = new PluginRuntime();
  host.provide("platform.ui-shell", "1.0.0", {});
  const owners = [],
    disposed = [];
  let cached;
  const provider = {
    manifest: uiManifest,
    activate(c) {
      c.provide("studio.ui", (owner, own) => {
        owners.push(owner);
        own(() => disposed.push(owner));
        return {
          components: Object.freeze({ button: "test" }),
          ...Object.fromEntries(
            Object.keys(uiManifest.providesApis["studio.ui"].methods).map(
              (n) => [n, () => owner],
            ),
          ),
          secret() {},
        };
      });
    },
  };
  assert.throws(() => host.register(provider), /未授权/);
  host.register(provider, { allowLocalApis: true });
  host.register({
    manifest: manifest("test.consumer", {
      requiredApis: { "studio.ui": "^1.0.0" },
      capabilities: ["ui.panels"],
    }),
    activate(c) {
      const api = c.api("studio.ui");
      cached = api.addView;
      assert.equal(cached({}), "test.consumer");
      assert.equal(api.components.button, "test");
      assert.throws(() => api.secret(), /未声明/);
      assert.throws(() => api.addRenderer({}), /缺少能力/);
    },
  });
  for (let i = 0; i < 3; i++) {
    await host.setEnabled("test.consumer", true);
    const old = cached;
    await host.setEnabled("studio.ui", false);
    assert.throws(() => old({}), /撤销/);
  }
  assert.equal(owners.length, 3);
  assert.deepEqual(disposed, owners);
  await host.dispose();
});
test("策略贡献仅接收冻结副本，撤销恢复默认、迟到布局和非法 ID 均拒绝", async () => {
  const defaults = [
    {
      id: "studio.interaction.default",
      title: "默认",
      kind: "layers",
      run: ({ nodes }) => ({ nodeIds: nodes.map((n) => n.id) }),
    },
    {
      id: "studio.interaction.layout",
      title: "默认布局",
      kind: "layout",
      run: () => ({ positions: [] }),
    },
  ];
  const registry = createStrategyRegistry(defaults),
    cleanups = [],
    api = registry.scoped("example.extension", (f) => cleanups.push(f));
  let notifications = 0;
  api.subscribe(() => notifications++);
  const input = { nodes: [{ id: "a" }, { id: "b" }] };
  const handle = api.register({
    id: "example.extension.reverse",
    title: "反向",
    kind: "layers",
    run: (r) => {
      assert.ok(Object.isFrozen(r.nodes[0]));
      return { nodeIds: r.nodes.map((n) => n.id).reverse() };
    },
  });
  api.activate({ kind: "layers", id: "example.extension.reverse" });
  assert.deepEqual(api.evaluate({ kind: "layers", input }).nodeIds, ["b", "a"]);
  assert.deepEqual(
    input.nodes.map((n) => n.id),
    ["a", "b"],
  );
  handle.dispose();
  assert.equal(
    api.list().find((x) => x.active && x.kind === "layers").id,
    "studio.interaction.default",
  );
  const bad = api.register({
    id: "example.extension.bad",
    title: "错误",
    kind: "layers",
    run: () => ({ nodeIds: ["foreign"] }),
  });
  api.activate({ kind: "layers", id: "example.extension.bad" });
  assert.throws(() => api.evaluate({ kind: "layers", input }), /未知/);
  bad.dispose();
  let finish;
  const pending = api.register({
    id: "example.extension.slow",
    title: "异步",
    kind: "layout",
    run: () => new Promise((r) => (finish = r)),
  });
  api.activate({ kind: "layout", id: "example.extension.slow" });
  const task = api.evaluate({
    kind: "layout",
    input: { graph: { nodes: [{ id: "a" }] } },
  });
  pending.dispose();
  finish({ positions: [{ nodeId: "a", x: 1, y: 2 }] });
  await assert.rejects(task, /过期/);
  for (const c of cleanups.reverse()) c();
  const before = notifications;
  registry.dispose();
  assert.equal(notifications, before);
  assert.throws(() => api.list(), /撤销/);
});

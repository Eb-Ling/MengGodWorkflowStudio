// 开发者分层与生命周期回归，不代替发布版 MCP 用户验收。
import test from "node:test";
import assert from "node:assert/strict";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { createExportSession } from "../plugins/starsector/session.mjs";
const manifest = (id, extra = {}) => ({
  id,
  name: id,
  version: "1.0.0",
  apiVersion: "1.0.0",
  layer: 2,
  requiredApis: {},
  capabilities: [],
  ...extra,
});
const valueApi = {
  version: "1.0.0",
  methods: {
    value: {
      arguments: { type: "array", maxItems: 0 },
      returns: { type: "number" },
    },
  },
};
test("运行时拒绝必需/可选越层及反向依赖，失败登记不残留提供者", async () => {
  const host = new PluginRuntime({ enforceLayers: true });
  host.provide("platform.private", "1.0.0", { value: () => 1 });
  for (const key of ["requiredApis", "optionalApis"])
    assert.throws(
      () =>
        host.register({
          manifest: manifest("test.bad", {
            layer: 3,
            [key]: { "platform.private": "^1.0.0" },
          }),
          activate() {},
        }),
      /跨层/,
    );
  host.register({
    manifest: manifest("test.upper", {
      layer: 3,
      providesApis: { "test.upper.api": valueApi },
    }),
    activate: (c) => c.provide("test.upper.api", { value: () => 1 }),
  });
  assert.throws(
    () =>
      host.register({
        manifest: manifest("test.lower", {
          requiredApis: { "test.upper.api": "^1.0.0" },
          providesApis: { "test.bad.api": valueApi },
        }),
        activate() {},
      }),
    /跨层/,
  );
  assert.deepEqual(
    host.list().map((p) => p.id),
    ["test.upper"],
  );
  host.register({
    manifest: manifest("test.port", {
      requiredApis: { "platform.private": "^1.0.0" },
    }),
    activate: (c) => assert.equal(c.api("platform.private").value(), 1),
  });
  await host.setEnabled("test.port", true);
  await host.dispose();
});
test("可选提供者启停重绑完整间接消费者链，反序登记也先释放消费者，退出不重新启动", async () => {
  const host = new PluginRuntime({ enforceLayers: true }),
    live = new Set(),
    events = [],
    counts = {};
  let leaf;
  const specs = [
    ["test.a", 2, null, false],
    ["test.b", 2, "test.a", true],
    ["test.c", 3, "test.b", false],
    ["test.d", 3, "test.c", false],
  ];
  for (const [id, layer, parent, optional] of [...specs].reverse())
    host.register({
      manifest: manifest(id, {
        layer,
        ...(parent
          ? {
              [optional ? "optionalApis" : "requiredApis"]: {
                [parent + ".api"]: "^1.0.0",
              },
            }
          : {}),
        providesApis: { [id + ".api"]: valueApi },
      }),
      activate(c) {
        counts[id] = (counts[id] || 0) + 1;
        live.add(id);
        events.push("start " + id);
        const parentApi =
          parent && c.hasApi(parent + ".api") ? c.api(parent + ".api") : null;
        const value = { value: () => (parentApi ? parentApi.value() + 1 : 1) };
        c.provide(id + ".api", value);
        if (id === "test.d") leaf = value;
        c.onDispose(() => {
          events.push("stop " + id);
          live.delete(id);
        });
      },
    });
  await host.setEnabled("test.d", true);
  assert.equal(leaf.value(), 3);
  const old = leaf;
  events.length = 0;
  await host.setEnabled("test.a", true);
  assert.equal(leaf.value(), 4);
  assert.throws(() => old.value(), /撤销/);
  assert.deepEqual(
    events.filter((e) => e.startsWith("stop")),
    ["stop test.d", "stop test.c", "stop test.b"],
  );
  assert.deepEqual(
    new Set(host.impact("test.a").restart),
    new Set(["test.b", "test.c", "test.d"]),
  );
  await host.setEnabled("test.a", false);
  assert.equal(leaf.value(), 3);
  const started = { ...counts };
  await host.dispose();
  assert.equal(live.size, 0);
  assert.deepEqual(counts, started);
});
test("导出会话在保存失败或保存期间文档变化时拒绝交付文件和生成记录", async () => {
  let revision = 1,
    fail = true,
    change = false,
    downloads = 0;
  const snapshot = () => ({
    project: { id: "d", runtimePath: "data/method", className: "Test" },
    fragmentGraph: {},
    vertexTransform: {},
    documentRevision: revision,
    documentToken: "t",
  });
  const session = createExportSession({
    workflow: { snapshot, subscribe: () => () => {}, report() {} },
    service: {
      generate: async () => ({
        java: { content: "java" },
        vertex: { content: "vert" },
        fragment: { content: "frag" },
      }),
    },
    files: {
      save: async () => {
        if (fail) throw Error("disk full");
        if (change) revision++;
        return {};
      },
    },
    history: { status: () => ({ state: "current" }) },
    downloads: {
      zip() {
        downloads++;
      },
    },
  });
  await assert.rejects(session.exportEffect(), /disk full/);
  assert.equal(session.sources(), null);
  assert.equal(downloads, 0);
  fail = false;
  change = true;
  await assert.rejects(session.exportEffect(), /改变/);
  assert.equal(session.sources(), null);
  assert.equal(downloads, 0);
  session.dispose();
});
test("节点规则变化即使不改变文档修订，也会清除导出缓存和旧生成记录", async () => {
  let version = 1,
    changed;
  const snapshot = () => ({
    project: { id: "d", runtimePath: "data/method" },
    fragmentGraph: {},
    vertexTransform: {},
    documentToken: "t",
    documentRevision: 0,
    catalogRevision: version,
  });
  const session = createExportSession({
    workflow: {
      snapshot,
      subscribe: (fn) => {
        changed = fn;
        return () => {};
      },
      report() {},
    },
    service: { generate: async () => ({ value: version }) },
    files: { save: async () => ({}) },
    history: { status: () => ({ state: "current" }) },
    downloads: {},
  });
  assert.deepEqual(await session.exportEffect({ download: false }), {
    value: 1,
  });
  version++;
  changed();
  assert.equal(session.sources(), null);
  assert.deepEqual(await session.exportEffect({ download: false }), {
    value: 2,
  });
  session.dispose();
});

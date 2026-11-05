// 开发者边界测试，最终用户路径单独通过公开 MCP 验收。
import test from "node:test";
import assert from "node:assert/strict";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { readActivationEvents } from "../packages/plugin-sdk/plugin-activation.mjs";
import { createCompilationCache } from "../plugins/compiler/cache.mjs";

const contract = {
  version: "1.0.0",
  methods: {
    value: {
      arguments: { type: "array", maxItems: 0 },
      returns: { type: "number" },
    },
  },
};
const manifest = (id, extra = {}) => ({
  id,
  name: id,
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {},
  capabilities: [],
  ...extra,
});
const lazy = (id, activate, extra = {}) => ({
  manifest: manifest(id, {
    providesApis: { [id + ".api"]: contract },
    activationEvents: ["onApi:" + id + ".api"],
    ...extra,
  }),
  activate,
});
const gate = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

test("按需声明只允许自己提供的 JSON API，拒绝未知事件和同步能力", () => {
  assert.deepEqual(readActivationEvents(lazy("test.lazy", () => {}).manifest), [
    "onApi:test.lazy.api",
  ]);
  for (const changes of [
    { activationEvents: ["startup"] },
    { activationEvents: ["onApi:other.api"] },
    { providesApis: { "test.lazy.api": { ...contract, transport: "local" } } },
    { activationEvents: ["onApi:test.lazy.api", "onApi:test.lazy.api"] },
  ])
    assert.throws(() =>
      readActivationEvents({
        ...lazy("test.lazy", () => {}).manifest,
        ...changes,
      }),
    );
});

test(
  "首次调用并发合并，停用撤销旧句柄，显式启用可恢复",
  { timeout: 4000 },
  async () => {
    const runtime = new PluginRuntime();
    let starts = 0,
      api;
    runtime.register(
      lazy("test.lazy", (c) => {
        starts++;
        c.provide("test.lazy.api", { value: () => 7 });
      }),
    );
    runtime.register({
      manifest: manifest("test.consumer", {
        requiredApis: { "test.lazy.api": "1.0.0" },
      }),
      activate(c) {
        api = c.api("test.lazy.api");
      },
    });
    await runtime.setEnabled("test.lazy", true, { defer: true });
    assert.equal(runtime.list()[0].activationState, "waiting");
    await runtime.setEnabled("test.consumer", true);
    assert.equal(starts, 0);
    await assert.rejects(() => api.value(5));
    assert.equal(starts, 0);
    assert.deepEqual(
      await Promise.all(Array.from({ length: 24 }, () => api.value())),
      Array(24).fill(7),
    );
    assert.equal(starts, 1);
    const old = api;
    await runtime.setEnabled("test.lazy", false);
    assert.throws(() => old.value());
    assert.equal(starts, 1);
    await runtime.setEnabled("test.consumer", true);
    assert.equal(await api.value(), 7);
    assert.equal(starts, 2);
    await runtime.dispose();
  },
);

test("没有能力的首次调用不启动提供者或产生资源", async () => {
  const runtime = new PluginRuntime();
  let starts = 0, api;
  const definition = lazy("test.secure", c => {
    starts++;
    c.provide("test.secure.api", { value: () => 1 });
  });
  definition.manifest.providesApis["test.secure.api"] = {
    ...contract,
    methods: { value: { ...contract.methods.value, capability: "test.read" } },
  };
  runtime.register(definition);
  runtime.register({ manifest: manifest("test.denied", { requiredApis: { "test.secure.api": "1.0.0" } }),
    activate(c) { api = c.api("test.secure.api"); } });
  await runtime.setEnabled("test.denied", true);
  await assert.rejects(api.value(), error => error.code === "PERMISSION_DENIED");
  assert.throws(() => api.toString, /未声明/);
  assert.equal(starts, 0);
  assert.equal(runtime.list()[0].activationState, "waiting");
  await runtime.dispose();
});

test(
  "激活入口可以等待按需下游 API，不能等待自身队列",
  { timeout: 4000 },
  async () => {
    const runtime = new PluginRuntime();
    let result,
      starts = 0;
    runtime.register(
      lazy("test.lazy", async (c) => {
        starts++;
        c.provide("test.lazy.api", { value: () => 9 });
      }),
    );
    runtime.register({
      manifest: manifest("test.consumer", {
        requiredApis: { "test.lazy.api": "1.0.0" },
      }),
      async activate(c) {
        result = await c.api("test.lazy.api").value();
      },
    });
    await runtime.setEnabled("test.consumer", true);
    assert.equal(result, 9);
    assert.equal(starts, 1);
    await runtime.dispose();
  },
);

test(
  "激活期间的用户停用优先，晚到结果被拒绝并清理资源",
  { timeout: 4000 },
  async () => {
    const runtime = new PluginRuntime(),
      entered = gate(),
      release = gate();
    let api,
      cleaned = 0,
      starts = 0;
    runtime.register(
      lazy("test.lazy", async (c) => {
        starts++;
        c.onDispose(() => cleaned++);
        entered.resolve();
        await release.promise;
        c.provide("test.lazy.api", { value: () => 1 });
      }),
    );
    runtime.register({
      manifest: manifest("test.consumer", {
        requiredApis: { "test.lazy.api": "1.0.0" },
      }),
      activate(c) {
        api = c.api("test.lazy.api");
      },
    });
    await runtime.setEnabled("test.consumer", true);
    const call = api.value();
    const rejected = assert.rejects(call, /停用|失效/);
    await entered.promise;
    const stop = runtime.setEnabled("test.lazy", false);
    release.resolve();
    await rejected;
    await stop;
    assert.equal(cleaned, 1);
    assert.equal(starts, 1);
    assert.equal(runtime.list()[0].enabled, false);
    await runtime.dispose();
  },
);

test(
  "队列外请求与激活入口请求交叉时复用同一任务，不互相等待",
  { timeout: 4000 },
  async () => {
    const runtime = new PluginRuntime(),
      entered = gate(),
      release = gate();
    let api,
      starts = 0,
      result;
    runtime.register(
      lazy("test.lazy", (c) => {
        starts++;
        c.provide("test.lazy.api", { value: () => 4 });
      }),
    );
    runtime.register({
      manifest: manifest("test.first", {
        requiredApis: { "test.lazy.api": "1.0.0" },
      }),
      activate(c) {
        api = c.api("test.lazy.api");
      },
    });
    runtime.register({
      manifest: manifest("test.second", {
        requiredApis: { "test.lazy.api": "1.0.0" },
      }),
      async activate(c) {
        entered.resolve();
        await release.promise;
        result = await c.api("test.lazy.api").value();
      },
    });
    await runtime.setEnabled("test.first", true);
    const second = runtime.setEnabled("test.second", true);
    await entered.promise;
    const external = api.value();
    release.resolve();
    await second;
    assert.equal(await external, 4);
    assert.equal(result, 4);
    assert.equal(starts, 1);
    await runtime.dispose();
  },
);

test(
  "替换待命插件不提前激活，替换活动插件撤销旧绑定",
  { timeout: 4000 },
  async () => {
    const runtime = new PluginRuntime();
    let starts = 0,
      api;
    const definition = (n) =>
      lazy("test.lazy", (c) => {
        starts++;
        c.provide("test.lazy.api", { value: () => n });
      });
    runtime.register(definition(1));
    runtime.register({
      manifest: manifest("test.consumer", {
        requiredApis: { "test.lazy.api": "1.0.0" },
      }),
      activate(c) {
        api = c.api("test.lazy.api");
      },
    });
    await runtime.setEnabled("test.lazy", true, { defer: true });
    await runtime.replace(definition(2));
    assert.equal(starts, 0);
    await runtime.setEnabled("test.consumer", true);
    assert.equal(await api.value(), 2);
    const old = api;
    await runtime.replace(definition(3));
    assert.throws(() => old.value());
    assert.equal(await api.value(), 3);
    assert.equal(starts, 2);
    await runtime.dispose();
  },
);

test("停用影响覆盖未激活的必需依赖链，自动调用不能复活其提供者", async () => {
  const runtime = new PluginRuntime();
  let api,
    starts = 0;
  runtime.register(
    lazy("test.bottom", (c) => {
      starts++;
      c.provide("test.bottom.api", { value: () => 5 });
    }),
  );
  runtime.register(
    lazy(
      "test.middle",
      (c) => {
        starts++;
        c.provide("test.middle.api", {
          value: () => c.api("test.bottom.api").value(),
        });
      },
      { requiredApis: { "test.bottom.api": "1.0.0" } },
    ),
  );
  runtime.register({
    manifest: manifest("test.consumer", {
      requiredApis: { "test.middle.api": "1.0.0" },
    }),
    activate(c) {
      api = c.api("test.middle.api");
    },
  });
  await runtime.setEnabled("test.consumer", true);
  assert.deepEqual(
    new Set(runtime.impact("test.bottom").stop),
    new Set(["test.bottom", "test.middle", "test.consumer"]),
  );
  await runtime.setEnabled("test.bottom", false);
  assert.throws(() => api.value());
  assert.equal(starts, 0);
  assert.ok(runtime.list().every((p) => !p.enabled));
  await runtime.dispose();
});

test(
  "并发激活分支失败不撤销另一分支正在使用的共同提供者",
  { timeout: 4000 },
  async () => {
    const runtime = new PluginRuntime(),
      release = gate();
    let consumer;
    runtime.register({
      manifest: manifest("test.shared", {
        providesApis: { "test.shared.api": contract },
      }),
      activate(c) {
        c.provide("test.shared.api", { value: () => 6 });
      },
    });
    runtime.register(
      lazy(
        "test.failed",
        async () => {
          await release.promise;
          throw Error("expected failure");
        },
        { requiredApis: { "test.shared.api": "1.0.0" } },
      ),
    );
    runtime.register(
      lazy(
        "test.good",
        (c) => {
          const shared = c.api("test.shared.api");
          c.provide("test.good.api", { value: () => shared.value() });
        },
        { requiredApis: { "test.shared.api": "1.0.0" } },
      ),
    );
    runtime.register({
      manifest: manifest("test.consumer", {
        requiredApis: { "test.failed.api": "1.0.0", "test.good.api": "1.0.0" },
      }),
      async activate(c) {
        consumer = c.api("test.good.api");
        const failed = assert.rejects(
          c.api("test.failed.api").value(),
          /expected failure/,
        );
        assert.equal(await consumer.value(), 6);
        release.resolve();
        await failed;
      },
    });
    await runtime.setEnabled("test.consumer", true);
    assert.equal(await consumer.value(), 6);
    assert.equal(
      runtime.list().find((p) => p.id === "test.shared").active,
      true,
    );
    await runtime.dispose();
  },
);

test("JSON 缓存合并同键请求，每个调用者获得独立副本", async () => {
  const cache = createCompilationCache();
  let loads = 0;
  const values = await Promise.all(
    Array.from({ length: 20 }, () =>
      cache.run("x", async () => {
        loads++;
        return { nested: { v: 1 } };
      }),
    ),
  );
  values[0].nested.v = 99;
  assert.equal(values[1].nested.v, 1);
  assert.equal(loads, 1);
  assert.equal((await cache.run("x", () => assert.fail())).nested.v, 1);
  assert.equal(cache.status().coalesced, 19);
  assert.equal(cache.status().hits, 1);
  cache.dispose();
});

test("缓存限制条目和字节，超大项与失败不保留，LRU 淘汰可重新计算", async () => {
  const cache = createCompilationCache({
    maxEntries: 2,
    maxBytes: 100,
    maxPending: 2,
  });
  await cache.run("a", () => 1);
  await cache.run("b", () => 2);
  await cache.run("a", () => 0);
  await cache.run("c", () => 3);
  assert.equal(cache.status().evictions, 1);
  assert.equal(await cache.run("b", () => 22), 22);
  await cache.run("large", () => "x".repeat(100));
  assert.equal(cache.status().oversized, 1);
  await assert.rejects(
    cache.run("bad", () => {
      throw Error("bad");
    }),
  );
  assert.equal(await cache.run("bad", () => 5), 5);
  assert.ok(cache.status().bytes <= 100);
  assert.ok(cache.status().entries <= 2);
  cache.dispose();
});

test("缓存限制在途任务，销毁后的晚到结果不可返回或重新入库", async () => {
  const cache = createCompilationCache({ maxPending: 1 }),
    hold = gate();
  const first = cache.run("a", () => hold.promise);
  const rejected = assert.rejects(first, /释放/);
  await assert.rejects(
    cache.run("b", () => 2),
    /请求过多/,
  );
  cache.dispose();
  hold.resolve(1);
  await rejected;
  assert.equal(cache.status().entries, 0);
  assert.equal(cache.status().inFlight, 0);
});

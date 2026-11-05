import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  inspectPlugin,
  checkPluginSet,
  checkPluginMatrix,
  createStressSchedule,
} from "../packages/plugin-testkit/index.mjs";
import { runSandboxSuite } from "../packages/plugin-testkit/sandbox-suite.mjs";
import { readPluginFiles } from "../packages/native-host/plugin-files.mjs";
import { pluginManifestDraft } from "../packages/plugin-sdk/plugin-manifest.mjs";
import { createPluginRepository } from "../packages/native-host/plugin-repository.mjs";

async function directory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-kit-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
const bundle = (manifest) => ({ manifest, files: {}, bytes: 0 });
const api = {
  version: "1.0.0",
  methods: {
    read: { arguments: { type: "array" }, returns: { type: "number" } },
  },
};
const provider = () => ({
  ...pluginManifestDraft("provider", "index.mjs", "extension"),
  requiredApis: {},
  capabilities: [],
  providesApis: { "local.provider.api": api },
});
const consumer = () => ({
  ...pluginManifestDraft("consumer", "index.mjs", "extension"),
  requiredApis: { "local.provider.api": "^1.0.0" },
  capabilities: [],
});
test("种子调度与输入目录顺序无关，覆盖启停且严格限制预算", () => {
  const ids = ["local.a", "local.b", "local.c", "local.d"];
  const plan = createStressSchedule(ids, { seed: 20261103, cycles: 4 });
  assert.deepEqual(
    plan,
    createStressSchedule([...ids].reverse(), { seed: 20261103, cycles: 4 }),
  );
  assert.notDeepEqual(
    plan.rounds,
    createStressSchedule(ids, { seed: 20261104, cycles: 4 }).rounds,
  );
  for (const r of plan.rounds) {
    assert.deepEqual([...r.registration].sort(), ids);
    assert.deepEqual([...r.enable].sort(), ids);
    assert.deepEqual(r.restarts.map((s) => s.pluginId).sort(), ids);
    for (const s of r.restarts) assert.deepEqual([...s.restore].sort(), ids);
  }
  for (const seed of [-1, 0.1, 2 ** 32, NaN])
    assert.throws(() => createStressSchedule(ids, { seed }), /预算/);
  assert.throws(
    () => createStressSchedule(ids, { cycles: 10, restartPasses: 3 }),
    /预算/,
  );
  assert.throws(() => createStressSchedule([ids[0], ids[0]]), /不同/);
  assert.equal(
    createStressSchedule(ids, { seed: 0, restartPasses: 0 }).rounds[0].restarts
      .length,
    0,
  );
});
test("矩阵区分必需提供者、可选提供者和基础 API 缺席，不运行插件入口", async () => {
  const optional = {
    ...consumer(),
    id: "local.optional",
    requiredApis: {},
    optionalApis: consumer().requiredApis,
  };
  const report = await checkPluginMatrix([
    bundle(provider()),
    bundle(consumer()),
    bundle(optional),
  ]);
  assert.equal(
    report.cases.find((c) => c.name === "only:local.consumer").accepted,
    false,
  );
  assert.equal(
    report.cases.find((c) => c.name === "only:local.optional").accepted,
    true,
  );
  assert.equal(
    report.cases.find((c) => c.name === "without-provider:local.provider")
      .accepted,
    false,
  );
  const nodes = await checkPluginMatrix([bundle(pluginManifestDraft("nodes"))]);
  assert.equal(
    nodes.cases.find((c) => c.name === "without-api:workflow.nodes").accepted,
    false,
  );
  await assert.rejects(checkPluginMatrix([bundle(consumer())]), /缺少兼容/);
});
function memoryRunner({ failRestart = false } = {}) {
  const live = new Set(),
    calls = [],
    starts = new Map();
  return {
    live,
    calls,
    async createRunner(b, options) {
      const id = b.manifest.id,
        n = (starts.get(id) || 0) + 1;
      starts.set(id, n);
      if (failRestart && n > 1) throw Error("intentional restart failure");
      if (id === "local.consumer") {
        assert.equal(
          await options.onApiCall({
            api: "local.provider.api",
            method: "read",
            args: [],
          }),
          42,
        );
        await options.onApiCall({
          api: "studio.extension-ui",
          method: "create",
          args: [
            {
              id: id + ".panel",
              title: "测试",
              tree: { id: "text", type: "text", text: "42" },
            },
          ],
        });
        calls.push(options.onApiCall);
      }
      const key = id + ":" + n;
      live.add(key);
      return {
        contribution: { nodes: [], compilers: [] },
        request: async (name) => (name === "invoke" ? 42 : {}),
        dispose: async () => live.delete(key),
        destroy: () => live.delete(key),
      };
    },
  };
}
const uiConsumer = () => ({
  ...consumer(),
  capabilities: ["extension.ui"],
  requiredApis: { ...consumer().requiredApis, "studio.extension-ui": "^1.0.0" },
});
test("随机启停经唯一内核级联清理资源并撤销旧 API", async () => {
  const runner = memoryRunner();
  const report = await runSandboxSuite(
    [bundle(uiConsumer()), bundle(provider())],
    { createRunner: runner.createRunner, seed: 71, cycles: 2, settleMs: 0 },
  );
  assert.equal(report.rounds.length, 2);
  for (const r of report.rounds) {
    assert.deepEqual(r.remaining, { runners: 0, nodes: 0, panels: 0 });
    const absent = r.checkpoints.find(
      (c) => c.phase === "disabled" && c.pluginId === "local.provider",
    );
    assert.deepEqual(absent.enabled, []);
    assert.equal(absent.resources.panels, 0);
  }
  assert.equal(runner.live.size, 0);
  for (const call of runner.calls)
    await assert.rejects(
      call({ api: "local.provider.api", method: "read", args: [] }),
      /撤销|停用/,
    );
});
test("失败报告保留种子、计划、失败动作和清理结果", async () => {
  const runner = memoryRunner({ failRestart: true });
  await assert.rejects(
    runSandboxSuite([bundle(uiConsumer()), bundle(provider())], {
      createRunner: runner.createRunner,
      seed: 42,
      cycles: 1,
      settleMs: 0,
    }),
    (error) => {
      assert.match(error.message, /intentional restart failure/);
      assert.equal(error.testReport.ok, false);
      assert.equal(error.testReport.schedule.seed, 42);
      assert.equal(error.testReport.rounds[0].failure.action.action, "restore");
      assert.deepEqual(error.testReport.rounds[0].remaining, {
        runners: 0,
        nodes: 0,
        panels: 0,
      });
      return true;
    },
  );
  assert.equal(runner.live.size, 0);
});
test("测试包不执行入口，和安装器读取同一份快照，支持单 JSON", async (t) => {
  const root = await directory(t),
    manifest = pluginManifestDraft("inspect");
  await fs.writeFile(
    path.join(root, "studio-plugin.json"),
    JSON.stringify(manifest),
  );
  await fs.writeFile(
    path.join(root, "index.mjs"),
    "throw Error('must not execute');",
  );
  const inspected = await inspectPlugin(root);
  const repo = createPluginRepository({
    indexFile: path.join(root, "profile", "index.json"),
  });
  const draft = await repo.inspect(1, root),
    prepared = await repo.prepare(1, {
      token: draft.token,
      manifest: draft.manifest,
    });
  assert.deepEqual(
    { ...repo.bundle(1, prepared.generation).files },
    { ...inspected.files },
  );
  assert.equal((await checkPluginSet([inspected])).mode, "declarations-only");
  await fs.writeFile(
    path.join(root, "studio-plugin.json"),
    JSON.stringify(pluginManifestDraft("visual", undefined, "declarative")),
  );
  assert.equal((await inspectPlugin(root)).manifest.kind, "declarative");
});
test("检查包经真实内核解析缺失、版本、顺序和必需/可选环", async () => {
  const a = provider(),
    b = consumer();
  assert.deepEqual(
    (await checkPluginSet([bundle(b), bundle(a)])).activationOrder,
    ["local.provider", "local.consumer"],
  );
  await assert.rejects(checkPluginSet([bundle(b)]), /缺少兼容/);
  await assert.rejects(
    checkPluginSet([
      bundle({ ...b, requiredApis: { "local.provider.api": "^2.0.0" } }),
      bundle(a),
    ]),
    /缺少兼容/,
  );
  await assert.rejects(checkPluginSet([bundle(a), bundle(a)]), /重复/);
  const c = { ...b, providesApis: { "local.consumer.api": api } },
    d = { ...a, optionalApis: { "local.consumer.api": "^1.0.0" } };
  await assert.rejects(checkPluginSet([bundle(c), bundle(d)]), /循环/);
  const nodes = bundle(pluginManifestDraft("nodes"));
  await assert.rejects(checkPluginSet([nodes], { apis: {} }), /缺少兼容/);
});
test("目录预算按真实字节拒绝超限、错误 UTF-8 和缺失入口", async (t) => {
  const root = await directory(t);
  await fs.writeFile(path.join(root, "big.mjs"), Buffer.alloc(1024 * 1024 + 1));
  await assert.rejects(readPluginFiles(root), /1 MB/);
  await fs.writeFile(path.join(root, "big.mjs"), new Uint8Array([0xff, 0xfe]));
  await assert.rejects(readPluginFiles(root), /encoded data|encoding/i);
  await fs.writeFile(path.join(root, "big.mjs"), "");
  await fs.writeFile(
    path.join(root, "studio-plugin.json"),
    JSON.stringify(pluginManifestDraft("missing")),
  );
  await assert.rejects(inspectPlugin(root), /找不到入口/);
  for (let i = 0; i < 4; i++)
    await fs.writeFile(
      path.join(root, "data" + i + ".json"),
      Buffer.alloc(1024 * 1024, 32),
    );
  await assert.rejects(readPluginFiles(root), /4 MB/);
});
test("拒绝链接与深目录，忽略依赖目录且不修改用户文件", async (t) => {
  const root = await directory(t),
    outside = await directory(t);
  await fs.symlink(outside, path.join(root, "escape"), "junction");
  await assert.rejects(readPluginFiles(root), /符号链接/);
  await fs.unlink(path.join(root, "escape"));
  const deep = path.join(root, ...Array(11).fill("a"));
  await fs.mkdir(deep, { recursive: true });
  await assert.rejects(readPluginFiles(root), /层级/);
  const clean = await directory(t);
  await fs.mkdir(path.join(clean, "node_modules"));
  await fs.writeFile(
    path.join(clean, "node_modules", "ignored.js"),
    Buffer.alloc(1024 * 1024 + 1),
  );
  assert.equal(Object.keys((await readPluginFiles(clean)).files).length, 0);
  assert.equal(
    (await fs.stat(path.join(clean, "node_modules", "ignored.js"))).size,
    1024 * 1024 + 1,
  );
});

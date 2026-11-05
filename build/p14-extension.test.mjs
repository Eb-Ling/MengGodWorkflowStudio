// 开发边界回归使用临时源码，最终用户验收由 p14-mcp-acceptance 单独执行。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createPluginRepository } from "../packages/native-host/plugin-repository.mjs";
import { createPluginManagement } from "../plugins/plugin-service/management.mjs";
import { readPluginManifest } from "../packages/plugin-sdk/plugin-manifest.mjs";
import { commandPermission } from "../plugins/mcp/access-policy.mjs";
import { readPluginCall } from "../packages/plugin-sdk/plugin-management.mjs";
import { createExtensionUiService } from "../plugins/extension-ui/service.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { extensionUiContract } from "../packages/plugin-sdk/extension-ui.mjs";
import { createMcpTools } from "../plugins/mcp/tool-service.mjs";
import { ContributionRegistry } from "../packages/kernel/contribution-registry.mjs";
import { ir } from "../packages/plugin-sdk/ir.mjs";
import { pipelineHarness } from "./compiler-pipeline-support.mjs";
import { lowerGraph } from "../plugins/compiler/lower.mjs";
import {
  installNodeModel,
  nodeModelFixture,
  workspacePorts,
} from "./layer-test-support.mjs";
import { OperationRegistry } from "../packages/kernel/operation-registry.mjs";
import { compilerPlugin } from "../plugins/compiler/index.mjs";
import { glslPlugin } from "../plugins/glsl-backend/index.mjs";
import { mathPlugin } from "../plugins/math/index.mjs";
import { mathContribution } from "../plugins/math/contribution.mjs";
import { normalizeTransform } from "../packages/workflow-tools/geometry.mjs";
import { inspectBusinessDependencies } from "./layer-policy.mjs";
import { createEditorApplication } from "../plugins/workflow-service/application.mjs";

test("P14 编辑会话退出不释放独立节点目录，自定义多段 ID 和持久化仍可用", () => {
  const ports = workspacePorts(),
    model = nodeModelFixture(ports);
  const definition = {
    typeId: "custom.my-node.color",
    title: "颜色",
    inputs: [],
    outputs: [{ name: "color", type: "VEC4" }],
    properties: { custom: true },
  };
  try {
    model.catalog.setCustom(definition);
    const handle = model.nodeApi("studio.math").register(mathContribution());
    const app = createEditorApplication(ports, model.catalog);
    app.dispose();
    assert.ok(model.catalog.list().some((n) => n.typeId === definition.typeId));
    assert.ok(
      model.catalog.list().some((n) => n.typeId === "studio.math.constant"),
    );
    const copy = model.catalog.list();
    copy.length = 0;
    assert.ok(model.catalog.list().length > 0);
    handle.dispose();
    const restored = nodeModelFixture(ports);
    try {
      assert.equal(restored.catalog.customNodes()[0].typeId, definition.typeId);
      restored.catalog.removeCustom(definition.typeId);
      assert.equal(
        restored.catalog.list().some((n) => n.typeId === definition.typeId),
        false,
      );
    } finally {
      restored.dispose();
    }
  } finally {
    model.dispose();
  }
});

test("P14 节点和编译独立运行，不登记编辑器、文档会话或 UI，三轮清理后重建", async () => {
  const host = new PluginRuntime({ enforceLayers: true }),
    ops = new OperationRegistry();
  installNodeModel(host);
  host.provide(
    "workflow.operations",
    "1.0.0",
    (...args) => ops.createApi(...args),
    true,
  );
  host.register(mathPlugin);
  host.register(glslPlugin);
  host.register(compilerPlugin);
  let compilation, nodes;
  host.register({
    manifest: {
      id: "test.headless",
      layer: 3,
      version: "1.0.0",
      apiVersion: "1.0.0",
      requiredApis: {
        "workflow.compilation": "^1.0.0",
        "workflow.nodes": "^1.0.0",
      },
      capabilities: ["shaders.compile", "nodes.read"],
    },
    activate(c) {
      compilation = c.api("workflow.compilation");
      nodes = c.api("workflow.nodes");
    },
  });
  const document = {
    config: {},
    geometry: normalizeTransform(),
    fragment: {
      revision: 0,
      outputNodeId: "headless_value",
      nodes: [
        {
          id: "headless_value",
          typeId: "studio.math.constant",
          canvasX: 0,
          canvasY: 0,
          properties: { value: "0.5" },
        },
      ],
      links: [],
    },
  };
  const before = structuredClone(document);
  try {
    for (let i = 0; i < 3; i++) {
      await host.setEnabled("studio.math", true);
      await host.setEnabled("test.headless", true);
      assert.ok(nodes.get("studio.math.constant"));
      for (const target of ["glsl-430", "glsl-es-300"])
        assert.ok(
          (
            await compilation.lower({
              document,
              stage: "fragment",
              target,
              nodeId: "headless_value",
              sockets: ["value"],
            })
          ).outputs.value,
        );
      const preview = await compilation.preview({
        document,
        stage: "fragment",
        nodeId: "headless_value",
        socket: "value",
      });
      assert.match(JSON.stringify(preview), /headless_value/);
      assert.deepEqual(document, before);
      assert.equal(
        host
          .list()
          .some((p) =>
            [
              "studio.workflow-service",
              "studio.workspace",
              "studio.ui",
            ].includes(p.id),
          ),
        false,
      );
      const previous = compilation;
      await host.setEnabled("studio.node-model", false);
      assert.equal(ops.list().length, 0);
      assert.throws(() => previous.lower({ document }), /撤销/);
    }
  } finally {
    await host.dispose();
  }
});
test("P14 同层职责门禁拒绝编译或算法依赖编辑器，工作区不接 UI 或管理", () => {
  for (const id of [
    "studio.compiler",
    "studio.math",
    "studio.noise",
    "studio.sdf",
    "studio.node-model",
  ])
    for (const key of ["requiredApis", "optionalApis"])
      assert.throws(
        () =>
          inspectBusinessDependencies([
            { id, [key]: { "workflow.editor": "^1.0.0" } },
          ]),
        /不得依赖/,
      );
  for (const api of ["studio.ui", "studio.plugins", "workflow.preview"])
    assert.throws(
      () =>
        inspectBusinessDependencies([
          { id: "studio.workspace", optionalApis: { [api]: "^1.0.0" } },
        ]),
      /不负责/,
    );
});

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-p14-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "plugin");
  await fs.cp(new URL("./examples/sdk-effect", import.meta.url), directory, {
    recursive: true,
  });
  const indexFile = path.join(root, "index.json"),
    repo = createPluginRepository({ indexFile });
  const draft = await repo.inspect(1, directory);
  const grant = await repo.authorize(1, {
    token: draft.token,
    manifest: draft.manifest,
  });
  return { root, directory, indexFile, repo, draft, grant };
}
const asyncContribution = (compile) => ({
  nodes: [
    {
      typeId: "local.async.value",
      title: "异步节点",
      inputs: [],
      outputs: [{ name: "value", type: "FLOAT" }],
      properties: {},
      targets: ["glsl-430"],
    },
  ],
  compilers: [{ typeId: "local.async.value", target: "glsl-430", compile }],
});
test("P14 异步规则与同步规则共享 IR 校验，替换后拒绝旧结果", async () => {
  const registry = new ContributionRegistry();
  const context = { node: { properties: {} }, socket: "value", inputs: {} };
  let finish;
  const old = registry.register(
    "local.async",
    "1.0.0",
    asyncContribution(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const pending = registry.compile("local.async.value", "glsl-430", context);
  old.dispose();
  const next = registry.register(
    "local.async",
    "1.0.0",
    asyncContribution(async () => ir.literal("FLOAT", 2)),
  );
  finish(ir.literal("FLOAT", 1));
  await assert.rejects(pending, /撤销/);
  assert.equal(
    (await registry.compile("local.async.value", "glsl-430", context)).value,
    2,
  );
  next.dispose();
  for (const value of [
    ir.literal("INT", 1),
    ir.input("FLOAT", "unknown"),
    { kind: "source", type: "FLOAT", code: "evil()" },
  ]) {
    const handle = registry.register(
      "local.async",
      "1.0.0",
      asyncContribution(async () => value),
    );
    await assert.rejects(() =>
      registry.compile("local.async.value", "glsl-430", context),
    );
    handle.dispose();
  }
});
test("P14 首次图快照等待插件 IR，不交付 Promise 或局部结果，不改变提供者身份", async () => {
  const h = pipelineHarness();
  let finish;
  const handle = h.registry.register(
    "local.async",
    "1.0.0",
    asyncContribution(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  try {
    const document = h.document({
      nodes: [
        {
          id: "my_async",
          typeId: "local.async.value",
          properties: {},
          canvasX: 0,
          canvasY: 0,
        },
      ],
      links: [],
      outputNodeId: "my_async",
      revision: 0,
    });
    const request = {
      document,
      target: "glsl-430",
      stage: "fragment",
      nodeId: "my_async",
      sockets: ["value"],
    };
    const identity = h.snapshots.identity(request);
    const pending = h.snapshots.prepare(request);
    assert.equal(typeof pending.then, "function");
    finish(ir.literal("FLOAT", 0.5));
    const snapshot = await pending;
    assert.equal(snapshot.nodes[0].expressions.value.value, 0.5);
    assert.ok(lowerGraph(snapshot).outputs.value);
    assert.deepEqual(h.snapshots.identity(request), identity);
  } finally {
    handle.dispose();
    Object.values(h.handles).forEach((h) => h.dispose());
    h.dispose();
  }
});
test("P14 授权目录在重启和移除登记后可复用，不提供路径或源码", async (t) => {
  const { repo, grant, indexFile, directory } = await fixture(t);
  assert.equal((await repo.list()).length, 0);
  assert.equal(Object.hasOwn((await repo.authorized())[0], "directory"), false);
  for (let i = 0; i < 3; i++) {
    const current = createPluginRepository({ indexFile });
    const draft = await current.inspectAuthorized(7, grant);
    const prepared = await current.prepare(7, {
      token: draft.token,
      manifest: draft.manifest,
    });
    await current.commit(7, prepared.generation);
    assert.equal((await current.authorized())[0].registered, true);
    await assert.rejects(current.inspectAuthorized(7, grant), /已登记/);
    await current.remove(grant.id);
    assert.equal((await current.authorized())[0].registered, false);
    assert.ok(await fs.stat(path.join(directory, "index.mjs")));
  }
});
test("P14 审阅、准备和提交各阶段拒绝内容变化、伪造授权及撤销竞态", async (t) => {
  const { repo, directory, draft, grant } = await fixture(t);
  await assert.rejects(
    repo.authorize(2, { token: draft.token, manifest: draft.manifest }),
    /失效/,
  );
  await assert.rejects(
    repo.authorize(1, {
      token: draft.token,
      manifest: { ...draft.manifest, name: "未保存的修改" },
    }),
    /先保存/,
  );
  await assert.rejects(
    repo.inspectAuthorized(1, { ...grant, authorizationId: "invented" }),
    /授权/,
  );
  await assert.rejects(
    repo.prepare(1, {
      token: draft.token,
      manifest: draft.manifest,
      authorization: grant,
    }),
    /确认/,
  );
  const d = await repo.inspectAuthorized(1, grant);
  await assert.rejects(
    repo.prepare(1, {
      token: d.token,
      manifest: { ...d.manifest, name: "替换" },
    }),
    /不一致/,
  );
  const p = await repo.prepare(1, { token: d.token, manifest: d.manifest });
  await repo.revokeAuthorization(grant.id, grant.authorizationId);
  await assert.rejects(repo.commit(1, p.generation), /授权/);
  assert.equal((await repo.list()).length, 0);
  await assert.rejects(
    repo.prepare(1, { token: d.token, manifest: d.manifest }),
    /授权/,
  );
  await repo.authorize(1, { token: draft.token, manifest: draft.manifest });
  const fresh = (await repo.authorized())[0];
  const d2 = await repo.inspectAuthorized(1, fresh);
  await fs.appendFile(path.join(directory, "index.mjs"), "\n// changed\n");
  await assert.rejects(repo.inspectAuthorized(1, fresh), /变化/);
  await assert.rejects(
    repo.prepare(1, { token: d2.token, manifest: d2.manifest }),
    /变化/,
  );
  await assert.rejects(
    repo.authorize(1, { token: draft.token, manifest: draft.manifest }),
    /变化/,
  );
});
test("P14 撤销加载期间的登记授权会回滚贡献，不写入登记", async (t) => {
  const { repo, grant } = await fixture(t),
    mounted = new Map();
  let released = 0;
  const host = {
    list: () => [...mounted.values()],
    register: (p) => mounted.set(p.manifest.id, { id: p.manifest.id }),
    unregister: async (id) => mounted.delete(id),
    setEnabled: async (id, enabled) => {
      mounted.get(id).enabled = enabled;
      if (enabled)
        await repo.revokeAuthorization(grant.id, grant.authorizationId);
    },
  };
  const platform = {
    onFault: () => () => {},
    call: async (name, input = {}) => {
      if (name === "inspectAuthorized") return repo.inspectAuthorized(1, input);
      if (name === "prepare") return repo.prepare(1, input);
      if (name === "commit")
        return repo.commit(1, input.generation, input.enabled);
      if (name === "release") {
        released++;
        return repo.release(1, input.generation);
      }
    },
  };
  const service = createPluginManagement({
    host,
    platform,
    invalidate() {},
    builtinIds: new Set(),
    setBuiltin() {},
  });
  await assert.rejects(
    service.api.registerAuthorized(grant.id, grant.authorizationId),
    /授权/,
  );
  assert.equal(mounted.size, 0);
  assert.equal((await repo.list()).length, 0);
  assert.equal(released, 1);
  service.dispose();
});
test("P14 MCP 管理白名单严格区分读写，不接受路径、授权或源码", () => {
  for (const [method, input, permission] of [
    ["authorized", {}, "session.read"],
    ["inspectPanels", { id: "example.sdk-effect" }, "session.read"],
    [
      "registerAuthorized",
      { id: "example.sdk-effect", authorizationId: "approved" },
      "session.write",
    ],
    ["remove", { id: "example.sdk-effect" }, "session.write"],
  ]) {
    assert.equal(
      commandPermission({ pluginCall: { method, input } }),
      permission,
    );
    for (const key of [
      "path",
      "directory",
      "manifest",
      "approvePermissions",
      "source",
    ])
      assert.throws(() =>
        readPluginCall({ method, input: { ...input, [key]: "injected" } }),
      );
  }
  for (const method of ["authorize", "revokeAuthorization", "install"])
    assert.throws(() => readPluginCall({ method, input: {} }));
});
test("P14 公开工具在转发之前拒绝额外路径和批准参数，不静默丢弃", async () => {
  let forwarded = 0;
  const service = createMcpTools({
    readState() {
      forwarded++;
    },
    submit() {
      forwarded++;
    },
    bridge: "local",
  });
  const guard = {
    documentId: "test",
    documentToken: "token",
    stage: "fragment",
    expectedRevision: 0,
  };
  for (const key of [
    "path",
    "directory",
    "manifest",
    "approvePermissions",
    "source",
  ])
    await assert.rejects(
      service.call("workflow_register_authorized_plugin", {
        ...guard,
        id: "example.sdk-effect",
        authorizationId: "approved",
        [key]: "injected",
      }),
    );
  assert.equal(forwarded, 0);
});
test("P14 面板诊断需要独立权限，停用释放贡献，不暴露值和处理器", async () => {
  const service = createExtensionUiService(
      () => ({ dispose() {} }),
      (v) => v,
    ),
    runtime = new PluginRuntime();
  runtime.register({
    manifest: {
      id: "local.ui-provider",
      version: "1.0.0",
      apiVersion: "1.0.0",
      requiredApis: {},
      capabilities: [],
      providesApis: { "studio.extension-ui": extensionUiContract },
    },
    activate(c) {
      c.provide("studio.extension-ui", service.scoped);
    },
  });
  let owner, inspector;
  const manifest = (id, capabilities) => ({
    id,
    version: "1.0.0",
    apiVersion: "1.0.0",
    requiredApis: { "studio.extension-ui": "^1.0.0" },
    capabilities,
  });
  runtime.register({
    manifest: manifest("local.owner", ["extension.ui"]),
    activate(c) {
      owner = c.api("studio.extension-ui");
    },
  });
  runtime.register({
    manifest: manifest("local.inspector", ["extension.ui.inspect"]),
    activate(c) {
      inspector = c.api("studio.extension-ui");
    },
  });
  try {
    await runtime.setEnabled("local.owner", true);
    await runtime.setEnabled("local.inspector", true);
    owner.create({
      id: "local.owner.panel",
      title: "诊断",
      placement: "settings",
      tree: { id: "secret", type: "input", value: "private" },
    });
    assert.throws(() => owner.inspect({ owner: "local.owner" }), /权限|能力/);
    const result = inspector.inspect({ owner: "local.owner" });
    assert.equal(result.panels.length, 1);
    assert.deepEqual(result.panels[0].controls, [
      { id: "secret", type: "input" },
    ]);
    assert.equal(JSON.stringify(result).includes("private"), false);
    await runtime.setEnabled("local.owner", false);
    assert.deepEqual(inspector.inspect({ owner: "local.owner" }), {
      panels: [],
    });
    assert.throws(() => owner.create({}), /撤销|停用/);
  } finally {
    await runtime.dispose();
    service.dispose();
  }
});

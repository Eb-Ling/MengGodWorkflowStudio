// 开发回归：验证公开契约、真实内核和实际边界规则，不代替 MCP 用户路径。
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import ts from "typescript";
import { checkCommandDeclarations } from "./generate-command-types.mjs";
import {
  validateValue,
  validateSchema,
  copyJson,
} from "../packages/plugin-sdk/schema.mjs";
import {
  GRAPH_PAYLOAD_SCHEMAS,
  ACTION_SCHEMAS,
  validateGraphCommand,
  validateAction,
} from "../packages/plugin-sdk/commands.mjs";
import { workflowEditSchema } from "../packages/plugin-sdk/workflow-edit.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { ApiBroker } from "../packages/kernel/api-broker.mjs";
import { ContributionRegistry } from "../packages/kernel/contribution-registry.mjs";
import { OperationRegistry } from "../packages/kernel/operation-registry.mjs";
import { createNodeContributions } from "../frontend/application/node-contributions.js";
import { createWorkspaceState } from "../plugins/ui/workspace-registry.ts";
import {
  registration,
  ownRegistration,
} from "../packages/plugin-sdk/registration.mjs";
import { workspaceTarget, sourceBoundaryErrors } from "./source-boundary.mjs";
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
const definition = {
  version: "1.0.0",
  methods: {
    value: {
      arguments: { type: "array", maxItems: 0 },
      returns: { type: "number" },
    },
  },
};
const batch = (id = "test.nodes.value") => ({
  nodes: [
    {
      typeId: id,
      title: "值",
      inputs: [],
      outputs: [{ name: "value", type: "FLOAT" }],
      properties: {},
    },
  ],
  compilers: ["glsl-430", "glsl-es-300"].map((target) => ({
    typeId: id,
    target,
    compile: () => ({ kind: "literal", type: "FLOAT", value: 1 }),
  })),
});
const code = (expected) => (error) => error.code === expected;
const component = { render: () => null };

test("P9 公开命令和常用编辑类型生成无漂移，编译期覆盖新增文件动作与完整节点与便捷编辑字段", async () => {
  await checkCommandDeclarations();
  const file = path.resolve("build/contract-type-probe.ts");
  const source = `import type {GraphCommand,ApplicationCommand,WorkflowEditInput,DocumentTransaction} from '../packages/plugin-sdk/types';
const add:GraphCommand={type:'ADD_NODE',payload:{node:{id:'a',typeId:'test.value',canvasX:0,canvasY:0,properties:{}}}};
const file:ApplicationCommand={type:'PROJECT_FILE',payload:{operation:'status'}};
const restore:ApplicationCommand={type:'RESTORE_PROJECT_DOCUMENT',payload:{document:{}}};
const edit:WorkflowEditInput={add:[{typeId:'test.value'}]};
const tx:DocumentTransaction={commands:[{type:'REMOVE_NODE',stage:'vertex',payload:{nodeId:'a'}}]};
// @ts-expect-error 文档事务命令必须声明阶段
const noStage:DocumentTransaction={commands:[{type:'REMOVE_NODE',payload:{nodeId:'a'}}]};
// @ts-expect-error 精确图命令需完整节点，便捷编辑才补默认值
const incomplete:GraphCommand={type:'ADD_NODE',payload:{node:{id:'a',typeId:'test.value'}}};
// @ts-expect-error MOVE_NODE 的 x 必须是数字
const badMove:GraphCommand={type:'MOVE_NODE',payload:{nodeId:'a',x:'1',y:2}};
// @ts-expect-error 必须声明文件操作
const missing:ApplicationCommand={type:'PROJECT_FILE',payload:{}};
// @ts-expect-error 未支持的文件操作
const badFile:ApplicationCommand={type:'PROJECT_FILE',payload:{operation:'erase'}};
// @ts-expect-error 节点创建必须有 typeId
const badEdit:WorkflowEditInput={add:[{id:'a'}]};
// @ts-expect-error 不允许不存在的编辑字段
const unknown:WorkflowEditInput={replace:true};
// @ts-expect-error 属性值不能是函数
const badValue:GraphCommand={type:'SET_PROPERTY',payload:{nodeId:'a',key:'x',value:()=>1}};
`;
  const options = {
    strict: true,
    noEmit: true,
    allowJs: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const host = ts.createCompilerHost(options),
    read = host.readFile;
  host.readFile = (name) => (path.resolve(name) === file ? source : read(name));
  const program = ts.createProgram([file], options, host);
  assert.deepEqual(
    ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")),
    [],
  );
  validateGraphCommand("ADD_NODE", { node: { id: "a", typeId: "test.value", canvasX: 0, canvasY: 0, properties: {} } });
  validateAction("PROJECT_FILE", { operation: "status" });
  validateAction("RESTORE_PROJECT_DOCUMENT", { document: {} });
  validateValue({ add: [{ typeId: "test.value" }] }, workflowEditSchema);
  for (const [kind, payload] of [
    ["MOVE_NODE", { nodeId: "a", x: "1", y: 2 }],
    ["SET_PROPERTY", { nodeId: "a", key: "x", value: () => 1 }],
  ])
    assert.throws(
      () => validateGraphCommand(kind, payload),
      code("INVALID_ARGUMENT"),
    );
  for (const payload of [{}, { operation: "erase" }])
    assert.throws(
      () => validateAction("PROJECT_FILE", payload),
      code("INVALID_ARGUMENT"),
    );
  assert.throws(
    () => validateValue({ replace: true }, workflowEditSchema),
    code("INVALID_ARGUMENT"),
  );
  for (const schema of [
    ...Object.values(GRAPH_PAYLOAD_SCHEMAS),
    ...Object.values(ACTION_SCHEMAS),
  ])
    validateSchema(schema);
});

test("P9 schema 未实现规则、矛盾范围和畸形结构在注册前拒绝，anyOf 不吞兄弟约束", () => {
  for (const s of [
    { type: "typo" },
    { type: "string", pattern: "[" },
    { oneOf: [{}] },
    { type: "array", items: [] },
    { enum: [] },
    { type: "number", minimum: 5, maximum: 1 },
    { type: "object", additionalProperties: false, required: ["missing"] },
  ])
    assert.throws(() => validateSchema(s), code("INVALID_SCHEMA"));
  const s = {
    type: "number",
    minimum: 5,
    anyOf: [{ type: "number" }, { type: "string" }],
  };
  assert.throws(() => validateValue(2, s), code("INVALID_ARGUMENT"));
  assert.throws(() => validateValue("8", s), code("INVALID_ARGUMENT"));
  validateValue(8, s);
  const cycle = {};
  cycle.self = cycle;
  for (const value of [
    cycle,
    NaN,
    [, 1],
    { value: undefined },
    { value: () => 1 },
  ]) {
    assert.throws(() => copyJson(value), code("INVALID_ARGUMENT"));
    assert.throws(() => validateValue(value, {}), code("INVALID_ARGUMENT"));
  }
  const value = { n: 1 };
  assert.deepEqual(copyJson({ a: value, b: value }), {
    a: { n: 1 },
    b: { n: 1 },
  });
  assert.throws(
    () =>
      validateValue(
        { x: 2 },
        { type: "object", properties: { x: { type: "string" } } },
      ),
    (e) => e.code === "INVALID_ARGUMENT" && e.path === "参数.x",
  );
});

test("P9 API 声明隔离调用方对象，非法 schema 和失败宿主发布不留下注册", async () => {
  const broker = new ApiBroker(),
    d = structuredClone(definition);
  broker.declare("test.owner", "test.api", d);
  d.methods.value.returns.type = "string";
  broker.publish("test.owner", "test.api", { value: () => 2 });
  assert.equal(
    broker
      .handle(
        broker.resolve("test.api", "1.0.0"),
        "test.c",
        new Set(),
        () => true,
      )
      .value(),
    2,
  );
  const host = new PluginRuntime();
  assert.throws(
    () =>
      host.provide("test.host", "1.0.0", {}, false, { methods: { value: {} } }),
    /缺少方法/,
  );
  host.provide("test.host", "1.0.0", { value: () => 3 });
  assert.throws(
    () =>
      host.register({
        manifest: manifest("test.bad", {
          providesApis: {
            "test.bad.api": {
              version: "1.0.0",
              methods: {
                value: {
                  arguments: { type: "array" },
                  returns: { oneOf: [{}] },
                },
              },
            },
          },
        }),
        activate() {},
      }),
    code("INVALID_SCHEMA"),
  );
  assert.equal(host.list().length, 0);
  host.register({
    manifest: manifest("test.bad", { requiredApis: { "test.host": "1.0.0" } }),
    activate(c) {
      assert.equal(c.api("test.host").value(), 3);
    },
  });
  await host.setEnabled("test.bad", true);
  await host.dispose();
});

test("P9 停用开始即撤销提供者，异步清理期间的旧调用和迟到结果被拒绝", async () => {
  const host = new PluginRuntime();
  let api, releaseCleanup, cleanupStarted, resolveCall;
  const cleaning = new Promise((r) => (cleanupStarted = r)),
    pending = new Promise((r) => (resolveCall = r));
  host.register({
    manifest: manifest("test.provider", {
      providesApis: { "test.value": definition },
    }),
    activate(c) {
      c.provide("test.value", { value: () => pending });
      c.onDispose(
        () =>
          new Promise((r) => {
            releaseCleanup = r;
            cleanupStarted();
          }),
      );
    },
  });
  host.register({
    manifest: manifest("test.consumer", {
      requiredApis: { "test.value": "1.0.0" },
    }),
    activate(c) {
      api = c.api("test.value");
    },
  });
  await host.setEnabled("test.consumer", true);
  const late = api.value();
  const stopped = host.setEnabled("test.provider", false);
  await cleaning;
  assert.throws(() => api.value(), code("API_REVOKED"));
  resolveCall(1);
  await assert.rejects(late, code("API_REVOKED"));
  releaseCleanup();
  await stopped;
  await host.dispose();
});

test("P9 无参 API 同步和异步提供者异常有一致错误码，能力不足不执行处理器", async () => {
  const broker = new ApiBroker();
  let called = 0;
  broker.declare("test.p", "test.value", {
    ...definition,
    jsonOnly: true,
    methods: {
      value: { ...definition.methods.value, capability: "value.read" },
    },
  });
  broker.publish("test.p", "test.value", {
    value() {
      called++;
      throw Error("提供者失败");
    },
  });
  const d = broker.resolve("test.value", "1.0.0");
  assert.throws(
    () => broker.handle(d, "test.c", new Set(), () => true).value(),
    code("PERMISSION_DENIED"),
  );
  assert.equal(called, 0);
  assert.throws(
    () =>
      broker.handle(d, "test.c", new Set(["value.read"]), () => true).value(),
    code("OPERATION_FAILED"),
  );
  broker.unpublish("test.p");
  broker.publish("test.p", "test.value", {
    value: async () => {
      throw Error("异步失败");
    },
  });
  await assert.rejects(
    broker.handle(d, "test.c", new Set(["value.read"]), () => true).value(),
    code("OPERATION_FAILED"),
  );
});

test("P9 注册句柄重复释放、主动解绑、own 失败回滚及迟到释放不会删除新节点", () => {
  const callbacks = new Set(),
    own = (fn) => {
      callbacks.add(fn);
      return () => callbacks.delete(fn);
    };
  let released = 0;
  const h = ownRegistration(
    own,
    registration("test.owner", () => released++),
  );
  assert.equal(h.owner, "test.owner");
  assert.equal(h.active, true);
  h.dispose();
  h.dispose();
  assert.equal(released, 1);
  assert.equal(callbacks.size, 0);
  assert.throws(
    () =>
      ownRegistration(
        () => {
          throw Error("已退出");
        },
        registration("test.owner", () => released++),
      ),
    /已退出/,
  );
  assert.equal(released, 2);
  const registry = new ContributionRegistry(),
    first = registry.register("test.nodes", "1.0.0", batch());
  first.dispose();
  const second = registry.register("test.nodes", "1.0.0", batch());
  first.dispose();
  assert.equal(registry.list().length, 1);
  second.dispose();
  const nodes = createNodeContributions([
    { typeId: "io.test", title: "基础", inputs: [], outputs: [] },
  ]);
  const api = nodes.createApi("test.nodes", () => {
    throw Error("已退出");
  });
  assert.throws(() => api.register(batch()), /已退出/);
  assert.equal(nodes.registry.get("test.nodes.value"), null);
  nodes.dispose();
});

test("P9 节点与操作整批失败无残留，操作旧 Promise 和旧句柄不能影响替代注册", async () => {
  const registry = new ContributionRegistry(),
    bad = batch("test.nodes.bad");
  bad.nodes[0].propertySchema = {
    type: "object",
    additionalProperties: false,
    required: ["x"],
  };
  assert.throws(
    () =>
      registry.register("test.nodes", "1.0.0", {
        nodes: [...batch().nodes, ...bad.nodes],
        compilers: [...batch().compilers, ...bad.compilers],
      }),
    code("INVALID_SCHEMA"),
  );
  assert.equal(registry.list().length, 0);
  const operations = new OperationRegistry();
  let resolve;
  const spec = {
    id: "test.owner.value",
    title: "值",
    inputSchema: { type: "object" },
    outputSchema: { type: "number" },
    run: () => new Promise((r) => (resolve = r)),
  };
  assert.throws(
    () =>
      operations.register("test.owner", "1.0.0", [
        spec,
        { ...spec, id: "test.owner.bad", outputSchema: { oneOf: [{}] } },
      ]),
    code("INVALID_SCHEMA"),
  );
  assert.equal(operations.list().length, 0);
  const first = operations.register("test.owner", "1.0.0", [spec]),
    late = operations.execute(spec.id, {});
  first.dispose();
  const second = operations.register("test.owner", "1.0.0", [
    { ...spec, run: () => 2 },
  ]);
  first.dispose();
  resolve(1);
  await assert.rejects(late, code("API_REVOKED"));
  assert.equal(operations.execute(spec.id, {}), 2);
  second.dispose();
});

test("P9 UI 挂载失败回滚，主动释放移除兜底，提供者销毁后旧接口不可用", () => {
  const state = createWorkspaceState();
  let count = 0;
  const api = state.createWorkspaceRegistration("test.ui", () => {
    if (++count > 1) throw Error("停用中");
  });
  assert.throws(
    () => api.addView({ id: "test.ui.view", slot: "graph", component }),
    /停用中/,
  );
  assert.equal(state.workspaceViews.value.length, 0);
  const callbacks = new Set(),
    good = state.createWorkspaceRegistration("test.good", (fn) => {
      callbacks.add(fn);
      return () => callbacks.delete(fn);
    }),
    baseline = callbacks.size;
  const h = good.addView({ id: "test.good.view", slot: "graph", component });
  assert.equal(callbacks.size, baseline + 1);
  h.dispose();
  assert.equal(callbacks.size, baseline);
  good.addView({ id: "test.good.view", slot: "graph", component });
  h.dispose();
  assert.equal(state.workspaceViews.value.length, 1);
  state.dispose();
  assert.equal(state.workspaceViews.value.length, 0);
  assert.throws(
    () => good.addView({ id: "test.good.new", slot: "graph", component }),
    code("API_REVOKED"),
  );
});

test("P9 相对路径与工作区包别名共同执行私有入口、实现和 UI 边界门禁", () => {
  const manifests = new Map([
    [
      "packages/plugin-sdk",
      { name: "@workflow/plugin-sdk", exports: { ".": "./index.mjs" } },
    ],
    [
      "packages/kernel",
      { name: "@workflow/kernel", exports: { ".": "./index.mjs" } },
    ],
    [
      "plugins/compiler",
      { name: "@workflow-plugin/compiler", exports: { ".": "./index.mjs" } },
    ],
  ]);
  assert.equal(
    workspaceTarget("@workflow/plugin-sdk", manifests),
    "packages/plugin-sdk/index.mjs",
  );
  assert.throws(
    () => workspaceTarget("@workflow/kernel/api-broker", manifests),
    /非公开/,
  );
  for (const [from, to, target] of [
    ["plugins/test", "packages/kernel", "packages/kernel/index.mjs"],
    ["packages/plugin-sdk", "packages/kernel", "packages/kernel/index.mjs"],
    ["plugins/test", "plugins/compiler", "plugins/compiler/index.mjs"],
    ["plugins/test", "packages/ui-kit", "packages/ui-kit/index.ts"],
  ])
    assert.ok(
      sourceBoundaryErrors(from + "/index.mjs", target, { from, to }).length,
    );
  assert.deepEqual(
    sourceBoundaryErrors(
      "plugins/test/index.mjs",
      "packages/plugin-sdk/index.mjs",
      { from: "plugins/test", to: "packages/plugin-sdk" },
    ),
    [],
  );
});

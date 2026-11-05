// 独立契约测试只加载 Node 标准库、内核、SDK 和 Noise，不加载应用/UI/其他插件。
import test from "node:test";
import assert from "node:assert/strict";
import { ContributionRegistry } from "../packages/kernel/index.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { ir, validateExpression } from "../packages/plugin-sdk/ir.mjs";
import { noisePlugin } from "../plugins/noise/index.mjs";
import { noiseContribution } from "../plugins/noise/contribution.mjs";

test("Noise alone registers ten namespaced nodes and both targets through its public API, then unloads cleanly", async () => {
  const registry = new ContributionRegistry(),
    host = new PluginRuntime();
  host.provide(
    "workflow.nodes",
    "1.0.0",
    (owner, own, metadata) => ({
      register(batch) {
        const handle = registry.register(owner, metadata.version, batch);
        own(() => handle.dispose());
        return handle;
      },
    }),
    true,
    { methods: { register: { capability: "nodes.register" } } },
  );
  host.register(noisePlugin, { grantedCapabilities: ["nodes.register"] });
  for (let cycle = 0; cycle < 3; cycle++) {
    await host.setEnabled("studio.noise", true);
    assert.equal(registry.list().length, 10);
    for (const node of registry.list())
      for (const target of node.targets) {
        assert.equal(node.owner, "studio.noise");
        assert.deepEqual(node.stages, ["vertex", "fragment"]);
        const result = registry.compile(node.typeId, target, {
          node: { properties: node.properties },
          socket: "value",
          outputType: "FLOAT",
          inputs: Object.fromEntries(node.inputs.map((p) => [p.name, p.type])),
        });
        assert.equal(result.type, "FLOAT");
        assert.equal(result.kind, "block");
        assert.ok(
          JSON.stringify(result).length < 400000,
          "IR must remain bounded",
        );
        assert.doesNotThrow(() => validateExpression(result));
      }
    await host.setEnabled("studio.noise", false);
    assert.deepEqual(registry.list(), []);
    assert.throws(
      () => registry.compile("studio.noise.value", "glsl-430", {}),
      /缺少/,
    );
  }
  await host.dispose();
});
test("Noise contribution copies do not share mutable definitions and incomplete target sets roll back", () => {
  const registry = new ContributionRegistry(),
    a = noiseContribution(),
    b = noiseContribution();
  a.nodes[0].inputs[0].name = "changed";
  assert.notEqual(b.nodes[0].inputs[0].name, "changed");
  assert.throws(
    () =>
      registry.register("studio.noise", "1.0.0", {
        ...b,
        compilers: b.compilers.slice(1),
      }),
    /缺少/,
  );
  assert.deepEqual(registry.list(), []);
});
test("typed local blocks reject forward references, duplicate names, leaking references and invalid swizzles", () => {
  const literal = ir.literal("FLOAT", 1),
    ref = ir.ref("FLOAT", "local");
  assert.throws(() => validateExpression(ref), /引用/);
  assert.throws(
    () => validateExpression(ir.block([{ name: "local", value: ref }], ref)),
    /引用/,
  );
  assert.throws(
    () =>
      validateExpression(
        ir.block(
          [
            { name: "local", value: literal },
            { name: "local", value: literal },
          ],
          ref,
        ),
      ),
    /重复/,
  );
  assert.throws(
    () => validateExpression(ir.swizzle("FLOAT", "z", ir.input("VEC2", "uv"))),
    /越界/,
  );
  assert.throws(
    () => validateExpression(ir.swizzle("VEC3", "xy", ir.input("VEC2", "uv"))),
    /类型/,
  );
  assert.doesNotThrow(() =>
    validateExpression(ir.block([{ name: "local", value: literal }], ref)),
  );
});
test("registry validates declared inputs inside structured blocks without any Noise-specific kernel rule", () => {
  const registry = new ContributionRegistry();
  registry.register("test.extension", "1.0.0", {
    nodes: [
      {
        typeId: "test.extension.block",
        title: "test",
        inputs: [],
        outputs: [{ name: "value", type: "FLOAT" }],
        properties: {},
        targets: ["glsl-430"],
      },
    ],
    compilers: [
      {
        typeId: "test.extension.block",
        target: "glsl-430",
        compile: () =>
          ir.block(
            [{ name: "a", value: ir.input("FLOAT", "forged") }],
            ir.ref("FLOAT", "a"),
          ),
      },
    ],
  });
  assert.throws(
    () =>
      registry.compile("test.extension.block", "glsl-430", {
        node: { properties: {} },
        socket: "value",
      }),
    /未知输入/,
  );
});

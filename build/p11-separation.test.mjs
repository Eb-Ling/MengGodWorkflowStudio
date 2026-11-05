import test from "node:test";
import assert from "node:assert/strict";
import { pipelineHarness } from "./compiler-pipeline-support.mjs";
import {
  normalizeTransform,
  geometryParameters,
} from "../packages/workflow-tools/geometry.mjs";
import { defaultVertexGraph } from "../packages/workflow-tools/defaults.mjs";
import { validParameterId } from "../packages/workflow-tools/parameters.mjs";
import {
  createStarsectorExport,
  validateStarsectorParameters,
} from "../plugins/starsector/export-service.mjs";
import { shader, constant } from "../packages/shader-ir/index.mjs";
import { emitModule } from "../plugins/glsl-backend/emitter.mjs";
import {
  neutralCompilationPackages,
  sourceBoundaryErrors,
  targetDependencyErrors,
  workspaceTarget,
} from "./source-boundary.mjs";

const node = (id, typeId, properties = {}) => ({
  id,
  typeId,
  canvasX: 0,
  canvasY: 0,
  properties,
});
function graph(parameterId = "color", uniform = "u_color") {
  return {
    revision: 0,
    outputNodeId: "output",
    nodes: [
      node("color", "io.input", {
        parameterId,
        uniform,
        valueType: "VEC4",
        scope: "shared",
        defaultValue: "0.2,0.5,0.9,1",
      }),
      node("output", "io.output"),
    ],
    links: [
      {
        fromNode: "color",
        fromSocket: "value",
        toNode: "output",
        toSocket: "color",
      },
    ],
  };
}

test("P11 无游戏目标的通用编译接受中立参数 ID，Java 限制只在导出时检查", async () => {
  const h = pipelineHarness();
  try {
    for (const id of ["class", "layer", "position", "positions", "java", "_"]) {
      assert.equal(validParameterId(id), true);
      const value = graph(id),
        document = h.document(value);
      const data = await h.compilation.describe(document);
      assert.equal(data.inputs[0].id, id);
      for (const target of ["glsl-es-300", "glsl-430"])
        assert.match(h.fragmentSource(value, target), /uniform vec4 u_color/);
      assert.throws(() => validateStarsectorParameters(data), /无效|保留/);
    }
    for (const id of ["a-b", "1name", "", "含中文"])
      assert.equal(validParameterId(id), false);
  } finally {
    Object.values(h.handles).forEach((handle) => handle.dispose());
    h.dispose();
  }
});

test("P11 通用快照透传目标配置，保留 uniform 和高阶类型语义但不解释游戏 ABI", async () => {
  const h = pipelineHarness();
  try {
    const document = h.document(graph("projection", "u_viewProjection"));
    document.config = {
      targetOptions: { userTarget: true },
      className: "not-a-java-name",
    };
    const data = await h.compilation.describe(document);
    assert.deepEqual(data.config, document.config);
    assert.match(
      h.fragmentSource(document.fragment, "glsl-es-300"),
      /uniform vec4 u_viewProjection/,
    );
    assert.throws(() => validateStarsectorParameters(data), /运行时保留/);
    const matrixDoc = h.document(graph());
    matrixDoc.fragment.nodes.push(
      node("matrix", "io.input", {
        uniform: "u_matrix",
        parameterId: "matrix",
        valueType: "MAT4",
      }),
    );
    const matrix = await h.compilation.lower({
      document: matrixDoc,
      stage: "fragment",
      target: "glsl-430",
      nodeId: "matrix",
      sockets: ["value"],
    });
    assert.equal(matrix.outputs.value.type, "MAT4");
    assert.throws(
      () => validateStarsectorParameters(h.snapshots.describe(matrixDoc)),
      /公共 uniform 参数不支持/,
    );
  } finally {
    Object.values(h.handles).forEach((handle) => handle.dispose());
    h.dispose();
  }
});

test("P11 目标先验证 Java 入口，失败不进入 GLSL 发射也不改输入", async () => {
  const h = pipelineHarness();
  let emits = 0;
  const target = createStarsectorExport({
    compilation: h.compilation,
    backend: {
      emit() {
        emits++;
        throw Error("不应调用");
      },
    },
    runtimeTemplate: "",
  });
  try {
    for (const [id, className, pattern] of [
      ["class", "Effect", /参数 ID/],
      ["color", "class", /Java 类名/],
      ["color", undefined, /Java 类名/],
      ["color", 123, /Java 类名/],
    ]) {
      const document = h.document(graph(id));
      if (className === undefined) delete document.config.className;
      else document.config.className = className;
      const before = structuredClone(document);
      await assert.rejects(target.generate({ document }), pattern);
      assert.deepEqual(document, before);
    }
    assert.equal(emits, 0);
  } finally {
    Object.values(h.handles).forEach((handle) => handle.dispose());
    h.dispose();
  }
});

test("P11 几何与默认顶点图在中立契约内，实例字段不附带 Java 或缓冲槽位", () => {
  const input = {
    vertices: [
      [-64, -64],
      [64, -64],
      [-64, 64],
      [64, 64],
    ],
    instanceInputs: { sx: { enabled: true, id: "class" } },
  };
  const geometry = normalizeTransform(input);
  assert.deepEqual(geometry.graph, defaultVertexGraph());
  assert.equal(geometryParameters(geometry)[0].id, "class");
  assert.equal(Object.hasOwn(geometryParameters(geometry)[0], "slot"), false);
  geometry.vertices[0][0] = 0;
  assert.equal(input.vertices[0][0], -64);
});

test("P11 SSBO 是目标语言能力，通用 IR 不固定游戏结构名和绑定号", () => {
  const module = shader.module("fragment");
  module.resources = [
    {
      storage: "buffer",
      name: "UserData",
      layout: "std430",
      binding: 2,
      readonly: true,
      members: [{ name: "values", type: "VEC4", array: true }],
    },
    { storage: "out", name: "color", type: "VEC4" },
  ];
  module.body = [
    shader.assign(
      shader.symbol("VEC4", "color"),
      shader.index("VEC4", shader.symbol("VEC4", "values"), constant("INT", 0)),
    ),
  ];
  const result = emitModule({ module, target: "glsl-430" });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.match(result.source, /binding\s*=\s*2/);
  assert.doesNotMatch(result.source, /BUtil|WorkflowParameters|Fixed2D/);
  assert.equal(emitModule({ module, target: "glsl-es-300" }).ok, false);
});

test("P11 相对路径、包别名、类型导入和未使用的清单依赖都不能把目标 ABI 带回通用链", () => {
  const target = workspaceTarget(
    "@workflow/starsector-contract/parameters",
    new Map([
      [
        "packages/starsector-contract",
        {
          name: "@workflow/starsector-contract",
          exports: { "./parameters": "./parameters.mjs" },
        },
      ],
    ]),
  );
  for (const from of neutralCompilationPackages) {
    for (const typeOnly of [true, false])
      assert.ok(
        sourceBoundaryErrors(from + "/test.mjs", target, {
          from,
          to: "packages/starsector-contract",
          typeOnly,
        }).length,
      );
    assert.ok(
      targetDependencyErrors(from, {
        dependencies: { "@workflow/starsector-contract": "workspace:*" },
      }).length,
    );
    assert.ok(
      targetDependencyErrors(from, {
        peerDependencies: { "@workflow-plugin/starsector": "workspace:*" },
      }).length,
    );
  }
  assert.equal(
    sourceBoundaryErrors("plugins/starsector/index.mjs", target, {
      from: "plugins/starsector",
      to: "packages/starsector-contract",
    }).length,
    0,
  );
  assert.equal(
    sourceBoundaryErrors(
      "plugins/geometry-ui/index.ts",
      "packages/starsector-contract/export-api.mjs",
      { from: "plugins/geometry-ui", to: "packages/starsector-contract" },
    ).length,
    0,
  );
});

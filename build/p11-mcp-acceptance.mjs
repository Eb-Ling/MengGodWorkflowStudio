// P11 用户验收只通过公开 MCP，图片与生成源码在内存核对，不操作工作流文件。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { acceptanceSession } from "./final-mcp-acceptance.mjs";

export async function separationAcceptance(client, { neutral = true } = {}) {
  const s = acceptanceSession(client);
  await s.fresh("Separation");
  await s.replace(s.colorGraph());
  const dependency = await s.mutate("workflow_export_runtime_dependency", {
    runtimePath: "data/p11/runtime",
  });
  const dependencyHash = createHash("sha256")
    .update(dependency.content)
    .digest("hex");
  const variants = [
    ["BOOL", "true"],
    ["INT", "-3"],
    ["UINT", "7"],
    ["FLOAT", "0.25"],
    ["VEC2", "0.2,0.4"],
    ["VEC3", "0.2,0.4,0.6"],
    ["VEC4", "0.2,0.4,0.6,1"],
  ];
  await s.mutate("workflow_edit", {
    add: variants.flatMap(([valueType, defaultValue]) =>
      ["shared", "instance"].map((scope) => ({
        id: scope + valueType,
        typeId: "io.input",
        properties: { valueType, defaultValue, scope },
      })),
    ),
  });
  const geometry = {
    ...(await s.summary()).vertexTransform,
    vertices: [
      [-128, -128],
      [128, -128],
      [-128, 128],
      [128, 128],
    ],
    instanceInputs: {
      tx: { enabled: true, id: "translateX" },
      sx: { enabled: true, id: "widthScale" },
      v0x: { enabled: true, id: "leftCorner" },
    },
  };
  await s.mutate("workflow_set_vertex_transform", geometry);
  const parameters = await s.exportEffect();
  assert.match(parameters.java.content, /boolean\[\] instanceBOOL/);
  assert.match(parameters.java.content, /int\[\] instanceUINT/);
  assert.match(parameters.java.content, /Vector4f\[\] instanceVEC4/);
  assert.match(parameters.java.content, /Vector2f position/);
  assert.match(parameters.java.content, /List<Vector2f> positions/);
  assert.match(parameters.vertex.content, /BUtilInstanceData_Fixed2D/);
  assert.match(parameters.vertex.content, /WorkflowParameters/);
  await s.frame({ width: 128, height: 128 }, [51, 128, 230, 255]);
  const tex = await s.frame({ nodeId: "color", width: 8, height: 8 });
  await s.mutate("workflow_edit", {
    add: [
      {
        id: "sprite",
        typeId: "input.texture",
        properties: {
          textureId: "test.p11.texture",
          previewDataUrl: "data:image/png;base64," + tex.image.data,
        },
      },
      { id: "sampleUv", typeId: "input.uv" },
      { id: "sampled", typeId: "texture.sample2d" },
    ],
    connect: [
      {
        fromNode: "sprite",
        fromSocket: "texture",
        toNode: "sampled",
        toSocket: "texture",
      },
      {
        fromNode: "sampleUv",
        fromSocket: "uv",
        toNode: "sampled",
        toSocket: "uv",
      },
      {
        fromNode: "sampled",
        fromSocket: "rgba",
        toNode: "output",
        toSocket: "color",
      },
    ],
  });
  await s.frame({ longEdge: 2048 }, [51, 128, 230, 255]);
  const textureExport = await s.exportEffect();
  assert.match(textureExport.java.content, /SpriteAPI sprite/);
  assert.match(textureExport.fragment.content, /sampleTexture_u_sprite/);
  s.checks.push(
    "共享与逐实例的七种参数、几何字段、公共依赖、纹理、方形画布和普通/高清 PNG",
  );

  if (neutral) {
    await s.mutate("workflow_edit", {
      remove: ["sprite", "sampleUv", "sampled"],
      connect: [
        {
          fromNode: "color",
          fromSocket: "value",
          toNode: "output",
          toSocket: "color",
        },
      ],
    });
    for (const id of ["class", "positions"]) {
      await s.mutate("workflow_set_node_property", {
        nodeId: "color",
        key: "parameterId",
        value: id,
      });
      assert.equal(
        (await s.summary()).graph.nodes.find((n) => n.id === "color").properties
          .parameterId,
        id,
      );
      await s.frame({ width: 64, height: 64 }, [51, 128, 230, 255]);
      const before = await s.summary();
      assert.match(
        await s.mutate("workflow_export_runtime", {}, true),
        /参数 ID|保留/,
      );
      assert.deepEqual((await s.summary()).graph, before.graph);
    }
    await s.mutate("workflow_set_node_property", {
      nodeId: "color",
      key: "parameterId",
      value: "color",
    });
    const restored = await s.exportEffect();
    assert.deepEqual(restored, parameters);
    s.checks.push(
      "通用编辑与 GPU 预览接受 Java 保留名，游戏导出明确拒绝且不改图，修正后原始导出完全恢复",
    );
  }
  return { ...s.report(), dependencyHash };
}

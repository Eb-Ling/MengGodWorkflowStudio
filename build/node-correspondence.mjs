// 开发者语义检查：节点 → 实际 IR → GLSL 行映射，原生像素夹具独立于用户导出验收。
import assert from "node:assert/strict";
import { pipelineHarness } from "./compiler-pipeline-support.mjs";
import { p4Nodes, p4Graph } from "./p4-test-support.mjs";
import { noiseGraph } from "./noise-test-support.mjs";
import { noiseContribution } from "../plugins/noise/contribution.mjs";
import { previewFragment } from "../plugins/compiler/preview.mjs";
import { emitModule } from "../plugins/glsl-backend/emitter.mjs";
import { presetWorkflowNodes } from "../plugins/templates/presets.mjs";
import { defaultVertexGraph } from "../packages/workflow-tools/defaults.mjs";
import { tintContribution } from "../plugins/example-showcase/tint-node.mjs";
export function nodeCorrespondence() {
  const h = pipelineHarness(),
    covered = new Set(),
    mappings = [],
    pixels = [];
  h.registry.register("example.showcase", "1.0.0", tintContribution());
  const node = (id, typeId, properties = {}, canvasX = 0, canvasY = 0) => ({
    id,
    typeId,
    properties,
    canvasX,
    canvasY,
  });
  const link = (fromNode, fromSocket, toNode, toSocket) => ({
    fromNode,
    fromSocket,
    toNode,
    toSocket,
  });
  const graph = (nodes, links = [], outputNodeId = nodes.at(-1).id) => ({
    nodes,
    links,
    outputNodeId,
    revision: 0,
  });
  function emit(g, target = "glsl-430") {
    const l = h.lower(g, target),
      r = emitModule({ module: previewFragment(l), target });
    assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
    return { ...r, lowered: l };
  }
  function mapped(g, id, type, target = "glsl-430") {
    const r = emit(g, target),
      lines = r.sourceMap.filter((x) => x.nodeId === id);
    assert.ok(lines.length, type + " 未映射到 GLSL");
    assert.ok(
      lines.every(
        (x) =>
          x.stage === "fragment" &&
          x.line > 0 &&
          x.line <= r.source.split("\n").length,
      ),
    );
    covered.add(type);
    mappings.push({
      type,
      target,
      nodeId: id,
      lines: lines.map((x) => x.line),
    });
    return r;
  }
  for (const d of p4Nodes)
    for (const target of ["glsl-430", "glsl-es-300"])
      mapped(p4Graph(d), "tested", d.typeId, target);
  for (const d of noiseContribution().nodes)
    for (const target of ["glsl-430", "glsl-es-300"])
      mapped(noiseGraph(d.typeId), "noise", d.typeId, target);
  const uv = node("uv", "input.uv"),
    split = node("x", "studio.math.vector.split", { valueType: "VEC2" }),
    xLink = link("uv", "uv", "x", "value");
  const operations = {
    equal: "==",
    notEqual: "!=",
    greater: ">",
    greaterEqual: ">=",
    less: "<",
    lessEqual: "<=",
    and: "&&",
    or: "||",
    not: "!",
  };
  for (const [name, op] of Object.entries(operations)) {
    const logical = ["and", "or", "not"].includes(name),
      typeId = "logic." + name;
    const a = logical ? node("a", "logic.greater") : split,
      b = node("b", "studio.math.constant", {
        valueType: logical ? "BOOL" : "FLOAT",
        value: logical ? "true" : "0.5",
      }),
      subject = node("subject", typeId, { valueType: "FLOAT" });
    const g = graph(
      logical ? [uv, split, a, b, subject] : [uv, split, b, subject],
      [
        xLink,
        ...(logical ? [link("x", "x", "a", "a")] : []),
        link(
          a.id,
          logical ? "value" : "x",
          "subject",
          name === "not" ? "value" : "a",
        ),
        ...(name === "not" ? [] : [link("b", "value", "subject", "b")]),
      ],
    );
    const r = mapped(g, "subject", typeId);
    mapped(g, "subject", typeId, "glsl-es-300");
    const statement = r.lowered.body.find(
      (s) => s.origin?.nodeId === "subject",
    );
    assert.equal(statement.value.operator, op);
    const expression =
      name === "not"
        ? "!(v_uv.x > 0.0)"
        : logical
          ? `((v_uv.x > 0.0) ${op} true)`
          : `(v_uv.x ${op} 0.5)`;
    pixels.push({
      name: "logic_" + name,
      actual: r.source,
      expected: `vec4(vec3(${expression} ? 1.0 : 0.0),1.0)`,
    });
  }
  for (const name of ["radialFade", "innerFade"]) {
    const id = "custom." + name,
      g = graph(
        [uv, split, node("time", "input.time"), node("custom", id)],
        [
          xLink,
          link("x", "x", "custom", "distance"),
          ...(name === "innerFade"
            ? [link("time", "time", "custom", "time")]
            : []),
        ],
      );
    const r = mapped(g, "custom", id);
    mapped(g, "custom", id, "glsl-es-300");
    pixels.push({
      name,
      actual: r.source,
      expected:
        name === "radialFade"
          ? "vec4(vec3(1.0 - smoothstep(0.5,1.0,v_uv.x)),1.0)"
          : "vec4(vec3(smoothstep(0.25+0.025*sin(0.37*3.0),0.5+0.025*sin(0.37*3.0),v_uv.x)),1.0)",
    });
    if (name === "radialFade")
      assert.match(r.source, /1\.0 - smoothstep\(0\.5, 1\.0, distance\)/);
  }
  const horizontal = presetWorkflowNodes()[0].graph;
  horizontal.outputNodeId = "wf_multiply";
  horizontal.revision = 0;
  pixels.push({
    name: "horizontalFade",
    actual: emit(horizontal).source,
    expected:
      "vec4(vec3(smoothstep(0.0,0.15,v_uv.x)*(1.0-smoothstep(0.85,1.0,v_uv.x))),1.0)",
  });
  for (const [typeId, socket, uniform, properties, expected] of [
    ["input.uv", "uv", "v_uv", {}, "vec4(v_uv*0.5+0.5,0.5,1.0)"],
    ["input.time", "time", "u_time", {}, "vec4(vec3(0.37),1.0)"],
    [
      "io.input",
      "value",
      "u_test",
      { uniform: "u_test", valueType: "FLOAT", defaultValue: ".25" },
      "vec4(vec3(0.25),1.0)",
    ],
  ]) {
    const r = emit(graph([node("input", typeId, properties)]));
    const alias = r.lowered.body.find(s => s.name === r.lowered.outputs[socket].name);
    assert.equal(alias.origin.nodeId, "input");
    assert.equal(alias.value.name, uniform);
    covered.add(typeId);
    pixels.push({
      name: typeId.replaceAll(".", "_"),
      actual: r.source,
      expected,
    });
  }
  const texture = graph(
    [
      uv,
      node("texture", "input.texture", { uniform: "u_texture" }),
      node("sample", "texture.sample2d"),
    ],
    [
      link("uv", "uv", "sample", "uv"),
      link("texture", "texture", "sample", "texture"),
    ],
  );
  const tex = mapped(texture, "sample", "texture.sample2d");
  covered.add("input.texture");
  assert.match(tex.source, /uniform sampler2D u_texture;/);
  pixels.push({
    name: "texture",
    actual: tex.source,
    expected: "vec4(0.2,0.4,0.6,1.0)",
  });
  const v = h.lower(defaultVertexGraph(), "glsl-430", "vertex");
  assert.equal(v.body.find(s => s.name === v.outputs.position.name).value.name, "a_position");
  assert.equal(v.body.find(s => s.name === v.outputs.uv.name).value.name, "v_uv");
  covered.add("input.position");
  covered.add("vertex.output");
  const color = node("color", "studio.math.constant", {
      valueType: "VEC4",
      value: ".1,.2,.3,1",
    }),
    o = emit(
      graph(
        [color, node("out", "io.output")],
        [link("color", "value", "out", "color")],
      ),
    );
  assert.equal(o.lowered.outputs.color.name, o.lowered.body[0].name);
  covered.add("io.output");
  const loop = graph(
    [
      node("count", "io.input", {
        uniform: "u_count",
        valueType: "FLOAT",
        defaultValue: "4",
      }),
      node("for", "logic.for", {}, 100, 100),
      node(
        "acc",
        "logic.variable",
        { valueType: "FLOAT", initialValue: "0" },
        130,
        200,
      ),
      node("add", "studio.math.add", { valueType: "FLOAT" }, 330, 200),
    ],
    [
      link("count", "value", "for", "count"),
      link("acc", "value", "add", "a"),
      link("for", "i", "add", "b"),
      link("add", "value", "acc", "value"),
    ],
    "acc",
  );
  for (const [id, type] of [
    ["for", "logic.for"],
    ["acc", "logic.variable"],
  ])
    mapped(loop, id, type);
  const branch = graph(
    [
      node("condition", "io.input", {
        uniform: "u_condition",
        valueType: "BOOL",
        defaultValue: "true",
      }),
      node("if", "logic.if", {}, 100, 100),
      node(
        "a",
        "logic.variable",
        { valueType: "FLOAT", initialValue: "0" },
        150,
        180,
      ),
      node(
        "b",
        "logic.variable",
        { valueType: "FLOAT", initialValue: "0" },
        650,
        180,
      ),
      node("outside", "studio.math.add", { valueType: "FLOAT" }, 0, 600),
      node("sum", "studio.math.add", { valueType: "FLOAT" }, 950, 550),
    ],
    [
      link("condition", "value", "if", "condition"),
      link("outside", "value", "a", "value"),
      link("outside", "value", "b", "value"),
      link("a", "value", "sum", "a"),
      link("b", "value", "sum", "b"),
    ],
  );
  mapped(branch, "if", "logic.if");
  const tint = mapped(
    graph([
      node("tint", "example.showcase.tint", {
        red: 0.2,
        green: 0.6,
        blue: 1,
        alpha: 1,
      }),
    ]),
    "tint",
    "example.showcase.tint",
  );
  pixels.push({
    name: "showcase_tint",
    actual: tint.source,
    expected: "vec4(0.2,0.6,1.0,1.0)",
  });
  const missing = h.catalog
    .filter((d) => !covered.has(d.typeId))
    .map((d) => d.typeId);
  assert.deepEqual(missing, [], "每个内置节点必须有编译/映射见证");
  return {
    count: covered.size,
    covered: [...covered].sort(),
    mappings,
    pixels,
  };
}

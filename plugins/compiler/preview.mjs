import { shader as s, constant as c } from "../../packages/shader-ir/index.mjs";
import {
  stageModule,
  colorExpression,
  rotateFunction,
  vertexUv,
  transformPosition,
  uniform,
} from "../../packages/shader-ir/stages.mjs";
export function previewFragment(lowered, node = false) {
  const m = stageModule(lowered, "fragment");
  m.resources.push(
    { storage: "in", type: "VEC2", name: "v_uv" },
    { storage: "out", type: "VEC4", name: "fragColor" },
  );
  if (node)
    m.body.unshift(
      s.declare(
        "a_position",
        "VEC2",
        s.binary(
          "VEC2",
          "*",
          s.binary("VEC2", "-", s.symbol("VEC2", "v_uv"), c("VEC2", 0.5)),
          c("VEC2", [360, 180]),
        ),
      ),
    );
  m.body.push(
    s.assign(
      s.symbol("VEC4", "fragColor"),
      colorExpression(Object.values(lowered.outputs)[0]),
    ),
  );
  return m;
}
export function previewVertex(lowered, geometry) {
  const m = stageModule(lowered),
    prefix = [
      s.declare("a_position", "VEC2", s.symbol("VEC2", "position")),
      s.assign(s.symbol("VEC2", "v_uv"), vertexUv()),
    ];
  m.resources.push(
    { storage: "in", name: "position", type: "VEC2" },
    { storage: "out", name: "v_uv", type: "VEC2" },
    uniform("wf_preview_extent", "VEC2"),
  );
  m.functions.unshift(rotateFunction());
  m.body = [
    ...prefix,
    ...m.body,
    s.assign(s.symbol("VEC2", "v_uv"), lowered.outputs.uv),
    s.declare(
      "local",
      "VEC2",
      transformPosition(lowered.outputs.position, geometry),
    ),
    s.assign(
      s.symbol("VEC4", "gl_Position"),
      s.call(
        "VEC4",
        "vec4",
        s.binary(
          "VEC2",
          "/",
          s.symbol("VEC2", "local"),
          s.symbol("VEC2", "wf_preview_extent"),
        ),
        c("FLOAT", 0),
        c("FLOAT", 1),
      ),
    ),
  ];
  return m;
}
export function previewScreenVertex() {
  const m = s.module("vertex");
  m.resources = [
    { storage: "in", name: "position", type: "VEC2" },
    { storage: "out", name: "v_uv", type: "VEC2" },
  ];
  m.body = [
    s.assign(
      s.symbol("VEC2", "v_uv"),
      s.binary(
        "VEC2",
        "+",
        s.binary("VEC2", "*", s.symbol("VEC2", "position"), c("FLOAT", 0.5)),
        c("VEC2", 0.5),
      ),
    ),
    s.assign(
      s.symbol("VEC4", "gl_Position"),
      s.call(
        "VEC4",
        "vec4",
        s.symbol("VEC2", "position"),
        c("FLOAT", 0),
        c("FLOAT", 1),
      ),
    ),
  ];
  return m;
}

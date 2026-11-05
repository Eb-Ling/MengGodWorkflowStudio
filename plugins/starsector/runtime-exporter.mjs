import {
  shader as s,
  constant as c,
  replaceSymbols,
} from "../../packages/shader-ir/index.mjs";
import {
  stageModule,
  rotateFunction,
  vertexUv,
  transformPosition,
  uniform,
} from "../../packages/shader-ir/stages.mjs";
import { validateParameterIds } from "../../packages/starsector-contract/parameters.mjs";
import { materialJava } from "./java-material.mjs";
import {
  geometryParameters,
  effectiveParameters,
  normalizeTransform,
} from "../../packages/workflow-tools/geometry.mjs";

const types = {
  BOOL: ["boolean", "bool"],
  INT: ["int", "int"],
  UINT: ["int", "uint"],
  FLOAT: ["float", "float"],
  VEC2: ["Vector2f", "vec2"],
  VEC3: ["Vector3f", "vec3"],
  VEC4: ["Vector4f", "vec4"],
};
export function parameterLayout(inputs) {
  const seen = new Set();
  let slot = 0;
  return inputs.map((p) => {
    const type = String(p.type).toUpperCase();
    if (
      !types[type] ||
      !/^u_[A-Za-z0-9_]+$/.test(p.name) ||
      ["u_time", "u_viewportAlpha", "u_instanceOffset", "u_viewProjection"].includes(p.name) ||
      seen.has(p.name)
    )
      throw new Error(`无效、重复或保留参数：${p.name}`);
    if (p.scope && !["shared", "instance"].includes(p.scope))
      throw new Error(`未知参数作用域：${p.scope}`);
    seen.add(p.name);
    const scope = p.scope ?? "shared";
    return {
      ...p,
      id: p.id ?? p.name.replace(/^u_/, ""),
      type,
      scope,
      slot: scope === "instance" ? slot++ : null,
    };
  });
}

/** 目标插件只描述参数布局和阶段连接，不拼接/替换生成后的 GLSL。 */
export function buildShaderModules({
  transform,
  inputs,
  textures,
  vertex,
  fragment,
}) {
  const t = normalizeTransform(transform),
    geometry = geometryParameters(t),
    layout = parameterLayout([...geometry, ...effectiveParameters(inputs, t)]),
    instances = layout.filter((p) => p.scope === "instance"),
    shared = layout.filter((p) => p.scope === "shared"),
    slots = Math.max(1, instances.length);
  if (
    !vertex?.outputs?.position ||
    !vertex.outputs.uv ||
    !fragment?.outputs?.color
  )
    throw Error("导出需要完整的顶点与片段结构化 IR");
  validateParameterIds([...layout, ...textures]);
  const v = stageModule(vertex),
    f = stageModule(fragment),
    names = new Set(instances.map((p) => p.name));
  for (const m of [v, f])
    m.resources = m.resources.filter((r) => !names.has(r.name));
  const add = (m, r) => {
    if (!m.resources.some((x) => x.name === r.name)) m.resources.push(r);
  };
  for (const p of shared) {
    add(v, uniform(p.name, p.type));
    add(f, uniform(p.name, p.type));
  }
  v.structs = [
    {
      name: "Fixed2D",
      members: [
        { name: "alpha_Facing_Location", type: "VEC4" },
        { name: "scale", type: "VEC2" },
        { name: "colorBits", type: "UVEC2" },
      ],
    },
  ];
  v.resources.push(
    { storage: "in", location: 0, name: "a_position", type: "VEC2" },
    uniform("u_viewProjection", "MAT4"),
    {
      storage: "buffer",
      name: "BUtilInstanceData_Fixed2D",
      layout: "std430",
      binding: 5,
      readonly: true,
      members: [{ name: "wf_transforms", type: "Fixed2D", array: true }],
    },
    {
      storage: "buffer",
      name: "WorkflowParameters",
      layout: "std430",
      binding: 0,
      readonly: true,
      members: [{ name: "wf_parameters", type: "UVEC4", array: true }],
    },
    {
      storage: "const",
      name: "WF_PARAMETER_SLOTS",
      type: "INT",
      value: c("INT", slots),
    },
    uniform("u_instanceOffset", "INT"),
    { storage: "out", name: "v_uv", type: "VEC2" },
  );
  f.resources.push(
    { storage: "in", name: "v_uv", type: "VEC2" },
    { storage: "out", name: "fragColor", type: "VEC4" },
    uniform("u_viewportAlpha", "FLOAT"),
  );
  const vp = [s.assign(s.symbol("VEC2", "v_uv"), vertexUv())],
    fp = [];
  for (const p of instances) {
    const varying = "wf_v_" + p.name,
      wire = p.type === "BOOL" ? "INT" : p.type;
    v.resources.push({ storage: "out", flat: true, name: varying, type: wire });
    f.resources.push({ storage: "in", flat: true, name: varying, type: wire });
    const index = s.binary(
      "INT",
      "+",
      s.binary(
        "INT",
        "*",
        s.symbol("INT", "gl_InstanceID"),
        s.symbol("INT", "WF_PARAMETER_SLOTS"),
      ),
      c("INT", p.slot),
    );
    const bits = s.index("UVEC4", s.symbol("UVEC4", "wf_parameters"), index),
      x = s.member("UINT", bits, "x");
    const value =
      p.type === "BOOL"
        ? s.binary("BOOL", "!=", x, c("UINT", 0))
        : p.type === "UINT"
          ? x
          : p.type === "INT"
            ? s.call("INT", "int", x)
            : p.type === "FLOAT"
              ? s.call("FLOAT", "uintBitsToFloat", x)
              : s.member(
                  p.type,
                  s.call("VEC4", "uintBitsToFloat", bits),
                  "xyzw".slice(0, Number(p.type.at(-1))),
                );
    vp.push(
      s.declare(p.name, p.type, value),
      s.assign(
        s.symbol(wire, varying),
        p.type === "BOOL"
          ? s.select("INT", s.symbol("BOOL", p.name), c("INT", 1), c("INT", 0))
          : s.symbol(p.type, p.name),
      ),
    );
    fp.push(
      s.declare(
        p.name,
        p.type,
        p.type === "BOOL"
          ? s.binary("BOOL", "!=", s.symbol("INT", varying), c("INT", 0))
          : s.symbol(wire, varying),
      ),
    );
  }
  const overrides = geometry.filter((p) => /^v[0-3][xy]$/.test(p.geometryKey)),
    bindings = Object.fromEntries(
      geometry.map((p) => [p.geometryKey, s.symbol("FLOAT", p.name)]),
    );
  if (overrides.length) {
    vp.push(
      s.declare("wf_geometry_position", "VEC2", s.symbol("VEC2", "a_position")),
    );
    for (const p of overrides)
      vp.push({
        kind: "if",
        condition: s.binary(
          "BOOL",
          "==",
          s.symbol("INT", "gl_VertexID"),
          c("INT", Number(p.geometryKey[1])),
        ),
        yes: [
          s.assign(
            s.member(
              "FLOAT",
              s.symbol("VEC2", "wf_geometry_position"),
              p.geometryKey[2],
            ),
            s.symbol("FLOAT", p.name),
          ),
        ],
        no: [],
      });
  }
  const graphPosition = overrides.length
    ? replaceSymbols(vertex, {
        a_position: s.symbol("VEC2", "wf_geometry_position"),
      })
    : vertex;
  v.functions.unshift(rotateFunction());
  const inst = s.symbol("Fixed2D", "wf_instance_transform"),
    packed = s.member("VEC4", inst, "alpha_Facing_Location"),
    world = s.binary(
      "VEC2",
      "+",
      s.binary(
        "VEC2",
        "*",
        s.call(
          "MAT2",
          "wf_rotate",
          s.call("FLOAT", "radians", s.member("FLOAT", packed, "y")),
        ),
        s.binary(
          "VEC2",
          "*",
          s.symbol("VEC2", "wf_local"),
          s.member("VEC2", inst, "scale"),
        ),
      ),
      s.member("VEC2", packed, "zw"),
    );
  v.body = [
    ...vp,
    ...graphPosition.body,
    s.assign(s.symbol("VEC2", "v_uv"), graphPosition.outputs.uv),
    s.declare(
      "wf_local",
      "VEC2",
      transformPosition(graphPosition.outputs.position, t, bindings),
    ),
    s.declare(
      "wf_instance_transform",
      "Fixed2D",
      s.index(
        "Fixed2D",
        s.symbol("Fixed2D", "wf_transforms"),
        s.binary(
          "INT",
          "+",
          s.symbol("INT", "u_instanceOffset"),
          s.symbol("INT", "gl_InstanceID"),
        ),
      ),
    ),
    s.declare("wf_world", "VEC2", world),
    s.assign(
      s.symbol("VEC4", "gl_Position"),
      s.binary(
        "VEC4",
        "*",
        s.symbol("MAT4", "u_viewProjection"),
        s.call(
          "VEC4",
          "vec4",
          s.symbol("VEC2", "wf_world"),
          c("FLOAT", 0),
          c("FLOAT", 1),
        ),
      ),
    ),
  ];
  const color = s.symbol("VEC4", "fragColor"),
    alpha = s.member("FLOAT", color, "a");
  f.body = [
    ...fp,
    ...f.body,
    s.assign(color, fragment.outputs.color),
    s.assign(
      alpha,
      s.binary("FLOAT", "*", alpha, s.symbol("FLOAT", "u_viewportAlpha")),
    ),
  ];
  return { vertex: v, fragment: f, layout, transform: t };
}

export async function buildRuntimeSources({
  config,
  transform,
  inputs,
  textures,
  vertex,
  fragment,
  backend,
}) {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.className) ||
    !/^data\/[A-Za-z0-9_/-]+$/.test(config.shaderDir) ||
    config.shaderDir.split("/").includes("..")
  )
    throw Error("类名或 shader 路径无效");
  textures = textures.map((p) => ({
    ...p,
    id: p.id ?? p.name.replace(/^u_/, ""),
    type: "SAMPLER2D",
    scope: "shared",
  }));
  const modules = buildShaderModules({
    transform,
    inputs,
    textures,
    vertex,
    fragment,
  });
  const [v, f] = await Promise.all([
    backend.emit({ module: modules.vertex, target: "glsl-430" }),
    backend.emit({ module: modules.fragment, target: "glsl-430" }),
  ]);
  for (const result of [v, f])
    if (!result.ok)
      throw Error(
        result.diagnostics
          .map(
            (d) =>
              (d.origin?.nodeId ? "节点 " + d.origin.nodeId + "：" : "") +
              d.message,
          )
          .join("\n"),
      );
  const C = config.className;
  return {
    java: {
      filename: `src/data/scripts/${C}.java`,
      content: materialJava({
        config,
        transform: modules.transform,
        layout: modules.layout,
        textures,
      }),
    },
    vertex: { filename: `${config.shaderDir}/${C}.vert`, content: v.source },
    fragment: { filename: `${config.shaderDir}/${C}.frag`, content: f.source },
  };
}

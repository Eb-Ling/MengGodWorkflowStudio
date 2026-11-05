import { shader as s, constant as c, sourceName } from "./index.mjs";
export const symbol = s.symbol,
  call = s.call,
  binary = s.binary;
export const uniform = (name, type) => ({ storage: "uniform", name, type });
/** 声明资源与通用纹理宽高比函数，是结构化 IR 工厂，不生成目标语言源码。 */
export function stageModule(lowered, stage = lowered.stage) {
  const m = s.module(stage);
  m.functions = [...lowered.functions];
  m.body = [...lowered.body];
  m.resources.push(
    uniform("u_time", "FLOAT"),
    ...lowered.inputs.map((p) => uniform(p.name, p.type)),
  );
  for (const tex of lowered.textures) {
    const aspect = "u_textureAspect_" + sourceName(tex.name),
      ratio = s.symbol("FLOAT", "ratio"),
      scale = s.symbol("VEC2", "scale"),
      uv = s.symbol("VEC2", "textureUv");
    m.resources.push(uniform(tex.name, "SAMPLER2D"), uniform(aspect, "VEC2"));
    m.functions.unshift({
      name: "sampleTexture_" + sourceName(tex.name),
      returns: "VEC4",
      parameters: [
        { name: "source", type: "SAMPLER2D", qualifier: "in" },
        { name: "uv", type: "VEC2", qualifier: "in" },
      ],
      body: [
        s.declare(
          "ratio",
          "FLOAT",
          s.call(
            "FLOAT",
            "max",
            s.binary(
              "FLOAT",
              "/",
              s.member("FLOAT", s.symbol("VEC2", aspect), "x"),
              s.call(
                "FLOAT",
                "max",
                s.member("FLOAT", s.symbol("VEC2", aspect), "y"),
                c("FLOAT", 1),
              ),
            ),
            c("FLOAT", 0.0001),
          ),
        ),
        s.declare(
          "scale",
          "VEC2",
          s.select(
            "VEC2",
            s.binary("BOOL", ">=", ratio, c("FLOAT", 1)),
            s.call("VEC2", "vec2", c("FLOAT", 1), ratio),
            s.call(
              "VEC2",
              "vec2",
              s.binary("FLOAT", "/", c("FLOAT", 1), ratio),
              c("FLOAT", 1),
            ),
          ),
        ),
        s.declare(
          "textureUv",
          "VEC2",
          s.binary(
            "VEC2",
            "+",
            s.binary(
              "VEC2",
              "*",
              s.binary("VEC2", "-", s.symbol("VEC2", "uv"), c("VEC2", 0.5)),
              scale,
            ),
            c("VEC2", 0.5),
          ),
        ),
        {
          kind: "if",
          condition: s.binary(
            "BOOL",
            "||",
            s.call(
              "BOOL",
              "any",
              s.call("BVEC2", "lessThan", uv, c("VEC2", 0)),
            ),
            s.call(
              "BOOL",
              "any",
              s.call("BVEC2", "greaterThan", uv, c("VEC2", 1)),
            ),
          ),
          yes: [{ kind: "return", value: c("VEC4", 0) }],
          no: [],
        },
        {
          kind: "return",
          value: s.call("VEC4", "texture", s.symbol("SAMPLER2D", "source"), uv),
        },
      ],
    });
  }
  return m;
}
export function colorExpression(value) {
  const t = value.type;
  if (t === "VEC4") return value;
  if (t === "SAMPLER2D")
    return s.call(
      "VEC4",
      "sampleTexture_" + sourceName(value.name),
      value,
      s.symbol("VEC2", "v_uv"),
    );
  if (t === "VEC3") return s.call("VEC4", "vec4", value, c("FLOAT", 1));
  if (t === "VEC2")
    return s.call(
      "VEC4",
      "vec4",
      s.binary(
        "VEC2",
        "+",
        s.binary("VEC2", "*", value, c("FLOAT", 0.5)),
        c("VEC2", 0.5),
      ),
      c("FLOAT", 0.5),
      c("FLOAT", 1),
    );
  if (t === "BOOL" || /^BVEC/.test(t))
    value = s.select(
      "FLOAT",
      t === "BOOL" ? value : s.call("BOOL", "any", value),
      c("FLOAT", 1),
      c("FLOAT", 0),
    );
  return s.call("VEC4", "vec4", s.call("VEC3", "vec3", value), c("FLOAT", 1));
}
export function rotateFunction() {
  const cos = s.symbol("FLOAT", "c"),
    sin = s.symbol("FLOAT", "s");
  return {
    name: "wf_rotate",
    returns: "MAT2",
    parameters: [{ name: "a", type: "FLOAT", qualifier: "in" }],
    body: [
      s.declare("c", "FLOAT", s.call("FLOAT", "cos", s.symbol("FLOAT", "a"))),
      s.declare("s", "FLOAT", s.call("FLOAT", "sin", s.symbol("FLOAT", "a"))),
      {
        kind: "return",
        value: s.call(
          "MAT2",
          "mat2",
          cos,
          sin,
          s.unary("FLOAT", "-", sin),
          cos,
        ),
      },
    ],
  };
}
export function vertexUv() {
  const id = s.symbol("INT", "gl_VertexID");
  return s.call(
    "VEC2",
    "vec2",
    s.select(
      "FLOAT",
      s.binary(
        "BOOL",
        "!=",
        s.binary("INT", "&", id, c("INT", 1)),
        c("INT", 0),
      ),
      c("FLOAT", 1),
      c("FLOAT", 0),
    ),
    s.select(
      "FLOAT",
      s.binary("BOOL", ">=", id, c("INT", 2)),
      c("FLOAT", 1),
      c("FLOAT", 0),
    ),
  );
}
export function transformPosition(position, t, bindings = {}) {
  const ref = (key) => bindings[key] || c("FLOAT", t[key]);
  const rotation = bindings.rotation
    ? s.call("FLOAT", "radians", bindings.rotation)
    : c("FLOAT", (t.rotation * Math.PI) / 180);
  return s.binary(
    "VEC2",
    "+",
    s.binary(
      "VEC2",
      "*",
      s.call("MAT2", "wf_rotate", rotation),
      s.binary(
        "VEC2",
        "*",
        position,
        s.call("VEC2", "vec2", ref("sx"), ref("sy")),
      ),
    ),
    s.call("VEC2", "vec2", ref("tx"), ref("ty")),
  );
}

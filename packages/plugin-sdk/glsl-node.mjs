import { EXPRESSION_TYPES } from "./ir.mjs";
const targets = ["glsl-es-300", "glsl-430"];
const key = (value) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/^SAMPLERCUBE$/, "SAMPLER_CUBE");
/** 声明函数即生成同一份端口和目标契约。目录插件也能直接提交此函数返回的 JSON。 */
export function defineGlslNode({
  typeId,
  title,
  category,
  targets: supported,
  glsl,
  ...options
}) {
  if (
    !Array.isArray(supported) ||
    !supported.length ||
    supported.some((t) => !targets.includes(t))
  )
    throw Error("GLSL 节点必须明确选择支持的编译目标");
  const identifier = /^[A-Za-z_]\w*$/;
  if (
    !identifier.test(glsl?.name ?? "") ||
    !Array.isArray(glsl.parameters) ||
    !glsl.parameters.length
  )
    throw Error("GLSL 函数需要有效的名称和参数表");
  if (
    typeof glsl.code !== "string" ||
    !glsl.code.trim() ||
    (glsl.helpers !== undefined && typeof glsl.helpers !== "string")
  )
    throw Error("GLSL 函数体不能为空，辅助源码必须是文本");
  const names = new Set();
  const parameters = glsl.parameters.map((p) => {
    const type = key(p.type);
    if (
      typeof p.name !== "string" ||
      !identifier.test(p.name) ||
      names.has(p.name) ||
      !EXPRESSION_TYPES.includes(type) ||
      !["in", "out", "inout"].includes(p.qualifier)
    )
      throw Error("GLSL 参数名称、类型或方向无效：" + p.name);
    names.add(p.name);
    return {
      ...(p.id ? { id: String(p.id) } : {}),
      name: p.name,
      type,
      qualifier: p.qualifier,
    };
  });
  if (parameters.every((p) => p.qualifier === "in"))
    throw Error("GLSL 节点至少需要一个 out 或 inout 输出");
  const ports = (excluded) =>
    parameters
      .filter((p) => p.qualifier !== excluded)
      .map(({ name, type }) => ({ name, type }));
  return {
    ...options,
    typeId,
    title,
    category: category || "GLSL",
    properties: options.properties ?? {},
    targets: [...new Set(supported)],
    inputs: ports("out"),
    outputs: ports("in"),
    glsl: {
      name: glsl.name,
      parameters,
      code: glsl.code,
      helpers: glsl.helpers || "",
    },
  };
}

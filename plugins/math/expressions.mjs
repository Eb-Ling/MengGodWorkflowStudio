import { ir } from "../../packages/plugin-sdk/ir.mjs";

/** 数学/向量算法只产生 IR，目标语法和局部变量命名由后端负责。 */
export function compileMath({ node, socket, outputType: type, inputs }) {
  const id = node.typeId.slice("studio.math.".length);
  const input = (name) => ir.input(inputs[name], name);
  const number = (value) => ir.literal("FLOAT", value);
  const call = (name, ...args) => ir.call(type, name, args);
  const binary = (op, a, b) => ir.binary(type, op, a, b);
  const scalarLike = (value) =>
    type === "FLOAT" ? number(value) : call(type.toLowerCase(), number(value));
  if (id === "constant") {
    const raw = String(node.properties.value ?? "0")
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
    const scalar =
      type === "BOOL" || type.startsWith("BVEC")
        ? "BOOL"
        : type === "UINT" || type.startsWith("UVEC")
          ? "UINT"
          : type === "INT" || type.startsWith("IVEC")
            ? "INT"
            : "FLOAT";
    const part = (text) => {
      if (scalar === "BOOL") {
        if (!["true", "false"].includes(text))
          throw new Error("布尔常量必须为 true 或 false");
        return ir.literal(scalar, text === "true");
      }
      const value = Number(text);
      if (
        !Number.isFinite(value) ||
        (scalar !== "FLOAT" && !Number.isInteger(value)) ||
        (scalar === "UINT" && value < 0)
      )
        throw new Error("常量数值或类型无效");
      return ir.literal(scalar, value);
    };
    const count = Number(type.at(-1)) || 1;
    if (count === 1) {
      if (raw.length !== 1) throw new Error("标量常量必须只有一个分量");
      return part(raw[0]);
    }
    const size = type.startsWith("MAT") ? count * count : count;
    if (raw.length !== 1 && raw.length !== size)
      throw new Error("常量分量数不匹配");
    return call(type.toLowerCase(), ...raw.map(part));
  }
  const operations = { add: "+", subtract: "-", multiply: "*" };
  if (operations[id]) return binary(operations[id], input("a"), input("b"));
  if (id === "divide")
    return binary(
      "/",
      input("a"),
      call("max", call("abs", input("b")), scalarLike(0.0001)),
    );
  if (
    [
      "sin",
      "cos",
      "tan",
      "asin",
      "acos",
      "exp",
      "log",
      "sqrt",
      "sign",
      "ceil",
      "floor",
      "fract",
      "abs",
    ].includes(id)
  )
    return call(id, input("x"));
  if (["min", "max"].includes(id)) return call(id, input("a"), input("b"));
  if (id === "mod") return call("mod", input("x"), input("y"));
  if (id === "step") return call("step", input("edge"), input("x"));
  if (id === "atan") return call("atan", input("y"), input("x"));
  if (id === "pow") return call("pow", input("base"), input("exponent"));
  if (id === "smoothstep")
    return call("smoothstep", input("edge0"), input("edge1"), input("x"));
  if (id === "clamp")
    return call("clamp", input("value"), input("min"), input("max"));
  if (id === "mix") return call("mix", input("a"), input("b"), input("t"));
  if (id === "radians" || id === "degrees")
    return call(id, input(id === "radians" ? "degrees" : "radians"));
  if (id === "remap")
    return binary(
      "+",
      input("outMin"),
      binary(
        "*",
        binary(
          "/",
          binary("-", input("value"), input("inMin")),
          binary("-", input("inMax"), input("inMin")),
        ),
        binary("-", input("outMax"), input("outMin")),
      ),
    );
  if (id === "vector.center")
    return binary("-", input("uv"), call("vec2", number(0.5)));
  if (id === "vector.split") return ir.swizzle(type, socket, input("value"));
  if (id === "vector.combine")
    return call(
      type.toLowerCase(),
      ...["x", "y", "z", "w"].slice(0, Number(type.at(-1))).map(input),
    );
  if (id === "vector.scale") return binary("*", input("value"), input("scale"));
  if (["vector.length", "vector.normalize"].includes(id))
    return call(id.split(".")[1], input("value"));
  if (["vector.distance2", "vector.dot", "vector.cross"].includes(id))
    return call(
      id === "vector.distance2" ? "distance" : id.split(".")[1],
      input("a"),
      input("b"),
    );
  if (id === "vector.reflect")
    return call("reflect", input("incident"), input("normal"));
  if (id === "vector.rotate2d") {
    const x = ir.swizzle("FLOAT", "x", input("value")),
      y = ir.swizzle("FLOAT", "y", input("value"));
    const c = ir.call("FLOAT", "cos", [input("angle")]),
      s = ir.call("FLOAT", "sin", [input("angle")]);
    const mul = (a, b) => ir.binary("FLOAT", "*", a, b);
    // GLSL 列主序 rot2(c,-s,s,c)，沿用节点的顺时针方向。
    return call(
      "vec2",
      ir.binary("FLOAT", "+", mul(c, x), mul(s, y)),
      ir.binary("FLOAT", "-", mul(c, y), mul(s, x)),
    );
  }
  throw new Error("未声明的 Math 编译规则：" + node.typeId);
}

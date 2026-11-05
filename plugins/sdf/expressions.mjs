import { ir } from "../../packages/plugin-sdk/ir.mjs";

/** SDF、淡出和曲线均为纯 IR 算法，不调用 Math/Noise 插件。 */
export function compileSdf({ node, inputs }) {
  const input = (name) => ir.input(inputs[name], name),
    f = (n) => ir.literal("FLOAT", n);
  const bin = (op, a, b) =>
    ir.binary(a.type === "FLOAT" ? b.type : a.type, op, a, b);
  const add = (a, b) => bin("+", a, b),
    sub = (a, b) => bin("-", a, b),
    mul = (a, b) => bin("*", a, b),
    div = (a, b) => bin("/", a, b);
  const fn = (name, ...args) => ir.call(args[0].type, name, args);
  const vec = (n) => ir.call("VEC2", "vec2", [f(n)]),
    length = (v) => ir.call("FLOAT", "length", [v]);
  const dot = (a, b) => ir.call("FLOAT", "dot", [a, b]),
    component = (v, c) => ir.swizzle("FLOAT", c, v);
  const taper = (t) => {
    const v = fn("clamp", t, f(0), f(1));
    return mul(
      fn("smoothstep", f(0), f(0.08), v),
      sub(f(1), fn("smoothstep", f(0.15), f(1), v)),
    );
  };
  const id = node.typeId.slice("studio.sdf.".length);
  if (id === "circle") return sub(length(input("point")), input("radius"));
  if (id === "box") {
    const q = sub(fn("abs", input("point")), input("size"));
    return add(
      length(fn("max", q, vec(0))),
      fn("min", fn("max", component(q, "x"), component(q, "y")), f(0)),
    );
  }
  if (id === "segment") {
    const pa = sub(input("point"), input("a")),
      ba = sub(input("b"), input("a"));
    const h = fn("clamp", dot(ba, ba), f(0.0001), f(1e20));
    return length(
      sub(pa, mul(ba, fn("clamp", div(dot(pa, ba), h), f(0), f(1)))),
    );
  }
  if (id === "lance") {
    const p = input("point"),
      base = input("baseX"),
      tip = input("tipX");
    const t = fn(
      "clamp",
      div(sub(component(p, "x"), base), fn("max", sub(tip, base), f(0.0001))),
      f(0),
      f(1),
    );
    return sub(fn("abs", component(p, "y")), mul(input("maxR"), taper(t)));
  }
  if (id === "shape.lanceTaper") return taper(input("t"));
  if (id === "shape.xFade") {
    const x = component(input("point"), "x"),
      a = input("baseX"),
      b = input("tipX");
    return mul(
      fn("smoothstep", sub(a, f(8)), add(a, f(8)), x),
      fn("smoothstep", add(b, f(8)), sub(b, f(8)), x),
    );
  }
  if (id === "shape.fadeVertical" || id === "shape.fadeHorizontal")
    return fn("smoothstep", input("edge0"), input("edge1"), input("value"));
  if (id === "curve.cubicBezier" || id === "curve.quarticBezier") {
    const t = input("t"),
      u = sub(f(1), t),
      power = (a, n) => Array.from({ length: n }, () => a).reduce(mul);
    const n = id === "curve.cubicBezier" ? 3 : 4,
      coefficients = n === 3 ? [1, 3, 3, 1] : [1, 4, 6, 4, 1];
    const terms = coefficients.map((c, i) => {
      let scale = f(c);
      if (n - i) scale = mul(scale, power(u, n - i));
      if (i) scale = mul(scale, power(t, i));
      return mul(scale, input("p" + i));
    });
    const result = terms.reduce(add);
    return n === 3 ? result : component(result, "y");
  }
  throw new Error("未声明的 SDF 编译规则：" + node.typeId);
}

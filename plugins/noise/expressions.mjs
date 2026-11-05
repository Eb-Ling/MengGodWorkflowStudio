import { ir } from "../../packages/plugin-sdk/ir.mjs";

/** Noise 算法生成有界类型化 IR，动态 FBM 最多展开八层，不注入 GLSL 源码。 */
export function compileNoise(typeId, context = {}) {
  const bindings = [];
  const literal = (n) => ir.literal("FLOAT", n);
  const expr = (x) => (typeof x === "number" ? literal(x) : x);
  const bind = (value) => {
    const name = "n" + bindings.length;
    bindings.push({ name, value });
    return ir.ref(value.type, name);
  };
  const op = (symbol, a, b) => {
    a = expr(a);
    b = expr(b);
    return bind(ir.binary(a.type === "FLOAT" ? b.type : a.type, symbol, a, b));
  };
  const add = (a, b) => op("+", a, b),
    sub = (a, b) => op("-", a, b),
    mul = (a, b) => op("*", a, b),
    div = (a, b) => op("/", a, b);
  const vec = (size, ...args) =>
    bind(ir.call("VEC" + size, "vec" + size, args.map(expr)));
  const sw = (v, fields) =>
    bind(
      ir.swizzle(
        fields.length === 1 ? "FLOAT" : "VEC" + fields.length,
        fields,
        v,
      ),
    );
  const unary = (name, v) => bind(ir.call(v.type, name, [v]));
  const floor = (v) => unary("floor", v),
    fract = (v) => unary("fract", v),
    abs = (v) => unary("abs", v);
  const dot = (a, b) => bind(ir.call("FLOAT", "dot", [a, b]));
  const pair = (name, a, b) => {
    a = expr(a);
    b = expr(b);
    const type = a.type === "FLOAT" ? b.type : a.type;
    if (a.type !== type) a = vec(Number(type.at(-1)), a);
    if (b.type !== type) b = vec(Number(type.at(-1)), b);
    return bind(ir.call(type, name, [a, b]));
  };
  const mix = (a, b, t) => bind(ir.call(a.type, "mix", [a, b, t]));

  function hash(p) {
    return fract(mul(unary("sin", dot(p, vec(2, 127.1, 311.7))), 43758.5453));
  }
  function hash2(p) {
    return vec(2, hash(p), hash(add(p, 19.19)));
  }
  function valueNoise(p) {
    const i = floor(p),
      original = fract(p),
      f = mul(mul(original, original), sub(3, mul(2, original)));
    return mix(
      mix(hash(i), hash(add(i, vec(2, 1, 0))), sw(f, "x")),
      mix(hash(add(i, vec(2, 0, 1))), hash(add(i, vec(2, 1))), sw(f, "x")),
      sw(f, "y"),
    );
  }
  // 三角网格内三个角点的梯度贡献。整数排列选取八个单位方向。
  function simplex2(p) {
    const skew = (Math.sqrt(3) - 1) / 2,
      unskew = (3 - Math.sqrt(3)) / 6;
    const cell = floor(add(p, dot(p, vec(2, skew)))),
      local = add(sub(p, cell), dot(cell, vec(2, unskew))),
      right = pair("step", sw(local, "y"), sw(local, "x")),
      middle = vec(2, right, sub(1, right));
    const contribution = (offset, displacement) => {
      const corner = pair("mod", add(cell, offset), 289),
        key = permute(add(sw(corner, "x"), permute(sw(corner, "y")))),
        angle = mul(pair("mod", key, 8), Math.PI / 4),
        gradient = vec(2, unary("cos", angle), unary("sin", angle)),
        falloff = pair("max", sub(0.5, dot(displacement, displacement)), 0),
        squared = mul(falloff, falloff);
      return mul(mul(squared, squared), dot(gradient, displacement));
    };
    return mul(70, add(add(
      contribution(vec(2, 0), local),
      contribution(middle, add(sub(local, middle), unskew)),
    ), contribution(vec(2, 1), add(sub(local, 1), 2 * unskew))));
  }
  function perlin(p) {
    const i = floor(p),
      f = fract(p),
      u = mul(mul(mul(f, f), f), add(mul(f, sub(mul(f, 6), 15)), 10));
    const gradient = (offset) =>
      unary("normalize", sub(mul(hash2(add(i, offset)), 2), 1));
    const a = dot(gradient(vec(2, 0)), f),
      b = dot(gradient(vec(2, 1, 0)), sub(f, vec(2, 1, 0)));
    const c = dot(gradient(vec(2, 0, 1)), sub(f, vec(2, 0, 1))),
      d = dot(gradient(vec(2, 1)), sub(f, vec(2, 1)));
    return add(
      mul(mix(mix(a, b, sw(u, "x")), mix(c, d, sw(u, "x")), sw(u, "y")), 0.5),
      0.5,
    );
  }
  function fbm(p, algorithm, scale = 1, octaves = 5) {
    let result = literal(0),
      amplitude = 0.5;
    p = scale === 1 ? p : mul(p, scale);
    const dynamic = typeof octaves !== "number",
      count = dynamic ? pair("min", pair("max", floor(octaves), 0), 8) : octaves;
    for (let i = 0; i < (dynamic ? 8 : count); i++) {
      const weight = dynamic ? mul(amplitude, pair("step", i + 1, count)) : amplitude;
      result = add(
        result,
        mul(weight, algorithm(p)),
      );
      p = mul(p, 2);
      amplitude *= 0.5;
    }
    return result;
  }
  function worley(p) {
    const i = floor(p),
      f = fract(p);
    let d = literal(1);
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++) {
        const n = vec(2, x, y),
          q = sub(add(n, hash2(add(i, n))), f);
        d = pair("min", d, bind(ir.call("FLOAT", "length", [q])));
      }
    return d;
  }
  // 3D Simplex 的排列、梯度归一化和六层湍流。
  const permute = (x) => pair("mod", mul(add(mul(x, 34), 1), x), 289);
  function simplex3(v) {
    let i = floor(add(v, dot(v, vec(3, div(1, 3)))));
    const x0 = add(sub(v, i), dot(i, vec(3, div(1, 6))));
    const g = pair("step", sw(x0, "yzx"), x0),
      l = sub(1, g),
      i1 = pair("min", g, sw(l, "zxy")),
      i2 = pair("max", g, sw(l, "zxy"));
    const x1 = add(sub(x0, i1), vec(3, div(1, 6))),
      x2 = add(sub(x0, i2), vec(3, div(1, 3))),
      x3 = sub(x0, vec(3, 0.5));
    i = pair("mod", i, 289);
    const corner = (axis) => vec(4, 0, sw(i1, axis), sw(i2, axis), 1);
    const p = permute(
      add(
        add(
          permute(
            add(
              add(permute(add(sw(i, "z"), corner("z"))), sw(i, "y")),
              corner("y"),
            ),
          ),
          sw(i, "x"),
        ),
        corner("x"),
      ),
    );
    const ns = sub(mul(0.142857142857, vec(3, 2, 0.5, 1)), vec(3, 0, 1, 0));
    const j = sub(p, mul(49, floor(mul(mul(p, sw(ns, "z")), sw(ns, "z"))))),
      xx = floor(mul(j, sw(ns, "z"))),
      yy = floor(sub(j, mul(7, xx)));
    const x = add(mul(xx, sw(ns, "x")), sw(ns, "yyyy")),
      y = add(mul(yy, sw(ns, "x")), sw(ns, "yyyy")),
      h = sub(sub(1, abs(x)), abs(y));
    const b0 = vec(4, sw(x, "xy"), sw(y, "xy")),
      b1 = vec(4, sw(x, "zw"), sw(y, "zw"));
    const s0 = add(mul(floor(b0), 2), 1),
      s1 = add(mul(floor(b1), 2), 1),
      sh = mul(-1, pair("step", h, vec(4, 0)));
    const a0 = add(sw(b0, "xzyw"), mul(sw(s0, "xzyw"), sw(sh, "xxyy"))),
      a1 = add(sw(b1, "xzyw"), mul(sw(s1, "xzyw"), sw(sh, "zzww")));
    let p0 = vec(3, sw(a0, "xy"), sw(h, "x")),
      p1 = vec(3, sw(a0, "zw"), sw(h, "y")),
      p2 = vec(3, sw(a1, "xy"), sw(h, "z")),
      p3 = vec(3, sw(a1, "zw"), sw(h, "w"));
    const norm = div(
      1,
      vec(4, dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)),
    );
    p0 = mul(p0, sw(norm, "x"));
    p1 = mul(p1, sw(norm, "y"));
    p2 = mul(p2, sw(norm, "z"));
    p3 = mul(p3, sw(norm, "w"));
    let m = pair(
      "max",
      sub(0.6, vec(4, dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3))),
      0,
    );
    m = mul(m, m);
    return mul(
      42,
      dot(
        mul(m, m),
        vec(4, dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)),
      ),
    );
  }
  function turbulence3(p) {
    let result = literal(0),
      amplitude = 1,
      frequency = 1;
    for (let i = 0; i < 6; i++) {
      result = add(result, mul(amplitude, abs(simplex3(mul(p, frequency)))));
      amplitude *= 0.5;
      frequency *= 2;
    }
    return mul(result, 0.5);
  }
  const uv = ir.input("VEC2", "uv");
  function configurableFbm() {
    const properties = context.node?.properties || {};
    const number = (key, fallback) => {
      const raw = properties[key] ?? fallback;
      if (!["number", "string"].includes(typeof raw) || String(raw).trim() === "" || !Number.isFinite(Number(raw)))
        throw Error(`FBM ${key} 必须是有限数`);
      return Number(raw);
    };
    const scale = number("scale", 4);
    if (Math.abs(scale) > 10000) throw Error("FBM scale 必须在 -10000 至 10000 之间");
    const octaves = context.connectedInputs?.includes("octaves")
      ? ir.input("FLOAT", "octaves")
      : Math.max(0, Math.min(8, Math.floor(number("octaves", 5))));
    return fbm(uv, valueNoise, scale, octaves);
  }
  const algorithms = {
    "studio.noise.value": () => valueNoise(uv),
    "studio.noise.fbm": configurableFbm,
    "studio.noise.simplex": () => simplex2(uv),
    "studio.noise.perlin": () => perlin(uv),
    "studio.noise.fbmSimplex": () => fbm(uv, simplex2),
    "studio.noise.worley": () => worley(uv),
    "studio.noise.fbmWorley": () => fbm(uv, worley, 6),
    "studio.noise.turbulence": () => abs(sub(mul(fbm(uv, valueNoise), 2), 1)),
    "studio.noise.turbulize": () => abs(ir.input("FLOAT", "noise")),
    "studio.noise.turbulence3": () =>
      turbulence3(
        vec(3, ...["x", "y", "z"].map((name) => ir.input("FLOAT", name))),
      ),
  };
  if (!algorithms[typeId]) throw new Error("未知 Noise 节点：" + typeId);
  const result = algorithms[typeId]();
  return ir.block(bindings, result);
}

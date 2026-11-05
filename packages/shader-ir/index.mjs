import { copyJson } from "../plugin-sdk/schema.mjs";
import { EXPRESSION_TYPES, validateExpression } from "../plugin-sdk/ir.mjs";

/** 跨语言协议只包含 JSON，构造器是调用便利函数，不会随编译请求跨过边界。 */
export const shader = Object.freeze({
  literal: (type, value) => ({ kind: "literal", type, value }),
  symbol: (type, name) => ({ kind: "symbol", type, name }),
  call: (type, name, ...args) => ({ kind: "call", type, name, args }),
  binary: (type, operator, left, right) => ({
    kind: "binary",
    type,
    operator,
    left,
    right,
  }),
  unary: (type, operator, value) => ({ kind: "unary", type, operator, value }),
  select: (type, condition, yes, no) => ({
    kind: "select",
    type,
    condition,
    yes,
    no,
  }),
  member: (type, value, field) => ({ kind: "member", type, value, field }),
  index: (type, value, index) => ({ kind: "index", type, value, index }),
  declare: (name, type, value, origin) => ({
    kind: "declare",
    name,
    type,
    value,
    ...(origin ? { origin } : {}),
  }),
  assign: (to, value, origin) => ({
    kind: "assign",
    to,
    value,
    ...(origin ? { origin } : {}),
  }),
  module: (stage) => ({
    schemaVersion: 1,
    stage,
    structs: [],
    resources: [],
    functions: [],
    body: [],
  }),
});
export const scalarOf = (t) =>
  ({ B: "BOOL", I: "INT", U: "UINT", "": "FLOAT" })[
    /^([BIU]?)VEC/.exec(t)?.[1] ?? ""
  ];
export { sourceName } from "../plugin-sdk/ir.mjs";
export function constant(type, value = 0) {
  const scalar = ["BOOL", "INT", "UINT", "FLOAT"].includes(type);
  const component = (t) => {
    if (t === "BOOL")
      return shader.literal(
        t,
        value === true || String(value).toLowerCase() === "true",
      );
    const n = Number(value);
    if (!Number.isFinite(n)) throw Error("常量必须为有限数");
    return shader.literal(t, t === "FLOAT" ? n : Math.trunc(n));
  };
  if (scalar) return component(type);
  const items = Array.isArray(value)
      ? value
      : String(value)
          .split(/[\s,]+/)
          .filter(Boolean),
    base = scalarOf(type);
  return shader.call(
    type,
    type.toLowerCase(),
    ...items.map((v) => constant(base, v)),
  );
}
export function replaceSymbols(value, bindings) {
  if (Array.isArray(value))
    return value.map((v) => replaceSymbols(v, bindings));
  if (value && typeof value === "object") {
    if (value.kind === "symbol" && Object.hasOwn(bindings, value.name))
      return copyJson(bindings[value.name]);
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, replaceSymbols(v, bindings)]),
    );
  }
  return value;
}

const builtinTypes = new Set([...EXPRESSION_TYPES, "VOID"]);
const identifier = (n) =>
  typeof n === "string" &&
  /^[A-Za-z_]\w*$/.test(n) &&
  ![
    "void",
    "uniform",
    "in",
    "out",
    "if",
    "for",
    "return",
    "layout",
    "struct",
    "buffer",
    "const",
  ].includes(n);
const dummy = (t) => ({ kind: "input", type: t, name: "value" });
/** 完整模块边界验证：符号、类型、赋值、函数、作用域、资源及目标限制。 */
export function validateModule(input, target) {
  const m = copyJson(input),
    structs = new Map(),
    functions = new Map(),
    globals = new Map();
  let origin = null,
    budget = 0;
  const fail = (message, code = "INVALID_SHADER_IR") => {
    const e = Error(message);
    e.code = code;
    e.origin = origin;
    throw e;
  };
  if (!["glsl-430", "glsl-es-300"].includes(target))
    fail("未知编译目标：" + target, "UNSUPPORTED_TARGET");
  if (
    m.schemaVersion !== 1 ||
    !["vertex", "fragment"].includes(m.stage) ||
    !["structs", "resources", "functions", "body"].every((k) =>
      Array.isArray(m[k]),
    )
  )
    fail("ShaderModuleIR 格式无效");
  const type = (t) => builtinTypes.has(t) || structs.has(t);
  const name = (n) => {
    if (!identifier(n)) fail("符号名称无效：" + n);
  };
  const declare = (scope, n, t, write = false, array = false) => {
    name(n);
    if (!type(t) || t === "VOID") fail("符号类型无效：" + t);
    if (scope.has(n)) fail("符号重复：" + n);
    scope.set(n, { type: t, write, array });
  };
  for (const s of m.structs) {
    name(s.name);
    if (
      builtinTypes.has(s.name) ||
      structs.has(s.name) ||
      !Array.isArray(s.members)
    )
      fail("结构类型重复或无效");
    structs.set(s.name, s.members);
    const seen = new Set();
    for (const p of s.members) {
      name(p.name);
      if (seen.has(p.name) || !type(p.type)) fail("结构成员无效");
      seen.add(p.name);
    }
  }
  const builtins =
    m.stage === "vertex"
      ? { gl_VertexID: "INT", gl_InstanceID: "INT", gl_Position: "VEC4" }
      : { gl_FragCoord: "VEC4", gl_FrontFacing: "BOOL" };
  for (const [n, t] of Object.entries(builtins))
    globals.set(n, { type: t, write: n === "gl_Position", array: false });
  for (const r of m.resources) {
    origin = r.origin || null;
    if (
      !["in", "out", "uniform", "const", "buffer", "uniformBlock"].includes(
        r.storage,
      )
    )
      fail("资源存储类型无效");
    if (r.storage === "buffer" && target !== "glsl-430")
      fail("目标不支持 SSBO", "UNSUPPORTED_FEATURE");
    if (r.flat && !["in", "out"].includes(r.storage))
      fail("flat 只允许阶段接口");
    for (const p of ["binding", "location"])
      if (r[p] !== undefined && (!Number.isInteger(r[p]) || r[p] < 0))
        fail("资源位置无效");
    if (["buffer", "uniformBlock"].includes(r.storage)) {
      name(r.name);
      if (
        !["std140", "std430"].includes(r.layout) ||
        (r.storage === "uniformBlock" && r.layout !== "std140")
      )
        fail("资源布局无效");
      if (!Array.isArray(r.members) || !r.members.length)
        fail("块资源缺少成员");
      for (const p of r.members)
        declare(
          globals,
          p.name,
          p.type,
          r.storage === "buffer" && !r.readonly,
          !!p.array,
        );
    } else declare(globals, r.name, r.type, r.storage === "out", false);
  }
  for (const f of m.functions) {
    name(f.name);
    if (
      functions.has(f.name) ||
      globals.has(f.name) ||
      !type(f.returns) ||
      !Array.isArray(f.parameters)
    )
      fail("函数声明无效或重复");
    functions.set(f.name, f);
    for (const p of f.parameters) {
      name(p.name);
      if (
        !type(p.type) ||
        !["in", "out", "inout"].includes(p.qualifier || "in")
      )
        fail("函数参数无效");
    }
  }
  function reference(e, scope) {
    if (e.kind === "symbol") {
      const s = scope.get(e.name);
      if (!s) fail("未知符号：" + e.name);
      return s;
    }
    if (
      e.kind === "member" &&
      /^([BIU]?)VEC[234]$/.test(e.value.type) &&
      new Set(e.field).size !== e.field.length
    )
      fail("可写分量不能重复");
    if (e.kind === "member" || e.kind === "index")
      return reference(e.value, scope);
    fail("赋值目标必须是可写符号或成员");
  }
  function expr(e, scope, locals = new Map(), depth = 0) {
    if (++budget > 200000 || depth > 160 || !e || !type(e.type))
      fail("表达式类型、深度或大小无效");
    const child = (x) => expr(x, scope, locals, depth + 1),
      same = (a, b) => {
        if (a !== b) fail("表达式类型不匹配：" + a + " / " + b);
      };
    switch (e.kind) {
      case "literal":
        try {
          validateExpression(e);
        } catch (error) {
          fail(error.message);
        }
        if (
          (e.type === "INT" &&
            (e.value < -2147483648 || e.value > 2147483647)) ||
          (e.type === "UINT" && e.value > 4294967295) ||
          (e.type === "FLOAT" && Math.abs(e.value) > 3.4028234663852886e38)
        )
          fail("字面量超出目标 32 位类型范围");
        break;
      case "symbol": {
        const s = scope.get(e.name);
        if (!s) fail("未知符号：" + e.name);
        same(e.type, s.type);
        break;
      }
      case "ref":
        same(e.type, locals.get(e.name));
        break;
      case "block": {
        if (
          !Array.isArray(e.names) ||
          !Array.isArray(e.args) ||
          e.args.length !== e.names.length + 1
        )
          fail("局部表达式块无效");
        const local = new Map(locals),
          own = new Set();
        e.args.forEach((arg, i) => {
          expr(arg, scope, local, depth + 1);
          if (i < e.names.length) {
            name(e.names[i]);
            if (own.has(e.names[i])) fail("局部名称重复");
            own.add(e.names[i]);
            local.set(e.names[i], arg.type);
          }
        });
        same(e.type, e.args.at(-1).type);
        break;
      }
      case "swizzle":
        child(e.args?.[0]);
        try {
          validateExpression({ ...e, args: [dummy(e.args[0].type)] });
        } catch (error) {
          fail(error.message);
        }
        break;
      case "member": {
        child(e.value);
        const t = e.value.type;
        if (structs.has(t)) {
          const field = structs.get(t).find((p) => p.name === e.field);
          if (!field) fail("结构成员不存在：" + e.field);
          same(e.type, field.type);
        } else {
          const match = /^([BIU]?)VEC([234])$/.exec(t);
          if (!match || !/^([xyzw]{1,4}|[rgba]{1,4})$/.test(e.field))
            fail("分量访问无效");
          const indices = [...e.field].map((c) =>
            "xyzw".includes(c) ? "xyzw".indexOf(c) : "rgba".indexOf(c),
          );
          if (indices.some((i) => i >= Number(match[2]))) fail("分量越界");
          same(
            e.type,
            e.field.length === 1
              ? scalarOf(t)
              : match[1] + "VEC" + e.field.length,
          );
        }
        break;
      }
      case "index":
        child(e.value);
        child(e.index);
        if (
          !["INT", "UINT"].includes(e.index.type) ||
          !reference(e.value, scope).array
        )
          fail("数组下标或数组引用无效");
        same(e.type, e.value.type);
        break;
      case "unary":
        child(e.value);
        if (e.operator === "!") {
          same(e.type, "BOOL");
          same(e.value.type, "BOOL");
        } else if (e.operator === "-") {
          same(e.type, e.value.type);
          if (!/^(FLOAT|INT|VEC[234]|IVEC[234])$/.test(e.type))
            fail("负号类型无效");
        } else fail("未知一元操作");
        break;
      case "select":
        child(e.condition);
        child(e.yes);
        child(e.no);
        same(e.condition.type, "BOOL");
        same(e.type, e.yes.type);
        same(e.type, e.no.type);
        break;
      case "binary": {
        child(e.left);
        child(e.right);
        const a = e.left.type,
          b = e.right.type;
        if (["&", "|", ">>", "<<"].includes(e.operator)) {
          if (!["INT", "UINT"].includes(a) || a !== b || e.type !== a)
            fail("整数位运算类型无效");
        } else if (
          e.operator === "*" &&
          /^MAT[234]$/.test(a) &&
          b === "VEC" + a.at(-1)
        )
          same(e.type, b);
        else
          try {
            validateExpression({ ...e, left: dummy(a), right: dummy(b) });
          } catch (error) {
            fail(error.message);
          }
        break;
      }
      case "call": {
        if (!Array.isArray(e.args)) fail("函数调用缺少参数");
        e.args.forEach(child);
        const f = functions.get(e.name);
        if (f) {
          same(e.type, f.returns);
          if (e.args.length !== f.parameters.length) fail("函数参数数目不匹配");
          f.parameters.forEach((p, i) => {
            same(p.type, e.args[i].type);
            if (
              ["out", "inout"].includes(p.qualifier) &&
              !reference(e.args[i], scope).write
            )
              fail("out/inout 需要可写参数");
          });
        } else if (e.name === "texture") {
          if (
            e.type !== "VEC4" ||
            e.args.length !== 2 ||
            e.args[0].type !== "SAMPLER2D" ||
            e.args[1].type !== "VEC2"
          )
            fail("纹理采样类型无效");
        } else if (["any", "all"].includes(e.name)) {
          if (
            e.type !== "BOOL" ||
            e.args.length !== 1 ||
            !/^BVEC[234]$/.test(e.args[0].type)
          )
            fail("布尔向量类型无效");
        } else if (["lessThan", "greaterThan"].includes(e.name)) {
          if (
            e.args.length !== 2 ||
            !/^VEC[234]$/.test(e.args[0].type) ||
            e.args[0].type !== e.args[1].type ||
            e.type !== "B" + e.args[0].type
          )
            fail("向量比较类型无效");
        } else if (e.name === "uintBitsToFloat") {
          if (
            e.args.length !== 1 ||
            !/^(UINT|UVEC[234])$/.test(e.args[0].type) ||
            e.type !==
              (e.args[0].type === "UINT"
                ? "FLOAT"
                : e.args[0].type.replace(/^U/, ""))
          )
            fail("位转换类型无效");
        } else
          try {
            validateExpression({
              ...e,
              args: e.args.map((a) => dummy(a.type)),
            });
          } catch (error) {
            fail(error.message);
          }
        break;
      }
      default:
        fail("模块不接受表达式种类：" + e.kind);
    }
    return e.type;
  }
  function body(statements, scope, returns) {
    if (!Array.isArray(statements)) fail("语句块无效");
    for (const s of statements) {
      origin = s.origin || origin;
      switch (s.kind) {
        case "declare":
          expr(s.value, scope);
          if (s.type !== s.value.type) fail("声明类型不匹配");
          declare(scope, s.name, s.type, true);
          break;
        case "assign":
          expr(s.to, scope);
          expr(s.value, scope);
          if (!reference(s.to, scope).write || s.to.type !== s.value.type)
            fail("赋值目标只读或类型不匹配");
          break;
        case "call":
          expr(s.value, scope);
          break;
        case "return":
          if (s.value) {
            expr(s.value, scope);
            if (s.value.type !== returns) fail("返回类型不匹配");
          } else if (returns !== "VOID") fail("返回值缺失");
          break;
        case "if":
          expr(s.condition, scope);
          if (s.condition.type !== "BOOL") fail("条件需要 BOOL");
          body(s.yes, new Map(scope), returns);
          body(s.no || [], new Map(scope), returns);
          break;
        case "for": {
          expr(s.count, scope);
          if (!["INT", "UINT", "FLOAT"].includes(s.count.type))
            fail("循环次数类型无效");
          const local = new Map(scope);
          declare(local, s.index, "INT", false);
          body(s.body, local, returns);
          break;
        }
        default:
          fail("未知语句：" + s.kind);
      }
    }
  }
  for (const r of m.resources)
    if (r.storage === "const") {
      expr(r.value, globals);
      if (r.type !== r.value.type) fail("常量声明类型不匹配");
    }
  for (const f of m.functions) {
    origin = f.origin || null;
    if (f.raw) {
      if (!Array.isArray(f.targets) || !f.targets.includes(target))
        fail(
          "自定义 GLSL 未声明支持目标：" + target,
          "UNSUPPORTED_SOURCE_TARGET",
        );
      if (
        typeof f.code !== "string" ||
        typeof (f.helpers ?? "") !== "string" ||
        /#\s*(version|extension)\b/.test(f.code + (f.helpers || ""))
      )
        fail("自定义源码不允许覆盖目标版本或扩展声明");
      continue;
    }
    const scope = new Map(globals);
    for (const p of f.parameters)
      declare(scope, p.name, p.type, ["out", "inout"].includes(p.qualifier));
    body(f.body, scope, f.returns);
  }
  origin = null;
  body(m.body, new Map(globals), "VOID");
  return m;
}

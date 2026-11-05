import { copyJson } from "./schema.mjs";
/** 类型化表达式 IR。插件生成数据树，目标后端负责发射源码，插件不取得编译器私有状态。 */
export const ir = Object.freeze({
  literal: (type, value) => ({ kind: "literal", type, value }),
  input: (type, name) => ({ kind: "input", type, name }),
  binary: (type, operator, left, right) => ({
    kind: "binary",
    type,
    operator,
    left,
    right,
  }),
  call: (type, name, args) => ({ kind: "call", type, name, args }),
  /** 引用当前 block 中已声明的局部量，不能前向引用或越出作用域。 */
  ref: (type, name) => ({ kind: "ref", type, name }),
  /** 顺序声明不可变局部量，最后一个 args 为结果，不允许循环、赋值或源码。 */
  block: (bindings, result) => ({
    kind: "block",
    type: result.type,
    names: bindings.map((b) => b.name),
    args: [...bindings.map((b) => b.value), result],
  }),
  /** 读取向量分量，仅支持 xyzw，结果类型和长度必须一致。 */
  swizzle: (type, fields, value) => ({
    kind: "swizzle",
    type,
    fields,
    args: [value],
  }),
});
export const EXPRESSION_TYPES = Object.freeze([
  "BOOL",
  "INT",
  "UINT",
  "FLOAT",
  "VEC2",
  "VEC3",
  "VEC4",
  "IVEC2",
  "IVEC3",
  "IVEC4",
  "UVEC2",
  "UVEC3",
  "UVEC4",
  "BVEC2",
  "BVEC3",
  "BVEC4",
  "MAT2",
  "MAT3",
  "MAT4",
  "SAMPLER2D",
  "SAMPLER_CUBE",
]);
const types = new Set(EXPRESSION_TYPES);
/** 验证节点表达式 IR 的类型和递归深度，原始 GLSL 只通过显式目标函数协议处理。 */
export function validateExpression(
  value,
  { depth = 0, locals = new Map() } = {},
) {
  if (depth > 100 || !value || !types.has(value.type))
    throw new Error("IR 类型无效或表达式过深");
  const next = (x) =>
    validateExpression(x, { depth: depth + 1, locals });
  switch (value.kind) {
    case "ref":
      if (locals.get(value.name) !== value.type)
        throw new Error("IR 局部引用不存在或类型不匹配");
      break;
    case "block": {
      if (
        !Array.isArray(value.names) ||
        !Array.isArray(value.args) ||
        value.args.length !== value.names.length + 1 ||
        value.names.length > 4096
      )
        throw new Error("IR 局部块格式或大小无效");
      const scoped = new Map(locals),
        own = new Set();
      for (let i = 0; i < value.args.length; i++) {
        validateExpression(value.args[i], {
          depth: depth + 1,
          locals: scoped,
        });
        if (i < value.names.length) {
          const name = value.names[i];
          if (!/^[A-Za-z_]\w*$/.test(name) || own.has(name))
            throw new Error("IR 局部名称无效或重复");
          own.add(name);
          scoped.set(name, value.args[i].type);
        }
      }
      if (value.args.at(-1).type !== value.type)
        throw new Error("IR 局部块结果类型不匹配");
      break;
    }
    case "swizzle": {
      if (!Array.isArray(value.args) || value.args.length !== 1)
        throw new Error("IR 分量读取参数无效");
      next(value.args[0]);
      const match = /^([BIU]?)VEC([234])$/.exec(value.args[0].type);
      if (
        !match ||
        !/^[xyzw]{1,4}$/.test(value.fields) ||
        [...value.fields].some((c) => "xyzw".indexOf(c) >= Number(match[2]))
      )
        throw new Error("IR 分量越界");
      const expected =
        value.fields.length === 1
          ? { "": "FLOAT", B: "BOOL", I: "INT", U: "UINT" }[match[1]]
          : match[1] + "VEC" + value.fields.length;
      if (value.type !== expected) throw new Error("IR 分量结果类型不匹配");
      break;
    }
    case "literal":
      if (
        !["BOOL", "INT", "UINT", "FLOAT"].includes(value.type) ||
        (value.type === "BOOL" && typeof value.value !== "boolean") ||
        (value.type !== "BOOL" &&
          (typeof value.value !== "number" || !Number.isFinite(value.value))) ||
        (["INT", "UINT"].includes(value.type) &&
          !Number.isInteger(value.value)) ||
        (value.type === "UINT" && value.value < 0)
      )
        throw new Error("IR 字面量类型或数值无效");
      break;
    case "input":
      if (!/^[A-Za-z_]\w*$/.test(value.name)) throw new Error("IR 输入名无效");
      break;
    case "binary": {
      if (
        ![
          "+",
          "-",
          "*",
          "/",
          "<",
          "<=",
          ">",
          ">=",
          "==",
          "!=",
          "&&",
          "||",
        ].includes(value.operator)
      )
        throw new Error("IR 运算符无效");
      next(value.left);
      next(value.right);
      const a = value.left.type,
        b = value.right.type,
        compare = ["<", "<=", ">", ">=", "==", "!="].includes(value.operator),
        logical = ["&&", "||"].includes(value.operator);
      if (logical) {
        if (a !== "BOOL" || b !== "BOOL" || value.type !== "BOOL")
          throw new Error("IR 逻辑运算必须使用 BOOL");
      } else if (compare) {
        if (
          a !== b ||
          value.type !== "BOOL" ||
          (["<", "<=", ">", ">="].includes(value.operator) &&
            !["INT", "UINT", "FLOAT"].includes(a))
        )
          throw new Error("IR 比较运算类型不匹配");
      } else {
        const result =
          a === b
            ? a
            : a === "FLOAT" && /^VEC[234]$/.test(b)
              ? b
              : b === "FLOAT" && /^VEC[234]$/.test(a)
                ? a
                : null;
        if (
          !result ||
          value.type !== result ||
          !["INT", "UINT", "FLOAT", "VEC2", "VEC3", "VEC4"].includes(result)
        )
          throw new Error("IR 算术类型不匹配");
      }
      break;
    }
    case "call": {
      if (!/^[A-Za-z_]\w*$/.test(value.name) || !Array.isArray(value.args))
        throw new Error("IR 函数调用无效");
      value.args.forEach(next);
      const args = value.args,
        name = value.name,
        constructor = /^(?:[biu]?vec[234]|mat[234]|float|int|uint|bool)$/.test(
          name,
        );
      if (constructor) {
        if (name.toUpperCase() !== value.type)
          throw new Error("IR 构造器返回类型不匹配");
        const scalar = (t) => ["BOOL", "INT", "UINT", "FLOAT"].includes(t);
        const vector = (t) => /^[BIU]?VEC[234]$/.test(t);
        const matrix = (t) => /^MAT[234]$/.test(t);
        const size = Number(name.at(-1)) || 1;
        const count = args.reduce(
          (n, a) => n + (vector(a.type) ? Number(a.type.at(-1)) : 1),
          0,
        );
        const valid = name.startsWith("mat")
          ? (args.length === 1 &&
              (scalar(args[0].type) || matrix(args[0].type))) ||
            (args.every((a) => scalar(a.type) || vector(a.type)) &&
              count === size * size)
          : size === 1
            ? args.length === 1 &&
              (scalar(args[0].type) || vector(args[0].type))
            : args.length === 1
              ? scalar(args[0].type) || (vector(args[0].type) && count >= size)
              : args.every((a) => scalar(a.type) || vector(a.type)) &&
                count === size;
        if (!args.length || !valid) throw new Error("IR 构造器分量数不匹配");
      } else if (
        [
          "sin",
          "cos",
          "tan",
          "asin",
          "acos",
          "sign",
          "radians",
          "degrees",
          "abs",
          "floor",
          "ceil",
          "fract",
          "sqrt",
          "exp",
          "log",
          "normalize",
        ].includes(name)
      ) {
        if (
          args.length !== 1 ||
          args[0].type !== value.type ||
          !["FLOAT", "VEC2", "VEC3", "VEC4"].includes(value.type)
        )
          throw new Error("IR 一元函数类型不匹配");
      } else if (["min", "max", "pow", "mod", "step"].includes(name)) {
        const supported = ["min", "max"].includes(name)
          ? /^(?:FLOAT|INT|UINT|[IU]?VEC[234])$/.test(value.type)
          : /^(?:FLOAT|VEC[234])$/.test(value.type);
        if (
          !supported ||
          args.length !== 2 ||
          args.some((a) => a.type !== value.type)
        )
          throw new Error("IR 二元函数类型不匹配");
      } else if (name === "atan") {
        if (
          ![1, 2].includes(args.length) ||
          !/^(?:FLOAT|VEC[234])$/.test(value.type) ||
          args.some((a) => a.type !== value.type)
        )
          throw new Error("IR atan 类型不匹配");
      } else if (["cross", "reflect"].includes(name)) {
        if (
          args.length !== 2 ||
          args.some((a) => a.type !== value.type) ||
          (name === "cross"
            ? value.type !== "VEC3"
            : !/^VEC[234]$/.test(value.type))
        )
          throw new Error("IR 向量函数类型不匹配");
      } else if (["length", "dot", "distance"].includes(name)) {
        if (
          args.length !== (name === "length" ? 1 : 2) ||
          value.type !== "FLOAT" ||
          !/^VEC[234]$/.test(args[0].type) ||
          args.some((a) => a.type !== args[0].type)
        )
          throw new Error("IR 向量函数类型不匹配");
      } else if (["mix", "clamp", "smoothstep"].includes(name)) {
        if (
          !/^(?:FLOAT|VEC[234])$/.test(value.type) ||
          args.length !== 3 ||
          args.some(
            (a, i) =>
              a.type !== value.type &&
              !(name === "mix" && i === 2 && a.type === "FLOAT"),
          )
        )
          throw new Error("IR 三元函数类型不匹配");
      } else throw new Error(`未登记的 IR 函数：${name}`);
      break;
    }
    case "source":
      throw new Error("插件不允许提供原始 IR source");
    default:
      throw new Error("未知 IR 节点");
  }
  return copyJson(value);
}

/** 由节点 ID 生成稳定的着色器标识符，编辑、预览和导出共用。 */
export const sourceName = (value) =>
  String(value)
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^[^A-Za-z_]+/, "") || "value";

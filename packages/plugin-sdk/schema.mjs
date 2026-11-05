import { ContractError } from "./errors.mjs";
import { validateSchema } from "./schema-definition.mjs";
export { validateSchema } from "./schema-definition.mjs";
const invalid = (path, message) => {
  throw new ContractError("INVALID_ARGUMENT", `${path}：${message}`, path);
};

/** 按已实现的 schema 子集检查 JSON 数据，错误保留稳定 code 和字段 path。 */
export function validateValue(value, schema, path = "参数") {
  validateSchema(schema);
  const stack = new Set();
  function check(v, s, p) {
    if (s.enum && !s.enum.includes(v)) invalid(p, "不在允许值中");
    if (
      s.anyOf &&
      !s.anyOf.some((branch) => {
        try {
          check(v, branch, p);
          return true;
        } catch {
          return false;
        }
      })
    )
      invalid(p, "类型不匹配");
    const type = s.type;
    if (type === "null") {
      if (v !== null) invalid(p, "应为 null");
      return;
    }
    if (
      type === "number" ||
      type === "integer" ||
      (!type && typeof v === "number")
    ) {
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        (type === "integer" && !Number.isInteger(v))
      )
        invalid(p, `应为有限${type === "integer" ? "整数" : "数值"}`);
      if (v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity))
        invalid(p, "数值超出范围");
      return;
    }
    if (type === "array" && !Array.isArray(v)) invalid(p, "应为数组");
    if (type === "object" && (!v || typeof v !== "object" || Array.isArray(v)))
      invalid(p, "应为普通对象");
    if (type && !["object", "array"].includes(type) && typeof v !== type)
      invalid(p, `应为 ${type}`);
    if (v && typeof v === "object") {
      if (stack.has(v)) invalid(p, "不允许循环数据");
      stack.add(v);
      try {
        if (Array.isArray(v)) {
          if (
            v.length < (s.minItems ?? 0) ||
            v.length > (s.maxItems ?? Infinity)
          )
            invalid(p, "数组长度超出范围");
          for (let i = 0; i < v.length; i++)
            check(v[i], s.items || {}, `${p}[${i}]`);
        } else {
          if (![Object.prototype, null].includes(Object.getPrototypeOf(v)))
            invalid(p, "应为普通对象");
          for (const key of s.required || [])
            if (!Object.hasOwn(v, key)) invalid(p + "." + key, "缺少字段");
          for (const [key, item] of Object.entries(v)) {
            if (["__proto__", "prototype", "constructor"].includes(key))
              invalid(p, `不允许的字段 ${key}`);
            const declared = Object.hasOwn(s.properties || {}, key)
              ? s.properties[key]
              : undefined;
            if (!declared && s.additionalProperties === false)
              invalid(p + "." + key, "未知字段");
            check(
              item,
              declared ||
                (typeof s.additionalProperties === "object"
                  ? s.additionalProperties
                  : {}),
              p + "." + key,
            );
          }
        }
      } finally {
        stack.delete(v);
      }
      return;
    }
    if (
      typeof v === "string" &&
      ((s.minLength !== undefined && v.length < s.minLength) ||
        (s.maxLength !== undefined && v.length > s.maxLength) ||
        (s.pattern && !new RegExp(s.pattern).test(v)))
    )
      invalid(p, "字符串格式不正确");
    if (
      v !== null &&
      !["string", "boolean"].includes(typeof v) &&
      !(typeof v === "number" && Number.isFinite(v))
    )
      invalid(p, "公开数据只能包含 JSON 值");
  }
  check(value, schema, path);
}

/** JSON 深拷贝不共享对象，拒绝循环、稀疏数组、非有限数字与函数。 */
export function copyJson(value) {
  const stack = new Set();
  function walk(v) {
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (!v || typeof v !== "object" || stack.has(v))
      invalid("JSON", "公开数据只能包含无环 JSON 值");
    stack.add(v);
    try {
      if (Array.isArray(v)) return Array.from(v, walk);
      if (![Object.prototype, null].includes(Object.getPrototypeOf(v)))
        invalid("JSON", "应为普通对象");
      const out = {};
      for (const [key, item] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(key))
          invalid("JSON", "不允许的 JSON 字段");
        out[key] = walk(item);
      }
      return out;
    } finally {
      stack.delete(v);
    }
  }
  return walk(value);
}

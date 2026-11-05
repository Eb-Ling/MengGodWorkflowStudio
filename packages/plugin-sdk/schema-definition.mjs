import { ContractError } from "./errors.mjs";
const plain = (v) =>
  v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));
const forbidden = new Set(["__proto__", "constructor", "prototype"]);
const keywords = new Set([
  "type",
  "enum",
  "anyOf",
  "items",
  "minItems",
  "maxItems",
  "properties",
  "required",
  "additionalProperties",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "pattern",
  "description",
  "title",
  "default",
]);

/** 校验 SDK 实际实现的 schema 子集，未知关键字不能被悄悄忽略。远程声明另有更严格预算。 */
export function validateSchema(schema, path = "schema") {
  const stack = new Set();
  let count = 0;
  const fail = (p, message) => {
    throw new ContractError("INVALID_SCHEMA", `${p}：${message}`, p);
  };
  function visit(s, p, depth) {
    if (!plain(s) || stack.has(s) || depth > 64 || ++count > 10000)
      fail(p, "规则不是普通对象、存在循环或超限");
    stack.add(s);
    for (const key of Object.keys(s))
      if (!keywords.has(key)) fail(p + "." + key, "未实现的 schema 规则");
    if (
      s.type !== undefined &&
      ![
        "object",
        "array",
        "string",
        "number",
        "integer",
        "boolean",
        "null",
      ].includes(s.type)
    )
      fail(p, "未知类型");
    for (const key of ["minItems", "maxItems", "minLength", "maxLength"])
      if (s[key] !== undefined && (!Number.isSafeInteger(s[key]) || s[key] < 0))
        fail(p + "." + key, "长度必须是非负整数");
    for (const key of ["minimum", "maximum"])
      if (s[key] !== undefined && !Number.isFinite(s[key]))
        fail(p + "." + key, "范围必须是有限数值");
    for (const [min, max] of [
      ["minimum", "maximum"],
      ["minItems", "maxItems"],
      ["minLength", "maxLength"],
    ])
      if (s[min] !== undefined && s[max] !== undefined && s[min] > s[max])
        fail(p, "最小值大于最大值");
    if (
      s.enum !== undefined &&
      (!Array.isArray(s.enum) ||
        !s.enum.length ||
        s.enum.some(
          (v) =>
            v !== null &&
            !["string", "boolean"].includes(typeof v) &&
            !(typeof v === "number" && Number.isFinite(v)),
        ))
    )
      fail(p, "枚举必须是非空 JSON 标量数组");
    if (s.pattern !== undefined) {
      if (typeof s.pattern !== "string") fail(p, "pattern 必须是字符串");
      try {
        new RegExp(s.pattern);
      } catch {
        fail(p, "pattern 不是有效正则");
      }
    }
    for (const key of ["description", "title"])
      if (s[key] !== undefined && typeof s[key] !== "string")
        fail(p, `${key} 必须是字符串`);
    if (s.anyOf !== undefined) {
      if (!Array.isArray(s.anyOf) || !s.anyOf.length)
        fail(p, "anyOf 必须有分支");
      s.anyOf.forEach((item, i) => visit(item, `${p}.anyOf[${i}]`, depth + 1));
    }
    if (s.items !== undefined) visit(s.items, p + ".items", depth + 1);
    if (s.properties !== undefined) {
      if (!plain(s.properties)) fail(p, "properties 必须是普通对象");
      for (const [key, value] of Object.entries(s.properties)) {
        if (forbidden.has(key)) fail(p, "不允许的字段名");
        visit(value, p + ".properties." + key, depth + 1);
      }
    }
    if (
      s.required !== undefined &&
      (!Array.isArray(s.required) ||
        new Set(s.required).size !== s.required.length ||
        s.required.some(
          (key) =>
            typeof key !== "string" ||
            forbidden.has(key) ||
            (s.additionalProperties === false &&
              !Object.hasOwn(s.properties || {}, key)),
        ))
    )
      fail(p, "必填字段无效或无法满足");
    if (
      s.additionalProperties !== undefined &&
      typeof s.additionalProperties !== "boolean"
    )
      visit(s.additionalProperties, p + ".additionalProperties", depth + 1);
    stack.delete(s);
  }
  visit(schema, path, 0);
  return schema;
}

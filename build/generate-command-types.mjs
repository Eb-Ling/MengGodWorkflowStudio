import fs from "node:fs/promises";
import path from "node:path";
import {
  GRAPH_PAYLOAD_SCHEMAS,
  ACTION_SCHEMAS,
} from "../packages/plugin-sdk/commands.mjs";
import {
  nodeCreationSchema,
  workflowEditSchema,
  workflowPropertySchema,
} from "../packages/plugin-sdk/workflow-edit.mjs";
import { validateSchema } from "../packages/plugin-sdk/schema.mjs";
import { CONTRACT_ERROR_CODES } from "../packages/plugin-sdk/errors.mjs";

/** 生成结构类型，数值范围、正则等值约束仍由同一 schema 在运行时检查。 */
export function schemaType(schema) {
  validateSchema(schema);
  function emit(s) {
    let base;
    if (s.enum) base = s.enum.map((v) => JSON.stringify(v)).join(" | ");
    else if (s.type === "object") {
      const props = Object.entries(s.properties || {}).map(
        ([key, value]) =>
          `${JSON.stringify(key)}${s.required?.includes(key) ? "" : "?"}: ${emit(value)};`,
      );
      for (const key of s.required || [])
        if (!Object.hasOwn(s.properties || {}, key))
          props.push(`${JSON.stringify(key)}: JsonValue;`);
      if (s.additionalProperties !== false)
        props.push(
          `[key: string]: ${typeof s.additionalProperties === "object" ? emit(s.additionalProperties) : "unknown"};`,
        );
      base = `{ ${props.join(" ")} }`;
    } else if (s.type === "array") base = `Array<${emit(s.items || {})}>`;
    else
      base =
        {
          integer: "number",
          number: "number",
          string: "string",
          boolean: "boolean",
          null: "null",
        }[s.type] || "JsonValue";
    if (s.anyOf)
      return `(${s.anyOf.map(emit).join(" | ")})${s.type || s.enum ? ` & (${base})` : ""}`;
    return base;
  }
  return emit(schema);
}
export function commandDeclarations() {
  const map = (name, schemas) =>
    `export type ${name} = {\n${Object.entries(schemas)
      .map(([key, s]) => `  ${JSON.stringify(key)}: ${schemaType(s)};`)
      .join("\n")}\n};\n`;
  return (
    "/** 自动生成，请修改 commands.mjs / workflow-edit.mjs，再运行 pnpm contracts:generate。\n * 结构类型与运行时 schema 共源，有限数值、长度和正则约束在调用时检查。\n * 开放对象的未知字段必须先收窄，local 组件/函数接口不由 JSON schema 生成。 */\n" +
    "export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };\n" +
    `export type ContractErrorCode = ${CONTRACT_ERROR_CODES.map((v) => JSON.stringify(v)).join(" | ")};\n` +
    map("GraphPayloads", GRAPH_PAYLOAD_SCHEMAS) +
    map("ApplicationPayloads", ACTION_SCHEMAS) +
    Object.entries({
      NodeCreationInput: nodeCreationSchema,
      WorkflowEditInput: workflowEditSchema,
      WorkflowPropertyInput: workflowPropertySchema,
    })
      .map(([name, s]) => `export type ${name} = ${schemaType(s)};\n`)
      .join("")
  );
}
const filename = new URL(
  "../packages/plugin-sdk/command-types.ts",
  import.meta.url,
);
export async function checkCommandDeclarations() {
  if ((await fs.readFile(filename, "utf8")) !== commandDeclarations())
    throw Error("命令类型已过期，请运行 pnpm contracts:generate");
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  if (process.argv.includes("--write"))
    await fs.writeFile(filename, commandDeclarations());
  else await checkCommandDeclarations();
  console.log("PASS: 命令与常用编辑类型来自同一份运行时 schema");
}

import { validateValue } from "./schema.mjs";
const text = { type: "string" },
  number = { type: "number" };
const shape = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const list = (items) => ({ type: "array", maxItems: 256, items });
export const nodeCreationSchema = shape(
  {
    typeId: text,
    id: text,
    title: text,
    properties: { type: "object" },
    x: number,
    y: number,
  },
  ["typeId"],
);
const link = shape(
  { fromNode: text, fromSocket: text, toNode: text, toSocket: text },
  ["fromNode", "fromSocket", "toNode", "toSocket"],
);
/** 一次常用图编辑，默认值、可读 ID 与事务由工作流能力统一处理。 */
export const workflowEditSchema = shape({
  add: list(nodeCreationSchema),
  remove: list(text),
  connect: list(link),
  disconnect: list(link),
  output: text,
});
/** 检查器字段编辑，含 $title、$scope 以及普通属性。 */
export const workflowPropertySchema = shape(
  { nodeId: text, key: text, value: {} },
  ["nodeId", "key", "value"],
);
export const workflowCalls = Object.freeze({
  edit: workflowEditSchema,
  setProperty: workflowPropertySchema,
  inspect: shape({}),
});
/** MCP 仅转发明确允许的工作流方法，不开放任意 API/方法执行。 */
export function readWorkflowCall(call) {
  validateValue(
    call,
    shape(
      {
        method: { enum: Object.keys(workflowCalls) },
        input: { type: "object" },
      },
      ["method", "input"],
    ),
  );
  validateValue(call.input, workflowCalls[call.method]);
  return structuredClone(call);
}

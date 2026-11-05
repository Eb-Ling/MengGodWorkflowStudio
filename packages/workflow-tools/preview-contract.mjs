import { validateValue } from "../plugin-sdk/schema.mjs";
const shape = (properties) => ({
  type: "object",
  properties,
  additionalProperties: false,
});
const size = { type: "integer", minimum: 1, maximum: 4096 };
/** 预览能力的公共请求，画布、所有者和异步代次不进入 JSON 协议。 */
export const previewRequestSchema = shape({
  document: { type: "object" },
  stage: { enum: ["vertex", "fragment"] },
  nodeId: { type: "string" },
  socket: { type: "string" },
  width: size,
  height: size,
  longEdge: { type: "integer", minimum: 64, maximum: 4096 },
  time: { type: "number" },
  geometry: shape({
    count: { type: "integer", minimum: 1, maximum: 64 },
    selected: { type: "integer", minimum: 1, maximum: 64 },
    overrides: { type: "object" },
  }),
});
export function readPreviewRequest(input = {}) {
  validateValue(input, previewRequestSchema);
  return structuredClone(input);
}
// MCP 只允许当前草稿的有界预览调用，本地画布句柄不能跨进程传递。
export const previewCalls = Object.freeze({
  frame: shape(
    Object.fromEntries(
      Object.entries(previewRequestSchema.properties).filter(
        ([key]) => !["document", "stage", "geometry"].includes(key),
      ),
    ),
  ),
  open: shape(
    Object.fromEntries(
      Object.entries(previewRequestSchema.properties).filter(
        ([key]) => !["document", "stage", "geometry"].includes(key),
      ),
    ),
  ),
  close: shape({}),
  status: shape({}),
  compilationStatus: shape({}),
});
export function readPreviewCall(call) {
  validateValue(call, {
    ...shape({
      method: { enum: Object.keys(previewCalls) },
      input: { type: "object" },
    }),
    required: ["method", "input"],
  });
  validateValue(call.input, previewCalls[call.method]);
  return structuredClone(call);
}

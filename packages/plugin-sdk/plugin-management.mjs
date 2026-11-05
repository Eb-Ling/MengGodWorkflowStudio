import { copyJson, validateValue } from "./schema.mjs";
const id = { type: "string", minLength: 1 };
/** MCP 只管理已登记插件或用户明确授权的目录快照，不接受路径，不代替用户批准内容。 */
export const pluginCalls = Object.freeze({
  snapshot: { type: "object", properties: {}, additionalProperties: false },
  authorized: { type: "object", properties: {}, additionalProperties: false },
  registerAuthorized: {
    type: "object",
    properties: { id, authorizationId: id },
    required: ["id", "authorizationId"],
    additionalProperties: false,
  },
  remove: {
    type: "object",
    properties: { id, reviewKey: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  },
  inspectPanels: {
    type: "object",
    properties: { id },
    required: ["id"],
    additionalProperties: false,
  },
  previewDisable: {
    type: "object",
    properties: { id },
    required: ["id"],
    additionalProperties: false,
  },
  setEnabled: {
    type: "object",
    properties: {
      id,
      enabled: { type: "boolean" },
      reviewKey: { type: "string" },
    },
    required: ["id", "enabled"],
    additionalProperties: false,
  },
  reload: {
    type: "object",
    properties: { id },
    required: ["id"],
    additionalProperties: false,
  },
});
/** 服务端与编辑器共同验证调用，方法白名单不包含内容批准或任意路径访问。 */
export function readPluginCall(value) {
  validateValue(
    value,
    {
      type: "object",
      properties: {
        method: { enum: Object.keys(pluginCalls) },
        input: { type: "object" },
      },
      required: ["method", "input"],
      additionalProperties: false,
    },
    "插件操作",
  );
  validateValue(value.input, pluginCalls[value.method], "插件操作参数");
  return copyJson(value);
}

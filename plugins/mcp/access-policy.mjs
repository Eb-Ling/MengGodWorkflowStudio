import { validateRequest } from "../../packages/plugin-sdk/contracts.mjs";
import { readWorkflowCall } from "../../packages/plugin-sdk/workflow-edit.mjs";
import { readPreviewCall } from "../../packages/workflow-tools/preview-contract.mjs";
import { readPluginCall } from "../../packages/plugin-sdk/plugin-management.mjs";

/** 在服务端判定真实操作，不能信任客户端工具名、HTTP 方法或草稿 token 代表写权限。 */
export function commandPermission(input) {
  if (input.workflowCall || input.previewCall || input.pluginCall) {
    if (
      [input.workflowCall, input.previewCall, input.pluginCall].filter(Boolean).length > 1 ||
      input.commands?.length ||
      input.actions?.length ||
      input.transaction
    )
      throw Error("能力调用不能混入其他操作");
    if (input.pluginCall)
      return ["snapshot", "previewDisable", "authorized", "inspectPanels"].includes(readPluginCall(input.pluginCall).method) ? "session.read" : "session.write";
    if (input.workflowCall)
      return readWorkflowCall(input.workflowCall).method === "inspect"
        ? "session.read"
        : "session.write";
    return ["frame", "status", "compilationStatus"].includes(
      readPreviewCall(input.previewCall).method,
    )
      ? "session.read"
      : "session.write";
  }
  const { commands, actions, transaction } = validateRequest(input);
  if (!transaction && !commands.length && actions.length === 1) {
    const { type, payload } = actions[0];
    if (
      type === "DESCRIBE_EXPORT_CONFIGURATION" ||
      (type === "PROJECT_FILE" && payload.operation === "status")
    )
      return "session.read";
  }
  return "session.write";
}

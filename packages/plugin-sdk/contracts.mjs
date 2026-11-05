// Public, platform-neutral protocol. No plugin or editor implementation imports.
import {
  ACTION_SCHEMAS,
  GRAPH_PAYLOAD_SCHEMAS,
  validateAction,
  validateGraphCommand,
} from "./commands.mjs";
export const API_VERSION = "1.0.0";
export const GRAPH_COMMANDS = Object.freeze(Object.keys(GRAPH_PAYLOAD_SCHEMAS));
export const EDITOR_ACTIONS = Object.freeze(Object.keys(ACTION_SCHEMAS));
export const cloneData = (value) => JSON.parse(JSON.stringify(value));

/** AI 的标准操作顺序，连接说明与 MCP 初始化共用，避免两处约定不一致。 */
export const WORKFLOW_AGENT_PROCEDURE = `仅通过本应用公开的 MCP 工具操作用户指定的草稿或工作流。
1. 调用 workflow_get_status 确认连接，再调用 workflow_list_workflows 列出当前草稿、已保存工作流和恢复草稿。
2. 按用户给出的名称或 ID 匹配目标。用户未指定、名称重复或存在多个版本时，先询问用户，不能自行猜选。使用列表中的 kind 和 id 调用 workflow_select_workflow。切换目标不要求用户打开 MCP 面板或激活草稿，切换到另一份内容需要可编辑权限。
3. 调用 workflow_get_summary 读取所选工作流，核对名称、节点、阶段及修订。需要节点端口或属性说明时调用 workflow_list_node_types。
4. 使用这次读取返回的 project.id、documentToken、stage 和 graph.revision，分别作为 documentId、documentToken、stage 和 expectedRevision 提交操作。跨阶段事务还须使用同一读取的 documentRevision。切换目标或阶段后必须重新读取，不能沿用上一份摘要。
5. 完成后再次读取 workflow_get_summary 核对结果。视觉修改通过 workflow_render_preview 读取普通或高清 GPU 图片。首次导出先通过 workflow_export_runtime_dependency 获取公共依赖，再导出特效。
不要自行新建、导入、重置、删除或覆盖未指定的工作流。不要扫描磁盘、直接修改工作流文件、注入内部状态或用命令行请求替代公开 MCP 操作。用户明确授权的源码开发不受此工作流操作规则限制。`;

export function validateRequest(input) {
  if (!input || typeof input !== "object")
    throw new Error("操作请求必须是对象");
  const commands = input.commands ?? [],
    actions = input.actions ?? [];
  if (!Array.isArray(commands) || !Array.isArray(actions))
    throw new Error("commands/actions 必须是数组");
  if (input.transaction) {
    if (commands.length || actions.length)
      throw new Error("文档事务不能混入其他操作");
    if (
      typeof input.transaction !== "object" ||
      Array.isArray(input.transaction)
    )
      throw new Error("文档事务格式无效");
    return { commands: [], actions: [], transaction: input.transaction };
  }
  if (!commands.length && !actions.length) throw new Error("操作不能为空");
  // Project IO and download operations are separate requests, never part of a
  // graph transaction. Reject before any work rather than report partial success.
  if (actions.length > 1 || (commands.length && actions.length))
    throw new Error("图事务与页面操作必须分开提交，每次只允许一个页面操作");
  if (commands.length > 1000) throw new Error("单次图事务最多 1000 项");
  // 当前阶段批次不能悄悄覆盖命令中明确指定的另一个阶段。
  if (
    commands.some(
      (item) => item?.stage !== undefined && item.stage !== input.stage,
    )
  )
    throw new Error("图命令阶段与当前请求不一致，跨阶段修改请使用文档事务");
  for (const [items, allowed] of [
    [commands, GRAPH_COMMANDS],
    [actions, EDITOR_ACTIONS],
  ]) {
    for (const item of items) {
      if (
        !item ||
        !allowed.includes(item.type) ||
        !item.payload ||
        typeof item.payload !== "object" ||
        Array.isArray(item.payload)
      )
        throw new Error("未知操作或无效 payload");
    }
  }
  for (const item of commands) validateGraphCommand(item.type, item.payload);
  for (const item of actions) validateAction(item.type, item.payload);
  return { commands, actions };
}

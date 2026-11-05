import { validateValue } from "./schema.mjs";
import { NODE_SCHEMA } from "./document.mjs";
import { ContractError } from "./errors.mjs";
import { projectFileRequest } from "./project-files.mjs";
const text = { type: "string" },
  number = { type: "number" },
  object = { type: "object" },
  ids = { type: "array", items: text };
const shape = (properties = {}, required = []) => ({
  type: "object",
  properties,
  required,
});
const link = shape(
  { fromNode: text, fromSocket: text, toNode: text, toSocket: text },
  ["fromNode", "fromSocket", "toNode", "toSocket"],
);
/** 图命令的公开参数说明，MCP 与扩展使用相同字段，不需要猜测 payload。 */
export const GRAPH_PAYLOAD_SCHEMAS = Object.freeze({
  ADD_NODE: shape({ node: NODE_SCHEMA }, ["node"]),
  REMOVE_NODE: shape({ nodeId: text }, ["nodeId"]),
  MOVE_NODE: shape({ nodeId: text, x: number, y: number }, [
    "nodeId",
    "x",
    "y",
  ]),
  CONNECT: shape({ link }, ["link"]),
  DISCONNECT: shape({ link }, ["link"]),
  SET_PROPERTY: shape({ nodeId: text, key: text, value: {} }, [
    "nodeId",
    "key",
    "value",
  ]),
  RENAME_NODE: shape({ nodeId: text, title: text }, ["nodeId", "title"]),
  RENAME_NODE_ID: shape({ nodeId: text, id: text }, ["nodeId", "id"]),
  SET_OUTPUT: shape({ nodeId: text }, ["nodeId"]),
});
/** 应用命令的数据约束。文件 IO 是单独动作，文档内存修改可用 transaction 原子提交。 */
export const ACTION_SCHEMAS = Object.freeze({
  UNDO: shape(),
  REDO: shape(),
  SET_STAGE: shape({ stage: { enum: ["vertex", "fragment"] } }, ["stage"]),
  SAVE_WORKFLOW: shape({ config: object }),
  PROJECT_FILE: projectFileRequest,
  RESTORE_PROJECT_DOCUMENT: shape({ document: object }, ["document"]),
  EXPORT_RUNTIME: shape({ download: { type: "boolean" } }),
  EXPORT_RUNTIME_DEPENDENCY: shape({ runtimePath: text }),
  DESCRIBE_EXPORT_CONFIGURATION: shape({
    runtimePath: text,
    geometry: object,
    edit: shape(
      { field: text, value: number, enabled: { type: "boolean" }, id: text },
      ["field"],
    ),
  }),
  NEW_WORKFLOW: object,
  RESET_CURRENT_DRAFT: shape(),
  LOAD_MING_GOD_EXAMPLE: shape(),
  OPEN_WORKFLOW: shape({ id: text }, ["id"]),
  OPEN_DOCUMENT: shape(
    {
      config: object,
      graph: object,
      vertexTransform: { anyOf: [object, { type: "null" }] },
      closeDialog: { type: "boolean" },
    },
    ["config", "graph"],
  ),
  DELETE_WORKFLOW: shape({ id: text }, ["id"]),
  IMPORT_WORKFLOW_DATA: shape({ workflow: object }, ["workflow"]),
  SET_PROJECT_CONFIG: shape({
    id: text,
    title: text,
    className: text,
    shaderDir: text,
    blendMode: { enum: ["alpha", "additive"] },
    previewWidth: number,
    previewHeight: number,
  }),
  SET_VERTEX_TRANSFORM: object,
  SET_RUNTIME_PATH: shape(
    { path: { type: "string", pattern: "^[A-Za-z_]\\w*(?:/[A-Za-z_]\\w*)*$" } },
    ["path"],
  ),
  SET_VIEW: shape({ x: number, y: number, zoom: number }),
  SET_SELECTION: shape({ nodeIds: ids }, ["nodeIds"]),
  DELETE_SELECTED: shape(),
  DISCONNECT_SELECTED: shape(),
  TOGGLE_SELECTED_PREVIEW: shape({ enabled: { type: "boolean" } }),
  SAVE_SELECTION_AS_WORKFLOW_NODE: shape({ title: text }),
  EXPAND_WORKFLOW_NODE: shape(
    { workflowNodeId: text, canvasX: number, canvasY: number },
    ["workflowNodeId"],
  ),
  DELETE_WORKFLOW_NODE: shape({ id: text }, ["id"]),
  UPSERT_CUSTOM_NODE: shape({ definition: object }, ["definition"]),
  DELETE_CUSTOM_NODE: shape({ typeId: text }, ["typeId"]),
  ADD_DEMO: shape(),
  AUTO_LAYOUT: shape({
    direction: { enum: ["LR", "TB"] },
    gapX: number,
    gapY: number,
    startX: number,
    startY: number,
  }),
});
/** 在任何副作用前验证动作，详细领域合法性由对应应用服务验证。 */
export function validateAction(type, payload) {
  const schema = ACTION_SCHEMAS[type];
  if (!schema) throw new Error(`未知应用命令：${type}`);
  validateValue(payload, schema, type);
}

/** 图参数先按公共契约检查，再交由图语义检查端口、引用和命名。 */
export function validateGraphCommand(type, payload) {
  const schema = GRAPH_PAYLOAD_SCHEMAS[type];
  if (!schema)
    throw new ContractError(
      "INVALID_ARGUMENT",
      `未知节点命令：${type}`,
      "type",
    );
  validateValue(payload, schema, type);
}

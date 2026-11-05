/** 自动生成，请修改 commands.mjs / workflow-edit.mjs，再运行 pnpm contracts:generate。
 * 结构类型与运行时 schema 共源，有限数值、长度和正则约束在调用时检查。
 * 开放对象的未知字段必须先收窄，local 组件/函数接口不由 JSON schema 生成。 */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ContractErrorCode = "INVALID_SCHEMA" | "INVALID_ARGUMENT" | "INVALID_REGISTRATION" | "CONFLICT" | "NOT_FOUND" | "PERMISSION_DENIED" | "API_REVOKED" | "OPERATION_FAILED";
export type GraphPayloads = {
  "ADD_NODE": { "node": { "id": string; "typeId": string; "title"?: string; "properties": { [key: string]: unknown; }; "canvasX": number; "canvasY": number; "plugin"?: { "id": string; "version": string; }; "portSnapshot"?: { "inputs": Array<{ "name": string; "type": string; [key: string]: unknown; }>; "outputs": Array<{ "name": string; "type": string; [key: string]: unknown; }>; [key: string]: unknown; }; [key: string]: unknown; }; [key: string]: unknown; };
  "REMOVE_NODE": { "nodeId": string; [key: string]: unknown; };
  "MOVE_NODE": { "nodeId": string; "x": number; "y": number; [key: string]: unknown; };
  "CONNECT": { "link": { "fromNode": string; "fromSocket": string; "toNode": string; "toSocket": string; [key: string]: unknown; }; [key: string]: unknown; };
  "DISCONNECT": { "link": { "fromNode": string; "fromSocket": string; "toNode": string; "toSocket": string; [key: string]: unknown; }; [key: string]: unknown; };
  "SET_PROPERTY": { "nodeId": string; "key": string; "value": JsonValue; [key: string]: unknown; };
  "RENAME_NODE": { "nodeId": string; "title": string; [key: string]: unknown; };
  "RENAME_NODE_ID": { "nodeId": string; "id": string; [key: string]: unknown; };
  "SET_OUTPUT": { "nodeId": string; [key: string]: unknown; };
};
export type ApplicationPayloads = {
  "UNDO": { [key: string]: unknown; };
  "REDO": { [key: string]: unknown; };
  "SET_STAGE": { "stage": "vertex" | "fragment"; [key: string]: unknown; };
  "SAVE_WORKFLOW": { "config"?: { [key: string]: unknown; }; [key: string]: unknown; };
  "PROJECT_FILE": { "operation": "status" | "open" | "openSaved" | "save" | "reload" | "recover" | "backup"; "fileId"?: string; "id"?: string; "recoveryId"?: string; "conflictVersion"?: (string | null); };
  "RESTORE_PROJECT_DOCUMENT": { "document": { [key: string]: unknown; }; [key: string]: unknown; };
  "EXPORT_RUNTIME": { "download"?: boolean; [key: string]: unknown; };
  "EXPORT_RUNTIME_DEPENDENCY": { "runtimePath"?: string; [key: string]: unknown; };
  "DESCRIBE_EXPORT_CONFIGURATION": { "runtimePath"?: string; "geometry"?: { [key: string]: unknown; }; "edit"?: { "field": string; "value"?: number; "enabled"?: boolean; "id"?: string; [key: string]: unknown; }; [key: string]: unknown; };
  "NEW_WORKFLOW": { [key: string]: unknown; };
  "RESET_CURRENT_DRAFT": { [key: string]: unknown; };
  "LOAD_MING_GOD_EXAMPLE": { [key: string]: unknown; };
  "OPEN_WORKFLOW": { "id": string; [key: string]: unknown; };
  "OPEN_DOCUMENT": { "config": { [key: string]: unknown; }; "graph": { [key: string]: unknown; }; "vertexTransform"?: ({ [key: string]: unknown; } | null); "closeDialog"?: boolean; [key: string]: unknown; };
  "DELETE_WORKFLOW": { "id": string; [key: string]: unknown; };
  "IMPORT_WORKFLOW_DATA": { "workflow": { [key: string]: unknown; }; [key: string]: unknown; };
  "SET_PROJECT_CONFIG": { "id"?: string; "title"?: string; "className"?: string; "shaderDir"?: string; "blendMode"?: "alpha" | "additive"; "previewWidth"?: number; "previewHeight"?: number; [key: string]: unknown; };
  "SET_VERTEX_TRANSFORM": { [key: string]: unknown; };
  "SET_RUNTIME_PATH": { "path": string; [key: string]: unknown; };
  "SET_VIEW": { "x"?: number; "y"?: number; "zoom"?: number; [key: string]: unknown; };
  "SET_SELECTION": { "nodeIds": Array<string>; [key: string]: unknown; };
  "DELETE_SELECTED": { [key: string]: unknown; };
  "DISCONNECT_SELECTED": { [key: string]: unknown; };
  "TOGGLE_SELECTED_PREVIEW": { "enabled"?: boolean; [key: string]: unknown; };
  "SAVE_SELECTION_AS_WORKFLOW_NODE": { "title"?: string; [key: string]: unknown; };
  "EXPAND_WORKFLOW_NODE": { "workflowNodeId": string; "canvasX"?: number; "canvasY"?: number; [key: string]: unknown; };
  "DELETE_WORKFLOW_NODE": { "id": string; [key: string]: unknown; };
  "UPSERT_CUSTOM_NODE": { "definition": { [key: string]: unknown; }; [key: string]: unknown; };
  "DELETE_CUSTOM_NODE": { "typeId": string; [key: string]: unknown; };
  "ADD_DEMO": { [key: string]: unknown; };
  "AUTO_LAYOUT": { "direction"?: "LR" | "TB"; "gapX"?: number; "gapY"?: number; "startX"?: number; "startY"?: number; [key: string]: unknown; };
};
export type NodeCreationInput = { "typeId": string; "id"?: string; "title"?: string; "properties"?: { [key: string]: unknown; }; "x"?: number; "y"?: number; };
export type WorkflowEditInput = { "add"?: Array<{ "typeId": string; "id"?: string; "title"?: string; "properties"?: { [key: string]: unknown; }; "x"?: number; "y"?: number; }>; "remove"?: Array<string>; "connect"?: Array<{ "fromNode": string; "fromSocket": string; "toNode": string; "toSocket": string; }>; "disconnect"?: Array<{ "fromNode": string; "fromSocket": string; "toNode": string; "toSocket": string; }>; "output"?: string; };
export type WorkflowPropertyInput = { "nodeId": string; "key": string; "value": JsonValue; };

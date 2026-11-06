/** 插件 SDK 运行时入口，数据/类型契约不导入内核、UI 实现或插件实现。 */
export {
  API_VERSION,
  GRAPH_COMMANDS,
  EDITOR_ACTIONS,
  validateRequest,
} from "./contracts.mjs";
export { ir, validateExpression } from "./ir.mjs";
export {
  STAGES,
  DOCUMENT_VERSION,
  readDocument,
  createDocument,
  validateDocument,
} from "./document.mjs";
export { copyJson, validateValue } from "./schema.mjs";
export { ACTION_SCHEMAS, validateAction } from "./commands.mjs";

export { ContractError, CONTRACT_ERROR_CODES, errorDetails } from "./errors.mjs";
export { registration, ownRegistration, ownCleanup } from "./registration.mjs";
export { validateSchema } from "./schema-definition.mjs";

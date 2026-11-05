/** 公开边界的稳定错误类别，界面显示中文 message，调用方根据 code 分支。 */
export const CONTRACT_ERROR_CODES = Object.freeze([
  "INVALID_SCHEMA",
  "INVALID_ARGUMENT",
  "INVALID_REGISTRATION",
  "CONFLICT",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "API_REVOKED",
  "OPERATION_FAILED",
]);

export class ContractError extends Error {
  constructor(code, message, path) {
    super(message);
    this.name = "ContractError";
    this.code = code;
    if (path !== undefined) this.path = path;
  }
}

/** 返回可序列化诊断，不把堆栈、私有对象或异常 cause 传给插件。 */
export function errorDetails(error) {
  return {
    code: CONTRACT_ERROR_CODES.includes(error?.code)
      ? error.code
      : "OPERATION_FAILED",
    message: error?.message || String(error),
    ...(typeof error?.path === "string" ? { path: error.path } : {}),
  };
}

/** 未分类的提供者异常在公共 API 边界统一为操作失败，保留中文说明。 */
export function contractFailure(error) {
  if (CONTRACT_ERROR_CODES.includes(error?.code)) return error;
  const detail = errorDetails(error);
  return new ContractError(detail.code, detail.message, detail.path);
}

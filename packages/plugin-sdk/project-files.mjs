/** 项目文件操作协议，宿主只保存原文，文档语义由项目插件校验。 */
export const projectFileOperations = Object.freeze(
  Object.fromEntries(
    ["status", "open", "openSaved", "save", "reload", "recover", "backup"].map(
      (name) => [name, "studio.project-files." + name],
    ),
  ),
);
export const projectFileRequest = {
  type: "object",
  additionalProperties: false,
  required: ["operation"],
  properties: {
    operation: { enum: Object.keys(projectFileOperations) },
    fileId: { type: "string" },
    id: { type: "string" },
    recoveryId: { type: "string" },
    conflictVersion: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
};
/** 去除编辑器修订计数后比较内容，撤销回已保存内容不再显示脏标记。 */
export function projectContent(document) {
  const value = structuredClone(document);
  delete value.revision;
  for (const graph of Object.values(value.graphs)) delete graph.revision;
  return JSON.stringify(value);
}

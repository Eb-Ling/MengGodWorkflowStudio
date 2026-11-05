// 开发者状态/IO 夹具。用户验收独立使用发布版 MCP。
import { WorkflowRepository } from "../frontend/project/workflow-repository.js";
import { createNodeContributions } from "../frontend/application/node-contributions.js";
import { createDocumentController } from "../frontend/application/document-controller.js";
import { createWorkflowAccess } from "../frontend/application/workflow-api.js";
import { createNodeModel } from "../plugins/node-model/service.mjs";
import { nodeModelPlugin } from "../plugins/node-model/index.mjs";
export function memory() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
}
export function workspacePorts() {
  const local = memory(),
    session = memory();
  return {
    preferences: () => local,
    repository: () => new WorkflowRepository({ local, session }),
    contributions: createNodeContributions,
    document: createDocumentController,
    access: createWorkflowAccess,
    stage: () => "fragment",
    text() {},
    setStage() {},
  };
}
/** 开发夹具显式装配节点模型，编辑器不再创建或回收节点登记。 */
export function nodeModelFixture(ports = workspacePorts()) {
  return createNodeModel({ preferences: ports.preferences, contributions: createNodeContributions });
}
export function installNodeModel(host, ports = workspacePorts()) {
  host.provide("platform.node-registry", "1.0.0", { preferences: ports.preferences, contributions: createNodeContributions });
  host.register(nodeModelPlugin, { allowLocalApis: true });
}
export function installExportPorts(host) {
  host.provide("workflow.editor", "1.0.0", {
    subscribe: () => () => {},
    snapshot: () => ({
      project: { id: "test", runtimePath: "data/method" },
      fragmentGraph: {},
      vertexTransform: {},
      documentToken: "token",
      documentRevision: 0,
    }),
    report() {},
    execute: () => ({ ok: true }),
  });
  host.provide("workflow.project-files", "1.0.0", { save: async () => ({}) });
  host.provide("platform.export-storage", "1.0.0", memory());
  host.provide("platform.downloads", "1.0.0", { text() {}, zip() {} });
}

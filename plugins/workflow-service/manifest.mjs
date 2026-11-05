const local = (methods) => ({
  version: "1.0.0",
  transport: "local",
  scoped: true,
  methods,
});
export const workflowServiceManifest = {
  id: "studio.workflow-service",
  layer: 2,
  name: "工作流编辑与检查器能力",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "platform.workspace-state": "^1.0.0",
    "workflow.node-catalog": "^1.0.0",
  },
  capabilities: ["workflow.host", "nodes.read", "nodes.configure"],
  providesApis: {
    "workflow.library": local({
      read: { capability: "project.storage" },
      save: { capability: "project.storage" },
      backup: { capability: "project.storage" },
    }),
    "workflow.editor": local(
      Object.fromEntries(
        Object.entries({
          snapshot: "workflow.read",
          inspect: "workflow.read",
          execute: "workflow.write",
          edit: "workflow.write",
          addNode: "workflow.write",
          setProperty: "workflow.write",
          subscribe: "workflow.read",
          onActivity: "workflow.read",
          report: "ui.status",
          activity: "workflow.read",
        }).map(([k, capability]) => [k, { capability }]),
      ),
    ),
    "workflow.presentation": local({
      snapshot: { capability: "presentation.read" },
      edit: { capability: "presentation.read" },
      report: { capability: "ui.status" },
      activity: { capability: "workflow.read" },
    }),
  },
};

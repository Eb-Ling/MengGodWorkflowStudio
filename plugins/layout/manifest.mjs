import { api } from "../../packages/workflow-tools/index.mjs";
export const autoLayoutManifest = {
  id: "studio.layout", layer:2,
  name: "工作流自动布局",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "workflow.editor": "^1.0.0",
    "workflow.operations": "^1.0.0",
  },
  providesApis: { "workflow.layout": api(["plan", "arrange"], "layout.use") },
  capabilities: ["workflow.read", "workflow.write", "operations.register"],
};

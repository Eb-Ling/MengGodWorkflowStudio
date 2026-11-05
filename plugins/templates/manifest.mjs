import { api } from "../../packages/workflow-tools/index.mjs";
export const templatesManifest = {
  id: "studio.templates", layer:2,
  name: "工作流模板与示例",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "workflow.editor": "^1.0.0",
    "workflow.operations": "^1.0.0",
    "workflow.template-storage": "^1.0.0",
  },
  providesApis: {
    "workflow.templates": api(
      ["list", "save", "remove", "expand", "example"],
      "templates.use",
    ),
  },
  capabilities: [
    "workflow.read",
    "workflow.write",
    "templates.storage",
    "operations.register",
  ],
};

export const customNodesManifest = {
  id: "custom.glsl",
  name: "自定义 GLSL 节点",
  layer: 2,
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "workflow.nodes": "^1.0.0",
    "workflow.operations": "^1.0.0",
    "platform.browser": "^1.0.0",
  },
  capabilities: ["nodes.register", "operations.register"],
};

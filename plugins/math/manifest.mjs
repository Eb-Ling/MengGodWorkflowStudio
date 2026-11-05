/** 仅请求节点注册，不依赖任何其他插件。 */
export const mathManifest = {
  id: "studio.math", layer:2,
  name: "Math 数学与向量",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "workflow.nodes": "^1.0.0",
  },
  capabilities: ["nodes.register"],
};

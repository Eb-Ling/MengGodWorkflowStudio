/** 仅请求节点注册，不依赖任何其他插件。 */
export const sdfManifest = {
  id: "studio.sdf", layer:2,
  name: "SDF 距离与形状",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "workflow.nodes": "^1.0.0",
  },
  capabilities: ["nodes.register"],
};

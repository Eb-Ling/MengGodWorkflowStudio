/** 官方 Noise 插件仅注册 studio.noise.*，只请求节点贡献能力。 */
export const noiseManifest = {
  id: "studio.noise", layer:2,
  name: "Noise 噪声节点",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: { "workflow.nodes": "^1.0.0" },
  capabilities: ["nodes.register"],
};

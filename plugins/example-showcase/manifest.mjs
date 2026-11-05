import { LAYOUT_API } from "../../packages/example-layout-api/index.mjs";
/** 消费者声明接口 ID，不指定提供者的文件或加载顺序。 */
export const showcaseManifest = {
  id: "example.showcase", layer:3,
  name: "示例：双阶段事务与节点",
  developmentOnly: true,
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "workflow.interaction": "^1.0.0",
    "workflow.editor": "^1.0.0",
    "workflow.nodes": "^1.0.0",
    "studio.ui": "^1.0.0",
    [LAYOUT_API]: "^1.0.0",
  },
  capabilities: [
    "interaction.register",
    "workflow.read",
    "workflow.write",
    "nodes.read",
    "nodes.register",
    "ui.panels",
    "ui.renderers",
  ],
};

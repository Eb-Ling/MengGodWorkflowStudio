export const interactionManifest = {
  id: "studio.interaction", layer:2,
  name: "画布选择、显示顺序与布局策略",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: { "workflow.operations": "^1.0.0" },
  capabilities: ["operations.execute"],
  providesApis: {
    "workflow.interaction": {
      version: "1.0.0",
      transport: "local",
      scoped: true,
      methods: {
        register: { capability: "interaction.register" },
        list: { capability: "interaction.read" },
        subscribe: { capability: "interaction.read" },
        activate: { capability: "interaction.configure" },
        evaluate: { capability: "interaction.evaluate" },
      },
    },
  },
};

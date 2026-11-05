export const managerManifest = {
  id: "studio.plugin-manager",
  layer: 3,
  name: "插件管理",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "studio.ui": "^1.0.0",
    "studio.plugins": "^1.0.0",
  },
  capabilities: ["ui.panels", "plugins.manage"],
};

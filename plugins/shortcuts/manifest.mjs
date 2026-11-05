export const shortcutsManifest = {
  id: "studio.shortcuts", layer:2,
  name: "快捷键配置",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: { "studio.ui": "^1.0.0", "platform.browser": "^1.0.0" },
  capabilities: ["ui.panels"],
  providesApis: {
    "studio.shortcuts": {
      version: "1.0.0",
      transport: "local",
      scoped: true,
      methods: {
        register: { capability: "shortcuts.register" },
        list: { capability: "shortcuts.read" },
        subscribe: { capability: "shortcuts.read" },
        resolve: { capability: "shortcuts.resolve" },
        configure: { capability: "shortcuts.configure" },
        reset: { capability: "shortcuts.configure" },
      },
    },
  },
};

export const uiManifest = {
  id: "studio.ui", layer:2,
  name: "基础 UI 与工作区组件",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: { "platform.ui-shell": "^1.0.0" },
  capabilities: ["ui.shell.mount"],
  providesApis: {
    "studio.ui": {
      version: "1.0.0",
      transport: "local",
      scoped: true,
      values: ["components"],
      methods: Object.fromEntries(
        [
          "createScope",
          "addSettingsPanel",
          "addOverlay",
          "addView",
          "addRenderer",
          "addDock",
        ].map((name) => [
          name,
          { capability: name === "addRenderer" ? "ui.renderers" : "ui.panels" },
        ]),
      ),
    },
  },
};

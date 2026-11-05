export const previewManifest = {
  id: "studio.preview", layer:2,
  name: "GPU 预览与高清视框",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "studio.shortcuts": "^1.0.0",
    "workflow.editor": "^1.0.0",
    "workflow.compilation": "^1.0.0",
    "studio.ui": "^1.0.0",
  },
  providesApis: {
    "workflow.preview": {
      version: "1.0.0",
      transport: "local",
      scoped: true,
      methods: Object.fromEntries(
        ["mount", "frame", "open", "close", "status", "compilationStatus"].map((name) => [
          name,
          { capability: "preview.render" },
        ]),
      ),
    },
  },
  capabilities: [
    "shortcuts.register",
    "shortcuts.resolve",
    "workflow.read",
    "shaders.compile",
    "ui.panels",
  ],
};

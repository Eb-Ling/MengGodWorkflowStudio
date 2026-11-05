export const geometryUiManifest = {
  id: "studio.geometry-ui",
  layer: 3,
  name: "几何参数与实例预览面板",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "workflow.export": "^1.0.0",
    "workflow.workspace": "^1.0.0",
    "workflow.presentation": "^1.0.0",
    "workflow.preview": "^1.0.0",
    "studio.ui": "^1.0.0",
  },
  capabilities: [
    "export.read",
    "export.write",
    "workflow.read",
    "workflow.write",
    "presentation.read",
    "preview.render",
    "ui.panels",
  ],
};

export const starsectorManifest = {
  id: "studio.starsector",
  layer: 2,
  name: "Starsector 特效导出",
  version: "1.0.0",
  apiVersion: "1.0.0",
  providesApis: {
    "workflow.export": {
      version: "1.0.0",
      transport: "local",
      scoped: true,
      methods: Object.fromEntries(
        [
          "configuration",
          "guide",
          "dependency",
          "history",
          "prepareDependency",
          "exportDependency",
          "exportEffect",
          "sources",
          "readiness",
          "subscribe",
        ].map((name) => [
          name,
          {
            capability: ["exportDependency", "exportEffect"].includes(name)
              ? "export.write"
              : "export.read",
          },
        ]),
      ),
    },
  },
  requiredApis: {
    "workflow.editor": "^1.0.0",
    "workflow.project-files": "^1.0.0",
    "platform.export-storage": "^1.0.0",
    "platform.downloads": "^1.0.0",
    "workflow.compilation": "^1.0.0",
    "shader.backend.glsl": "^1.0.0",
    "workflow.operations": "^1.0.0",
    "platform.assets": "^1.0.0",
  },
  capabilities: [
    "workflow.read",
    "workflow.write",
    "ui.status",
    "project.files",
    "export.storage",
    "downloads.write",
    "shaders.compile",
    "shaders.emit",
    "operations.register",
    "assets.read",
  ],
};

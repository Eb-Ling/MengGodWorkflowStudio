export const projectFilesManifest = {
  id: "studio.project-files",
  layer: 2,
  name: "工作流存储与恢复",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "platform.workflow-file-picker": "^1.0.0",
    "workflow.editor": "^1.0.0",
    "workflow.operations": "^1.0.0",
    "platform.project-files": "^1.0.0",
    "workflow.library": "^1.0.0",
  },
  providesApis: {
    "workflow.file-selection": {
      version: "1.0.0",
      transport: "local",
      scoped: true,
      methods: { openFile: { capability: "project.files" } },
    },
    "workflow.project-files": {
      version: "1.0.0",
      methods: Object.fromEntries(
        [
          "status",
          "open",
          "openSaved",
          "save",
          "saveAs",
          "reload",
          "recover",
          "backup",
        ].map((name) => [
          name,
          {
            capability: "project.files",
            arguments: {
              type: "array",
              maxItems: 1,
              items: { type: "object" },
            },
            returns: { type: "object" },
          },
        ]),
      ),
    },
  },
  capabilities: [
    "project.file-picker",
    "workflow.read",
    "workflow.write",
    "operations.register",
    "project.storage",
  ],
};

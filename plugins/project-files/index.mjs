import { projectFilesManifest } from "./manifest.mjs";
import { createProjectFileService } from "./service.mjs";
import { projectFileOperations } from "../../packages/plugin-sdk/project-files.mjs";
export const projectFilesPlugin = {
  manifest: projectFilesManifest,
  activate(context) {
    const service = createProjectFileService({
      workflow: context.api("workflow.editor"),
      storage: context.api("platform.project-files"),
      library: context.api("workflow.library"),
    });
    context.onDispose(() => service.dispose());
    context.provide("workflow.file-selection", () => ({
      async openFile(file) {
        const workflow = context.api("workflow.editor"),
          source = workflow.snapshot();
        const selected = await context
          .api("platform.workflow-file-picker")
          .fromFile(file);
        workflow.inspect({
          documentId: source.project.id,
          documentToken: source.documentToken,
          stage: source.stage,
          expectedRevision: source.graph.revision,
          expectedDocumentRevision: source.documentRevision,
        });
        return service.open({ fileId: selected.fileId });
      },
    }));
    context.provide("workflow.project-files", service);
    context.api("workflow.operations").register(
      Object.entries(projectFileOperations).map(([name, id]) => ({
        id,
        title: "工作流文件 " + name,
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        run: (options) => service[name](options),
      })),
    );
  },
};

import { workspaceManifest } from "./manifest.mjs";
import { createWorkspaceService } from "./service.mjs";
export const workspacePlugin = {
  manifest: workspaceManifest,
  activate(context) {
    const service = createWorkspaceService({
      editor: context.api("workflow.editor"),
      ports: context.api("platform.workspace-execution"),
      preferences: context.api("platform.browser").preferences,
      exporter: context.hasApi("workflow.export")
        ? context.api("workflow.export")
        : null,
      files: context.hasApi("workflow.project-files")
        ? context.api("workflow.project-files")
        : null,
      templates: context.hasApi("workflow.templates")
        ? context.api("workflow.templates")
        : null,
      layout: context.hasApi("workflow.layout")
        ? context.api("workflow.layout")
        : null,
    });
    context.onDispose(() => service.dispose());
    context.provide("workflow.workspace", (owner, own) => ({
      ...service,
      preferences: () => service.preferences(owner),
      subscribe(fn) {
        const off = service.subscribe(fn);
        own(off);
        return off;
      },
      onActivity(fn) {
        const off = service.onActivity(fn);
        own(off);
        return off;
      },
    }));
  },
};

import { workflowServiceManifest } from "./manifest.mjs";
import { createWorkflowService } from "./service.mjs";
import { createPresentationApi } from "./presentation.mjs";
import { createNodeDescription } from "./descriptions.mjs";
import { createEditorApplication } from "./application.mjs";
/** 唯一 PluginHost 激活此提供者，宿主只提供状态提交与原始元数据端口。 */
export const workflowServicePlugin = {
  manifest: workflowServiceManifest,
  activate(context) {
    const app = createEditorApplication(
      context.api("platform.workspace-state"),
      context.api("workflow.node-catalog"),
    );
    context.onDispose(() => app.dispose());
    const port = app.workflowApi,
      metadata = app.workflowMetadata;
    context.provide("workflow.library", (owner) => {
      if (owner !== "studio.project-files")
        throw Error("工作流库只供存储能力持有");
      return app.libraryApi;
    });
    const presentation = createPresentationApi({
      snapshot: () => port.snapshot(),
      semantics: Object.fromEntries(
        [
          "nodeDef",
          "typeLabel",
          "typeKey",
          "typedPropertyType",
          "typedValueProperty",
          "normalizedConstantValue",
          "validateNodeProperty",
          "variableBranchOwner",
        ].map((name) => [name, (...args) => metadata[name](...args)]),
      ),
      parameters: {
        effectiveScope: (node) => metadata.effectiveScope(node),
        name: (node) => metadata.parameterName(node),
        list: () => metadata.parameters(),
      },
      describeNode: createNodeDescription((type) => metadata.typeLabel(type)),
      report: (message) => metadata.report(message),
      activity: () => metadata.activity(),
      typeOptions: () => metadata.typeOptions(),
    });
    const service = createWorkflowService(port, presentation);
    context.provide("workflow.editor", (_owner, own) => ({
      ...service,
      subscribe(listener) {
        const off = service.subscribe(listener);
        own(off);
        return off;
      },
      onActivity(listener) {
        const off = service.onActivity(listener);
        own(off);
        return off;
      },
    }));
    context.provide("workflow.presentation", () => presentation);
  },
};

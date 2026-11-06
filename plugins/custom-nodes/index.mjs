import { customNodesManifest } from "./manifest.mjs";
import { createComponentLibrary } from "./library.mjs";
export const customNodesPlugin = {
  manifest: customNodesManifest,
  activate(context) {
    const library = createComponentLibrary(
      context.api("workflow.nodes"),
      context.api("platform.browser").settings,
    );
    const typeId = { type: "string", minLength: 1 };
    const id = {
      type: "object",
      properties: { typeId },
      required: ["typeId"],
      additionalProperties: false,
    };
    context.api("workflow.operations").register([
      {
        id: context.pluginId + ".upsert",
        title: "保存 GLSL 节点组件",
        inputSchema: { type: "object" },
        outputSchema: id,
        run: (input) => library.upsert(input),
      },
      {
        id: context.pluginId + ".remove",
        title: "删除 GLSL 节点组件",
        inputSchema: id,
        outputSchema: id,
        run: (input) => library.remove(input.typeId),
      },
    ]);
  },
};

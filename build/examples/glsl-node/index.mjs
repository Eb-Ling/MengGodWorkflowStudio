import { defineGlslNode } from "@workflow/plugin-sdk/glsl-node";

/** 同一目录可以登记多个函数组件，两个着色阶段共用定义。 */
export const plugin = {
  activate(context) {
    const node = defineGlslNode({
      typeId: context.pluginId + ".tint",
      title: "暖色",
      targets: ["glsl-es-300", "glsl-430"],
      glsl: {
        name: "example_warm_tint",
        parameters: [{ name: "color", type: "VEC4", qualifier: "out" }],
        code: "color = vec4(1.0, 0.4, 0.2, 1.0);",
      },
    });
    context.api("workflow.nodes").register({ nodes: [node], compilers: [] });
  },
};

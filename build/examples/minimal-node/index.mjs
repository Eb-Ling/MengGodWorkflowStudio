import { ir } from "@workflow/plugin-sdk/ir";
// 只需一个节点 API，定义与两个目标的编译规则一起登记、一起回收。
export const plugin = {
  activate(context) {
    const typeId = context.pluginId + ".value";
    context.api("workflow.nodes").register({
      nodes: [
        {
          typeId,
          title: "我的数值",
          category: "教学",
          inputs: [],
          outputs: [{ name: "value", type: "FLOAT" }],
          properties: {},
          stages: ["vertex", "fragment"],
          targets: ["glsl-es-300", "glsl-430"],
        },
      ],
      compilers: ["glsl-es-300", "glsl-430"].map((target) => ({
        typeId,
        target,
        compile: () => ir.literal("FLOAT", 0.5),
      })),
    });
  },
};

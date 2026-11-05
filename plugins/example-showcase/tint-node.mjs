import { ir } from "../../packages/plugin-sdk/ir.mjs";
/** 声明默认属性、属性 schema、双阶段端口和两个编译目标。没有编译器私有依赖。 */
/** @returns {Parameters<import("../../packages/plugin-sdk/types").NodeApi["register"]>[0]} */
export function tintContribution() {
  const typeId = "example.showcase.tint";
  const definition = {
    typeId,
    title: "示例插件颜色",
    category: "扩展示例",
    inputs: [],
    outputs: [{ name: "color", type: "VEC4" }],
    properties: { red: 0.2, green: 0.6, blue: 1, alpha: 1 },
    propertySchema: {
      type: "object",
      required: ["red", "green", "blue", "alpha"],
      properties: Object.fromEntries(
        ["red", "green", "blue", "alpha"].map((key) => [
          key,
          { type: "number", minimum: 0, maximum: 1 },
        ]),
      ),
    },
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  };
  const compile = ({ node }) =>
    ir.call(
      "VEC4",
      "vec4",
      ["red", "green", "blue", "alpha"].map((key) =>
        ir.literal("FLOAT", Number(node.properties[key])),
      ),
    );
  return {
    nodes: [definition],
    compilers: definition.targets.map((target) => ({
      typeId,
      target,
      compile,
    })),
  };
}

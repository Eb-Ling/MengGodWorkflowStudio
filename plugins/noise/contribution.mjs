import { noiseNodes } from "./nodes.mjs";
import { compileNoise } from "./expressions.mjs";
/** 成对贡献十种节点及两个目标规则，返回全新定义，避免共享可变状态。 */
export function noiseContribution() {
  const nodes = noiseNodes.map((node) => ({
    ...structuredClone(node),
    typeId: node.typeId,
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  }));
  return {
    nodes,
    compilers: nodes.flatMap((node) =>
      node.targets.map((target) => ({
        typeId: node.typeId,
        target,
        compile: (context) => compileNoise(node.typeId, context),
      })),
    ),
  };
}

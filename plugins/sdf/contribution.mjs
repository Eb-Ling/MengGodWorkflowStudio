import { sdfNodes } from "./nodes.mjs";
import { compileSdf } from "./expressions.mjs";
/** 返回独立节点声明和两个目标的类型化 IR 规则。 */
export function sdfContribution() {
  const nodes = structuredClone(sdfNodes);
  return {
    nodes,
    compilers: nodes.flatMap((n) =>
      n.targets.map((target) => ({
        typeId: n.typeId,
        target,
        compile: (context) => compileSdf(context),
      })),
    ),
  };
}

import { mathNodes } from "./nodes.mjs";
import { compileMath } from "./expressions.mjs";
/** 返回独立节点声明和两个目标的类型化 IR 规则。 */
export function mathContribution() {
  const nodes = structuredClone(mathNodes);
  return {
    nodes,
    compilers: nodes.flatMap((n) =>
      n.targets.map((target) => ({
        typeId: n.typeId,
        target,
        compile: (context) => compileMath(context),
      })),
    ),
  };
}

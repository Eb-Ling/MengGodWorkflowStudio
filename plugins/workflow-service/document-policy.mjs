import { createGraphSemantics } from "../../packages/workflow-tools/graph-semantics.mjs";
import { starterGraph } from "../../packages/workflow-tools/defaults.mjs";
import { normalizeTransform } from "../../packages/workflow-tools/geometry.mjs";
export function documentPolicy(getCatalog) {
  const semantics = (stage) => createGraphSemantics(getCatalog, () => stage);
  const policies = (stage) => {
    const rules = semantics(stage);
    return {
      starterGraph: () =>
        stage === "vertex" ? normalizeTransform().graph : starterGraph(),
      nodeTitle: (node) => rules.nodeDef(node)?.title || node.typeId,
      outputType: () => (stage === "vertex" ? "vertex.output" : "io.output"),
      connectionError: (graph, link) =>
        rules.isInvalidBranchConnection(graph, link) ? "分支连线越界" : null,
      resolveTypes: rules.resolveTypes,
      pruneInvalidLinks: rules.pruneInvalidLinks,
      validateCommand: rules.validateCommand,
    };
  };

  return {
    policies,
    validate(value) {
      normalizeTransform({ ...value.geometry, graph: value.graphs.vertex });
      for (const stage of ["vertex", "fragment"])
        semantics(stage).validateStageGraph(value.graphs[stage], stage);
    },
  };
}

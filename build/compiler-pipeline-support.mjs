import {createComponentLibrary} from "../plugins/custom-nodes/library.mjs";
import { createNodeCatalog } from "../plugins/node-model/node-catalog.mjs";
import { createNodeContributions } from "../frontend/application/node-contributions.js";
import { createGraphSemantics } from "../packages/workflow-tools/graph-semantics.mjs";
import { createGraphData } from "../packages/workflow-tools/graph-data.mjs";
import { createGraphSnapshotApi } from "../plugins/node-model/graph-snapshot.mjs";
import { mathContribution } from "../plugins/math/contribution.mjs";
import { sdfContribution } from "../plugins/sdf/contribution.mjs";
import { noiseContribution } from "../plugins/noise/contribution.mjs";
import { lowerGraph } from "../plugins/compiler/lower.mjs";
import {
  previewFragment,
  previewVertex,
} from "../plugins/compiler/preview.mjs";
import { emitModule } from "../plugins/glsl-backend/emitter.mjs";
import { normalizeTransform } from "../packages/workflow-tools/geometry.mjs";
export const backend = {
  emit: async (request) => emitModule(JSON.parse(JSON.stringify(request))),
};
export function pipelineHarness(stage = "fragment") {
  const contributions = createNodeContributions(createNodeCatalog()),
    handles = {};
  for (const [id, factory] of [
    ["studio.math", mathContribution],
    ["studio.sdf", sdfContribution],
    ["studio.noise", noiseContribution],
  ])
    handles[id] = contributions.registry.register(id, "1.0.0", factory());
  createComponentLibrary(contributions.createApi("custom.glsl"), {get: () => null});
  const semantics = createGraphSemantics(
      () => contributions.catalog,
      () => stage,
    ),
    data = createGraphData(semantics.nodeDef),
    snapshots = createGraphSnapshotApi({
      semantics,
      data,
      registry: contributions.registry,
    });
  const document = (graph, geometry = {}) => ({
    config: {
      className: "PipelineEffect",
      shaderDir: "data/shaders/workflow",
      runtimePath: "data/method",
    },
    fragment: graph,
    geometry: normalizeTransform(geometry),
  });
  const compilation = {
    describe: async (d) => snapshots.describe(d),
    lower: async (r) => lowerGraph(await snapshots.prepare(r)),
  };
  function emit(module, target) {
    const result = emitModule({ module, target });
    if (!result.ok) throw Error(JSON.stringify(result.diagnostics));
    return result.source;
  }
  function lower(graph, target = "glsl-430", stage = "fragment") {
    const d =
      stage === "vertex"
        ? document({ nodes: [], links: [], revision: 0 }, { graph })
        : document(graph);
    const output =
      graph.nodes.find((n) => n.id === graph.outputNodeId) ||
      graph.nodes.find((n) => n.typeId === "io.output");
    const sockets =
      output?.typeId === "vertex.output"
        ? ["position", "uv"]
        : output?.typeId === "io.output"
          ? ["color"]
          : [semantics.nodeDef(output).outputs[0].name];
    return lowerGraph(
      snapshots.prepare({
        document: d,
        target,
        stage,
        nodeId: output.id,
        sockets,
      }),
    );
  }
  return {
    ...contributions,
    handles,
    semantics,
    data,
    snapshots,
    document,
    compilation,
    backend,
    lower,
    emit,
    fragmentSource: (graph, target = "glsl-430") =>
      emit(previewFragment(lower(graph, target)), target),
    vertexModule: (graph) =>
      previewVertex(
        lower(graph, "glsl-430", "vertex"),
        normalizeTransform({ graph }),
      ),
  };
}

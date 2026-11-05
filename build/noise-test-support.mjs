import {pipelineHarness} from './compiler-pipeline-support.mjs';
/** 开发夹具统一经过实际编译前端和模块后端。 */
export function noiseHarness(target='glsl-430',stage='fragment'){
 const h=pipelineHarness(stage);return {...h,handle:h.handles['studio.noise'],mathHandle:h.handles['studio.math'],compiler:{...h.data,fragmentSource:g=>h.fragmentSource(g,target),vertexModule:g=>h.vertexModule(g),lower:(g,s=stage)=>h.lower(g,target,s)}};
}
export function noiseGraph(typeId, stage = "fragment") {
  const node = (id, typeId, properties = {}) => ({
    id,
    typeId,
    properties,
    canvasX: 0,
    canvasY: 0,
  });
  const graph = {
    revision: 0,
    outputNodeId: "noise",
    nodes: [
      node("uv", "input.uv"),
      node("split", "studio.math.vector.split", { valueType: "VEC2" }),
      node("z", "studio.math.constant", { valueType: "FLOAT", value: "0.37" }),
      node("noise", typeId),
    ],
    links: [],
  };
  const connect = (a, s, b, t) =>
    graph.links.push({ fromNode: a, fromSocket: s, toNode: b, toSocket: t });
  connect("uv", "uv", "split", "value");
  if (typeId.endsWith(".turbulence3")) {
    connect("split", "x", "noise", "x");
    connect("split", "y", "noise", "y");
    connect("z", "value", "noise", "z");
  } else if (typeId.endsWith(".turbulize"))
    connect("split", "x", "noise", "noise");
  else connect("uv", "uv", "noise", "uv");
  if (stage === "vertex") {
    graph.nodes.push(
      node("position", "input.position"),
      node("scale", "studio.math.vector.scale", { valueType: "VEC2" }),
      node("output", "vertex.output"),
    );
    connect("position", "value", "scale", "value");
    connect("noise", "value", "scale", "scale");
    connect("scale", "value", "output", "position");
    connect("uv", "uv", "output", "uv");
    graph.outputNodeId = "output";
  }
  return graph;
}

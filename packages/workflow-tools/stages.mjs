// Stage configuration is the only difference between the two workflow canvases.
export const stages = {
  fragment: { title: "片段工作流", output: "io.output", sockets: ["color"] },
  vertex: {
    title: "顶点工作流",
    output: "vertex.output",
    sockets: ["position", "uv"],
  },
};
export const stageNodes = [
  {
    typeId: "input.position",
    title: "局部顶点坐标",
    category: "输入输出",
    inputs: [],
    outputs: [{ name: "value", type: "VEC2" }],
    properties: {},
    stage: "vertex",
  },
  {
    typeId: "vertex.output",
    title: "顶点输出",
    category: "输入输出",
    inputs: [
      { name: "position", type: "VEC2" },
      { name: "uv", type: "VEC2" },
    ],
    outputs: [],
    properties: {},
    stage: "vertex",
  },
];
export function supportsStage(typeId, stage) {
  return typeId === "io.output"
    ? stage === "fragment"
    : ["input.position", "vertex.output"].includes(typeId)
      ? stage === "vertex"
      : true;
}

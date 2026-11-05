export function starterGraph() {
  const uv = {
    id: "uv_start",
    typeId: "input.uv",
    title: "UV 坐标",
    canvasX: 120,
    canvasY: 190,
    properties: { previewEnabled: true },
  };
  const center = {
    id: "center_start",
    typeId: "studio.math.vector.center",
    title: "中心化 UV",
    canvasX: 410,
    canvasY: 190,
    properties: { previewEnabled: true },
  };
  const length = {
    id: "length_start",
    typeId: "studio.math.vector.length",
    title: "长度",
    canvasX: 700,
    canvasY: 190,
    properties: { previewEnabled: true, valueType: "VEC2" },
  };
  center.plugin = { id: "studio.math", version: "1.0.0" };
  center.portSnapshot = {
    inputs: [{ name: "uv", type: "VEC2" }],
    outputs: [{ name: "value", type: "VEC2" }],
  };
  length.plugin = { id: "studio.math", version: "1.0.0" };
  length.portSnapshot = {
    inputs: [{ name: "value", type: "VEC2" }],
    outputs: [{ name: "length", type: "FLOAT" }],
  };
  return {
    schemaVersion: 1,
    projectId: "mvp-local",
    revision: 0,
    outputNodeId: null,
    nodes: [uv, center, length],
    links: [
      { fromNode: uv.id, fromSocket: "uv", toNode: center.id, toSocket: "uv" },
      {
        fromNode: center.id,
        fromSocket: "value",
        toNode: length.id,
        toSocket: "value",
      },
    ],
  };
}

/** 默认顶点图直接使用与片段一致的节点/连线协议。 */
export function defaultVertexGraph() {
  return {
    revision: 0,
    outputNodeId: "output",
    nodes: [
      {
        id: "position",
        typeId: "input.position",
        canvasX: 30,
        canvasY: 40,
        properties: { previewEnabled: false },
      },
      {
        id: "uv",
        typeId: "input.uv",
        canvasX: 30,
        canvasY: 220,
        properties: { previewEnabled: false },
      },
      {
        id: "output",
        typeId: "vertex.output",
        canvasX: 700,
        canvasY: 100,
        properties: { previewEnabled: false },
      },
    ],
    links: [
      {
        fromNode: "position",
        fromSocket: "value",
        toNode: "output",
        toSocket: "position",
      },
      { fromNode: "uv", fromSocket: "uv", toNode: "output", toSocket: "uv" },
    ],
  };
}

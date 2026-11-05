import { copyJson, validateValue } from "./schema.mjs";
export const STAGES = Object.freeze(["vertex", "fragment"]);
export const DOCUMENT_VERSION = "1.0.0";
const text = { type: "string", minLength: 1 };
export const NODE_SCHEMA = {
  type: "object",
  required: ["id", "typeId", "properties", "canvasX", "canvasY"],
  properties: {
    id: text,
    typeId: text,
    title: { type: "string" },
    properties: { type: "object" },
    canvasX: { type: "number" },
    canvasY: { type: "number" },
    plugin: {
      type: "object",
      required: ["id", "version"],
      properties: {
        id: { type: "string", pattern: "^[a-z][\\w.-]+$" },
        version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
      },
      additionalProperties: false,
    },
    portSnapshot: {
      type: "object",
      required: ["inputs", "outputs"],
      properties: Object.fromEntries(
        ["inputs", "outputs"].map((key) => [
          key,
          {
            type: "array",
            items: {
              type: "object",
              required: ["name", "type"],
              properties: { name: text, type: text },
            },
          },
        ]),
      ),
    },
  },
};
export const LINK_SCHEMA = {
  type: "object",
  required: ["fromNode", "fromSocket", "toNode", "toSocket"],
  properties: {
    fromNode: text,
    fromSocket: text,
    toNode: text,
    toSocket: text,
  },
  additionalProperties: false,
};
export const GRAPH_SCHEMA = {
  type: "object",
  required: ["nodes", "links"],
  properties: {
    nodes: { type: "array", items: NODE_SCHEMA },
    links: { type: "array", items: LINK_SCHEMA },
    revision: { type: "integer", minimum: 0 },
  },
};
export const DOCUMENT_SCHEMA = {
  type: "object",
  required: [
    "kind",
    "schemaVersion",
    "documentVersion",
    "revision",
    "project",
    "graphs",
    "geometry",
    "requiredPlugins",
  ],
  properties: {
    kind: { enum: ["studio.document"] },
    schemaVersion: { enum: [1] },
    documentVersion: { enum: [DOCUMENT_VERSION] },
    revision: { type: "integer", minimum: 0 },
    project: { type: "object", required: ["id"], properties: { id: text } },
    graphs: {
      type: "object",
      required: STAGES,
      properties: { vertex: GRAPH_SCHEMA, fragment: GRAPH_SCHEMA },
      additionalProperties: false,
    },
    geometry: { type: "object" },
    requiredPlugins: {
      type: "object",
      additionalProperties: { type: "string" },
    },
  },
  additionalProperties: false,
};

/** 校验文档结构与图引用，具体着色器类型/端口规则由应用的策略继续校验。 */
export function validateDocument(value) {
  validateValue(value, DOCUMENT_SCHEMA, "文档");
  for (const stage of STAGES) {
    const graph = value.graphs[stage],
      ids = new Set();
    for (const node of graph.nodes) {
      if (ids.has(node.id)) throw new Error(`${stage}：节点 ID 重复`);
      ids.add(node.id);
    }
    for (const link of graph.links)
      if (!ids.has(link.fromNode) || !ids.has(link.toNode))
        throw new Error(`${stage}：连线引用缺失节点`);
    if (graph.outputNodeId && !ids.has(graph.outputNodeId))
      throw new Error(`${stage}：输出节点不存在`);
  }
  const required = documentDependencies(value.graphs);
  if (Object.keys(value.requiredPlugins).length !== Object.keys(required).length ||
      Object.entries(required).some(([id, version]) => value.requiredPlugins[id] !== version))
    throw Error("文档 requiredPlugins 与节点记录的插件来源不一致，原始数据未修改");
  return value;
}

/** 从节点来源推导当前文档的精确依赖，同一插件的冲突版本不能被后一个节点覆盖。 */
export function documentDependencies(graphs) {
  const required = new Map();
  for (const stage of STAGES)
    for (const node of graphs[stage].nodes) {
      if (!node.plugin) continue;
      const { id, version } = node.plugin;
      if (required.has(id) && required.get(id) !== version)
        throw Error(`文档插件版本冲突：${id} 同时记录 ${required.get(id)} 和 ${version}`);
      required.set(id, version);
    }
  return Object.fromEntries([...required].sort(([a], [b]) => a.localeCompare(b)));
}

/** 读取唯一支持的 v1.0 文档，拒绝其他格式，返回独立副本。 */
export function readDocument(input) {
  if (
    input?.kind !== "studio.document" ||
    input.documentVersion !== DOCUMENT_VERSION ||
    input.schemaVersion !== 1
  )
    throw new Error("仅支持当前 v1.0 studio.document 格式，不转换旧工作流");
  return validateDocument(copyJson(input));
}
/** 用当前协议创建文档，调用方必须提供两个阶段，不推测历史数据。 */
export function createDocument({ project, graphs, geometry = {} }) {
  return readDocument({
    kind: "studio.document",
    schemaVersion: 1,
    documentVersion: DOCUMENT_VERSION,
    revision: 0,
    project,
    graphs,
    geometry,
    requiredPlugins: documentDependencies(graphs),
  });
}

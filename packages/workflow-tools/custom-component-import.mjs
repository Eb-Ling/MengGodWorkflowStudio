import { readDocument, documentDependencies } from "../plugin-sdk/document.mjs";
const previousId = (id) => /^custom\.(?!glsl\.)/.test(id);
export const componentType = (id) =>
  previousId(id) ? "custom.glsl." + id.slice(7) : id;

/** 只接收原先没有插件所有者的编辑器节点。第三方记录即使同名也不能重新绑定。 */
export function adoptComponents(graph) {
  let changed = false;
  for (const node of graph.nodes) {
    if (node.plugin || !previousId(node.typeId)) continue;
    const p = node.properties || {};
    // 早期教学图只存类型，不存预设函数签名。
    const seedInputs = {
      "custom.radialFade": ["distance"],
      "custom.innerFade": ["distance", "time"],
    }[node.typeId];
    const parameters =
      p.parameters ||
      (seedInputs
        ? [
            ...seedInputs.map((name) => ({
              name,
              type: "FLOAT",
              qualifier: "in",
            })),
            { name: "value", type: "FLOAT", qualifier: "out" },
          ]
        : []);
    const ports = (skip) =>
      parameters
        .filter((v) => v.qualifier !== skip)
        .map((v) => ({
          name: v.name,
          type: String(v.type)
            .toUpperCase()
            .replace(/^SAMPLERCUBE$/, "SAMPLER_CUBE"),
        }));
    node.typeId = componentType(node.typeId);
    node.plugin = { id: "custom.glsl", version: "1.0.0" };
    // 节点早期使用 GLSL 拼写保存端口。统一成 SDK 类型，不改变端口名或连线。
    if (!node.portSnapshot && parameters.length)
      node.portSnapshot = { inputs: ports("out"), outputs: ports("in") };
    if (node.portSnapshot)
      for (const port of [
        ...node.portSnapshot.inputs,
        ...node.portSnapshot.outputs,
      ])
        port.type = port.type
          .toUpperCase()
          .replace(/^SAMPLERCUBE$/, "SAMPLER_CUBE");
    changed = true;
  }
  return changed;
}

/** 将当前 v1.0 文档读成独立副本，源文件只在用户正常保存时写入。 */
export function readWorkflowDocument(input) {
  const doc = readDocument(input);
  const vertex = adoptComponents(doc.graphs.vertex),
    fragment = adoptComponents(doc.graphs.fragment);
  if (vertex || fragment)
    doc.requiredPlugins = documentDependencies(doc.graphs);
  return doc;
}

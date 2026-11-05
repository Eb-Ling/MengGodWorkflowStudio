import { parameterId } from "./parameters.mjs";
import { sourceName } from "../plugin-sdk/ir.mjs";
/** 只读取节点参数与命名，不执行 shader 生成。 */
export function createGraphData(nodeDef) {
  function inputUniformName(node) {
    const raw = String(node.properties.uniform || "u_value");
    return /^u_[A-Za-z0-9_]+$/.test(raw) ? raw : "u_value";
  }
  function graphInputs(graph) {
    return graph.nodes
      .filter((node) => node.typeId === "io.input")
      .map((node) => {
        const type = nodeDef(node).outputs[0]?.type || "FLOAT";
        return {
          id: parameterId(node),
          nodeId: node.id,
          name: inputUniformName(node),
          type,
          scope: node.properties.scope || "shared",
          defaultValue:
            type === "BOOL"
              ? String(node.properties.defaultValue).toLowerCase() === "true"
              : /^VEC[234]$/.test(type)
                ? String(node.properties.defaultValue ?? 0)
                    .split(/[\s,]+/)
                    .filter(Boolean)
                    .map(Number)
                : Number(node.properties.defaultValue ?? 0) || 0,
        };
      })
      .filter(
        (item, index, all) =>
          all.findIndex((other) => other.name === item.name) === index,
      );
  }
  function graphTextureInputs(graph) {
    return graph.nodes
      .filter((node) => node.typeId === "input.texture")
      .map((node) => {
        return {
          id: parameterId(node),
          name: inputUniformName(node),
          nodeId: node.id,
          textureId: String(node.properties.textureId || "texture"),
        };
      })
      .filter(
        (item, index, all) =>
          all.findIndex((other) => other.name === item.name) === index,
      );
  }

  return {
    inputUniformName,
    graphInputs,
    graphTextureInputs,
    textureAspectUniformName: (n) => "u_textureAspect_" + sourceName(n),
  };
}

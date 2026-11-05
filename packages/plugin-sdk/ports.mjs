/** 动态端口的公开规则，编辑器和注册表共用，插件不自行修改连线类型。 */
export const DYNAMIC_KINDS = Object.freeze([
  "output",
  "all",
  "splitVector",
  "combineVector",
  "scaleVector",
  "mix",
  "vectorInput",
]);

/** 从声明与节点属性得到独立端口快照。AUTO 保持 ANY，由图推导后再编译。 */
export function resolveNodePorts(definition, properties = {}) {
  const result = structuredClone(definition);
  if (!result.dynamicKind) return result;
  const kind = result.dynamicKind;
  if (!DYNAMIC_KINDS.includes(kind)) throw new Error("未知动态端口规则");
  const value = properties.valueType || result.properties?.valueType || "AUTO";
  const type = value === "AUTO" ? "ANY" : value;
  if (kind === "splitVector") {
    result.inputs = result.inputs.map((p) => ({ ...p, type }));
    result.outputs = result.outputs.slice(
      0,
      { VEC2: 2, VEC3: 3, VEC4: 4 }[type] || 0,
    );
  } else if (kind === "combineVector") {
    result.inputs = result.inputs.slice(
      0,
      { VEC2: 2, VEC3: 3, VEC4: 4 }[type] || 2,
    );
    result.outputs = result.outputs.map((p) => ({
      ...p,
      type: type === "ANY" ? "VEC2" : type,
    }));
  } else {
    if (kind !== "output")
      result.inputs = result.inputs.map((p) => ({
        ...p,
        type:
          (kind === "mix" && p.name === "t") ||
          (kind === "scaleVector" && p.name === "scale")
            ? "FLOAT"
            : type,
      }));
    if (kind !== "vectorInput")
      result.outputs = result.outputs.map((p) => ({ ...p, type }));
  }
  return result;
}

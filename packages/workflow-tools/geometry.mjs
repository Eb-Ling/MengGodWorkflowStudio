import { defaultVertexGraph } from "./defaults.mjs";

/** 当前四顶点平面的可调字段，名称用于工作流数据，不定义目标语言或缓冲布局。 */
export const geometryFields = [
  { key: "tx", id: "translateX", label: "平移 X" },
  { key: "ty", id: "translateY", label: "平移 Y" },
  { key: "sx", id: "scaleX", label: "缩放 X" },
  { key: "sy", id: "scaleY", label: "缩放 Y" },
  { key: "rotation", id: "rotation", label: "旋转（度）" },
  ...Array.from({ length: 4 }, (_, i) =>
    [0, 1].map((axis) => ({
      key: `v${i}${axis ? "y" : "x"}`,
      id: `vertex${i}${axis ? "Y" : "X"}`,
      label: `顶点 ${i} ${axis ? "Y" : "X"}`,
      vertex: i,
      axis,
    })),
  ).flat(),
];
/** 读取标量或顶点分量，不改变几何快照。 */
export function geometryValue(transform, field) {
  return field.vertex === undefined
    ? transform[field.key]
    : transform.vertices[field.vertex][field.axis];
}
/** 将开启变化的几何字段投影为逐实例参数，存储方式由预览或导出目标决定。 */
export function geometryParameters(transform) {
  return geometryFields
    .filter((f) => transform.instanceInputs?.[f.key]?.enabled)
    .map((f) => ({
      id: transform.instanceInputs[f.key].id || f.id,
      name: "u_wf_geometry_" + f.key,
      type: "FLOAT",
      scope: "instance",
      geometryKey: f.key,
      defaultValue: geometryValue(transform, f),
    }));
}
/** 合并用户设置的共享或逐实例作用域，不分配 GPU 槽位或生成调用代码。 */
export function effectiveParameters(inputs, transform) {
  return inputs.map((p) => ({
    ...p,
    scope: transform.parameterModes?.[p.name] ?? p.scope ?? "shared",
  }));
}

/** 几何配置校验，不编译或转换其他顶点图格式。 */
export function normalizeTransform(value = {}) {
  const instanceInputs = Object.fromEntries(
    geometryFields
      .filter((f) => value.instanceInputs?.[f.key])
      .map((f) => {
        const input = value.instanceInputs[f.key];
        if (typeof input.enabled !== "boolean" || typeof input.id !== "string")
          throw new Error("无效几何参数开关：" + f.label);
        return [f.key, { enabled: input.enabled, id: input.id }];
      }),
  );
  const parameterModes = { ...value.parameterModes };
  for (const mode of Object.values(parameterModes))
    if (!["shared", "instance"].includes(mode))
      throw new Error("无效参数变化模式");
  const number = (key, fallback) => {
    const v = Number(value[key] ?? fallback);
    if (!Number.isFinite(v)) throw new Error(`顶点 ${key} 必须为有限数`);
    return v;
  };
  const vertices = value.vertices ?? [
    [-180, -90],
    [180, -90],
    [-180, 90],
    [180, 90],
  ];
  if (
    vertices.length !== 4 ||
    vertices.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        p.some((v) => !Number.isFinite(Number(v))),
    )
  )
    throw new Error("需要四个有效的二维顶点");
  const graph = value.graph ?? defaultVertexGraph();
  if (
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.links) ||
    graph.nodes.length > 256
  )
    throw new Error("顶点图必须使用当前 nodes/links 格式");
  const ids = new Set();
  for (const n of graph.nodes) {
    if (
      typeof n.id !== "string" ||
      !n.id ||
      ids.has(n.id) ||
      typeof n.typeId !== "string"
    )
      throw new Error("无效或重复顶点节点");
    ids.add(n.id);
  }
  return {
    vertices: vertices.map((p) => p.map(Number)),
    tx: number("tx", 0),
    ty: number("ty", 0),
    sx: number("sx", 1),
    sy: number("sy", 1),
    rotation: number("rotation", 0),
    instanceInputs,
    parameterModes,
    graph: structuredClone(graph),
  };
}

/** 从当前文档分配可读 ID，不使用全局计数器，重复展开和粘贴不会覆盖已有节点。 */
export function createNodeIdAllocator(existingIds = []) {
  const occupied = new Set(existingIds);
  return (preferred) => {
    const text = String(preferred || "node")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80);
    const base = /^[A-Za-z_]/.test(text) ? text : "node_" + text;
    let id = base,
      index = 2;
    while (occupied.has(id)) id = base + "_" + index++;
    occupied.add(id);
    return id;
  };
}
/** 新建、模板展开和粘贴统一按节点类型命名，模板中的 ID 仅用于重连映射。 */
export function nodeIdBase(typeId) {
  return typeId.split(".").at(-1);
}
/** 两个阶段共用命名空间，并避让用户已定义的参数名。 */
export function occupiedNodeIds(document) {
  return Object.values(document.graphs).flatMap((graph) =>
    graph.nodes.flatMap((node) =>
      [node.id, node.properties.parameterId].filter(Boolean),
    ),
  );
}

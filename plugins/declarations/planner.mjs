/** 有限工作流动作 → 公开事务，不持有 Store，也不执行脚本或任意 API 调用。 */
export function planAction(action, controls, snapshot) {
  const value = (v) =>
    v && typeof v === "object" ? controls.get(v.control)?.value : v;
  const selected = new Set(snapshot.selection);
  const nodes = snapshot.graph.nodes.filter(
    (n) =>
      action.target === "all" ||
      (action.target === "selection-or-all" && !selected.size) ||
      selected.has(n.id),
  );
  const guard = {
    documentId: snapshot.project.id,
    documentToken: snapshot.documentToken,
    stage: snapshot.stage,
    expectedRevision: snapshot.graph.revision,
    expectedDocumentRevision: snapshot.document.revision,
  };
  if (action.kind === "summary")
    return {
      message: `${snapshot.stage === "vertex" ? "顶点" : "片段"}：${snapshot.graph.nodes.length} 个节点，选中 ${selected.size} 个。`,
    };
  if (["undo", "redo", "stage"].includes(action.kind))
    return {
      request: {
        ...guard,
        actions: [
          {
            type:
              action.kind === "stage" ? "SET_STAGE" : action.kind.toUpperCase(),
            payload: action.kind === "stage" ? { stage: action.stage } : {},
          },
        ],
      },
      message: "操作已完成。",
    };
  if (nodes.length > 512) throw Error("一次最多操作 512 个节点，请缩小选区");
  if (!nodes.length) return { message: "没有符合条件的节点。" };
  let commands;
  if (action.kind === "move") {
    const dx = value(action.dx),
      dy = value(action.dy);
    if (
      ![dx, dy].every(
        (n) =>
          typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100000,
      )
    )
      throw Error("位移必须在 -100000 到 100000 之间");
    commands = nodes.map((n) => ({
      type: "MOVE_NODE",
      payload: { nodeId: n.id, x: n.canvasX + dx, y: n.canvasY + dy },
    }));
  } else if (action.kind === "rename") {
    const title = value(action.title);
    if (typeof title !== "string" || !title.trim() || title.length > 100)
      throw Error("节点名称需为 1–100 字");
    commands = nodes.map((n) => ({
      type: "RENAME_NODE",
      payload: { nodeId: n.id, title },
    }));
  } else throw Error("未开放的声明式动作");
  return {
    request: { ...guard, commands },
    message: `已${action.kind === "move" ? "移动" : "重命名"} ${nodes.length} 个节点，可一次撤销。`,
  };
}

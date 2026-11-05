import {
  branchOwner,
  branchSide,
} from "../../packages/workflow-tools/regions.mjs";
/** 控制区域整体平移，循环图按强连通分量分层，保持节点/连线/分支语义。 */
export function planLayout({
  graph,
  direction = "LR",
  gapX = 80,
  gapY = 60,
  startX = 80,
  startY = 80,
}) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links))
    throw Error("布局需要图快照");
  if (
    !["LR", "TB"].includes(direction) ||
    ![gapX, gapY, startX, startY].every(Number.isFinite) ||
    gapX < 16 ||
    gapY < 16
  )
    throw Error("布局方向或间距无效（间距至少 16）");
  const nodes = graph.nodes,
    byId = new Map(nodes.map((n) => [n.id, n])),
    parent = new Map(nodes.map((n) => [n.id, n.id]));
  if (
    byId.size !== nodes.length ||
    nodes.some((n) => ![n.canvasX, n.canvasY].every(Number.isFinite))
  )
    throw Error("布局节点 ID 或坐标无效");
  const find = (id) => {
      let p = parent.get(id);
      if (p !== id) {
        p = find(p);
        parent.set(id, p);
      }
      return p;
    },
    join = (a, b) => {
      parent.set(find(b), find(a));
    };
  const control = (n) => ["logic.if", "logic.for"].includes(n.typeId);
  const box = (n) => {
    let w = 226,
      h = 300;
    if (n.typeId === "logic.if") {
      w = Number(n.properties.trueWidth || 430) * 2 + 40;
      h = Number(n.properties.trueHeight || 300) + 48;
    }
    if (n.typeId === "logic.for") {
      w = Number(n.properties.width || 430);
      h = Number(n.properties.height || 300) + 48;
    }
    if (![w, h].every((v) => Number.isFinite(v) && v > 0))
      throw Error("控制区域尺寸无效");
    return { x: n.canvasX, y: n.canvasY, w, h };
  };
  const intersects = (a, b) =>
    a.x <= b.x + b.w &&
    a.x + a.w >= b.x &&
    a.y <= b.y + b.h &&
    a.y + a.h >= b.y;
  // 任一可交叠区域连为刚性组，避免布局改变 first-owner 的原有归属顺序。
  for (const c of nodes.filter(control))
    for (const n of nodes)
      if (n.id !== c.id && intersects(box(c), box(n))) join(c.id, n.id);
  const groups = new Map();
  for (const n of nodes) {
    const id = find(n.id);
    if (!groups.has(id)) groups.set(id, { id, nodes: [], edges: new Set() });
    groups.get(id).nodes.push(n);
  }
  for (const g of groups.values()) {
    const boxes = g.nodes.map(box);
    g.x = Math.min(...boxes.map((b) => b.x));
    g.y = Math.min(...boxes.map((b) => b.y));
    g.w = Math.max(...boxes.map((b) => b.x + b.w)) - g.x;
    g.h = Math.max(...boxes.map((b) => b.y + b.h)) - g.y;
  }
  for (const l of graph.links) {
    if (!byId.has(l.fromNode) || !byId.has(l.toNode))
      throw Error("布局连线端点不存在");
    const a = find(l.fromNode),
      b = find(l.toNode);
    if (a !== b) groups.get(a).edges.add(b);
  }
  let number = 0;
  const indices = new Map(),
    low = new Map(),
    stack = [],
    pending = new Set(),
    components = [];
  function visit(id) {
    indices.set(id, number);
    low.set(id, number++);
    stack.push(id);
    pending.add(id);
    for (const to of groups.get(id).edges) {
      if (!indices.has(to)) {
        visit(to);
        low.set(id, Math.min(low.get(id), low.get(to)));
      } else if (pending.has(to))
        low.set(id, Math.min(low.get(id), indices.get(to)));
    }
    if (low.get(id) === indices.get(id)) {
      const members = [];
      let item;
      do {
        item = stack.pop();
        pending.delete(item);
        members.push(item);
      } while (item !== id);
      components.push(members.sort());
    }
  }
  for (const id of [...groups.keys()].sort()) if (!indices.has(id)) visit(id);
  const componentOf = new Map();
  components.forEach((c, i) => c.forEach((id) => componentOf.set(id, i)));
  const predecessors = components.map(() => new Set());
  for (const g of groups.values())
    for (const to of g.edges) {
      const a = componentOf.get(g.id),
        b = componentOf.get(to);
      if (a !== b) predecessors[b].add(a);
    }
  const layers = new Map(),
    depth = (i) => {
      if (layers.has(i)) return layers.get(i);
      const d = Math.max(0, ...[...predecessors[i]].map((p) => depth(p) + 1));
      layers.set(i, d);
      return d;
    };
  components.forEach((_, i) => depth(i));
  const columns = new Map();
  components.forEach((members, i) => {
    const d = layers.get(i);
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d).push(...members.map((id) => groups.get(id)));
  });
  const positions = [];
  let primary = direction === "LR" ? startX : startY;
  for (const [, column] of [...columns].sort((a, b) => a[0] - b[0])) {
    let secondary = direction === "LR" ? startY : startX,
      size = 0;
    for (const g of column.sort((a, b) => a.id.localeCompare(b.id))) {
      const x = direction === "LR" ? primary : secondary,
        y = direction === "LR" ? secondary : primary;
      for (const n of g.nodes)
        positions.push({
          nodeId: n.id,
          x: n.canvasX - g.x + x,
          y: n.canvasY - g.y + y,
        });
      secondary +=
        (direction === "LR" ? g.h : g.w) + (direction === "LR" ? gapY : gapX);
      size = Math.max(size, direction === "LR" ? g.w : g.h);
    }
    primary += size + (direction === "LR" ? gapX : gapY);
  }
  const placed = {
    ...graph,
    nodes: nodes.map((n) => {
      const p = positions.find((p) => p.nodeId === n.id);
      return { ...n, canvasX: p.x, canvasY: p.y };
    }),
  };
  for (const n of nodes) {
    const before = branchOwner(graph, n),
      after = branchOwner(
        placed,
        placed.nodes.find((p) => p.id === n.id),
      );
    if (
      before?.id !== after?.id ||
      (before &&
        branchSide(before, n) !==
          branchSide(
            after,
            placed.nodes.find((p) => p.id === n.id),
          ))
    )
      throw Error("布局会改变控制区域，已取消");
  }
  return { positions, groups: groups.size, layers: columns.size };
}

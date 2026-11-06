import { reactive, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { branchOwner } from "../../packages/workflow-tools/regions.mjs";
/** 指针会话拥有临时草稿，只有松开时才通过公开命令提交。 */
export function createGraphGestures(s: any, root: any, measure: () => void) {
  const draft = reactive({
    positions: {} as Record<string, { x: number; y: number }>,
    view: null as any,
    navigating: false,
    pending: null as any,
    box: null as any,
  });
  const view = computed(() => draft.view || s.snapshot.value.view),
    selection = computed(() => s.snapshot.value.selection);
  let gesture: any = null,
    generation = 0,
    pointer: number | null = null;
  const world = (x: number, y: number) => {
    const b = root.value!.getBoundingClientRect();
    return {
      x: (x - b.left - view.value.x) / view.value.zoom,
      y: (y - b.top - view.value.y) / view.value.zoom,
    };
  };

  function capture(event: PointerEvent) {
    const pendingView = wheelTimer ? { ...view.value } : null;
    flushWheel();
    cancel();
    if (pendingView) draft.view = pendingView;
    pointer = event.pointerId;
    root.value?.focus({ preventScroll: true });
    root.value?.setPointerCapture(event.pointerId);
    s.workflow.activity();
  }
  function nodeDown(event: PointerEvent, node: any) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest(
        ".port,button,input,select,textarea,[contenteditable=true]",
      )
    )
      return;
    event.stopPropagation();
    s.model.custom = null;
    const ids =
      event.ctrlKey || event.metaKey
        ? selection.value.includes(node.id)
          ? selection.value.filter((id: string) => id !== node.id)
          : [...selection.value, node.id]
        : event.shiftKey
          ? [...new Set([...selection.value, node.id])]
          : selection.value.includes(node.id)
            ? selection.value
            : [node.id];
    void s.run(() => s.select(ids));
    if (!ids.includes(node.id)) return;
    startDrag(event, ids);
  }
  function startDrag(event: PointerEvent, ids: string[]) {
    capture(event);
    gesture = {
      kind: "nodes",
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      source: s.snapshot.value,
      nodes: s.snapshot.value.graph.nodes.filter((n: any) =>
        ids.includes(n.id),
      ),
      moved: false,
    };
  }
  function branchDown(event: PointerEvent, node: any) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const ids = [
      node.id,
      ...s.snapshot.value.graph.nodes
        .filter(
          (n: any) => branchOwner(s.snapshot.value.graph, n)?.id === node.id,
        )
        .map((n: any) => n.id),
    ];
    void s.run(() => s.select(ids));
    startDrag(event, ids);
  }
  function portDown(event: PointerEvent, port: any) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    capture(event);
    const link =
      port.direction === "input"
        ? s.snapshot.value.graph.links.find(
            (l: any) => l.toNode === port.nodeId && l.toSocket === port.socket,
          )
        : null;
    if (port.direction === "input" && !link) return;
    draft.pending = {
      ...port,
      link,
      cursor: world(event.clientX, event.clientY),
    };
    gesture = {
      kind: "wire",
      pointerId: event.pointerId,
      source: s.snapshot.value,
    };
    void measure();
  }
  function background(event: PointerEvent) {
    if (
      ![0, 1].includes(event.button) ||
      (event.target as HTMLElement).closest(
        ".workflow-node,.if-branches,.for-branch,.context-menu,dialog",
      )
    )
      return;
    event.preventDefault();
    capture(event);
    if (event.shiftKey && event.button === 0) {
      gesture = {
        kind: "box",
        source: s.snapshot.value,
        pointerId: event.pointerId,
        start: world(event.clientX, event.clientY),
      };
      draft.box = { ...gesture.start, width: 0, height: 0 };
      return;
    }
    gesture = {
      kind: "pan",
      source: s.snapshot.value,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: { ...view.value },
      moved: false,
    };
  }
  // 高频指针事件只保留最新位置。松开时先结算最后一笔位移。
  let moveFrame = 0, pendingMove: PointerEvent | null = null;
  function move(event: PointerEvent) {
    if (gesture?.pointerId !== event.pointerId) return;
    pendingMove = event;
    if (!moveFrame) moveFrame = requestAnimationFrame(flushMove);
  }
  function flushMove() {
    cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    if (pendingMove) applyMove(pendingMove);
    pendingMove = null;
  }
  function applyMove(event: PointerEvent) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x,
      dy = event.clientY - gesture.y;
    if (gesture.kind === "nodes") {
      if (Math.hypot(dx, dy) < 3 && !gesture.moved) return;
      gesture.moved = true;
      draft.positions = Object.fromEntries(
        gesture.nodes.map((n: any) => [
          n.id,
          {
            x: n.canvasX + dx / view.value.zoom,
            y: n.canvasY + dy / view.value.zoom,
          },
        ]),
      );
    } else if (gesture.kind === "pan") {
      gesture.moved ||= Math.hypot(dx, dy) >= 4;
      draft.navigating = gesture.moved;
      draft.view = {
        ...gesture.start,
        x: gesture.start.x + dx,
        y: gesture.start.y + dy,
      };
    } else if (gesture.kind === "box") {
      const end = world(event.clientX, event.clientY),
        start = gesture.start;
      draft.box = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      };
    } else if (draft.pending) {
      draft.pending = {
        ...draft.pending,
        cursor: world(event.clientX, event.clientY),
      };
    }
  }
  async function up(event: PointerEvent) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (pendingMove || gesture.kind === "pan" || gesture.kind === "nodes") pendingMove = event;
    flushMove();
    const current = gesture,
      turn = generation;
    gesture = null;
    try {
      if (current.kind === "nodes" && current.moved)
        await s.batch(
          current.nodes.map((n: any) => ({
            type: "MOVE_NODE",
            payload: { nodeId: n.id, ...draft.positions[n.id] },
          })),
          current.source,
        );
      else if (current.kind === "pan") {
        if (current.moved)
          await s.action(
            "SET_VIEW",
            draft.view || current.start,
            current.source,
          );
        else {
          s.model.custom = null;
          await s.select([], current.source);
        }
      } else if (current.kind === "box") {
        const b = draft.box;
        await s.select(
          s.interaction.evaluate({
            kind: "selection",
            input: {
              nodes: s.snapshot.value.graph.nodes,
              box: {...b},
              bounds: s.snapshot.value.graph.nodes.map((n: any) => {
                const el = root.value?.querySelector(
                  '[data-id="' + CSS.escape(n.id) + '"].workflow-node',
                );
                const r = el?.getBoundingClientRect();
                const p = r ? world(r.x, r.y) : { x: n.canvasX, y: n.canvasY };
                return {
                  id: n.id,
                  ...p,
                  width: r ? r.width / view.value.zoom : 206,
                  height: r ? r.height / view.value.zoom : 150,
                };
              }),
            },
          }).nodeIds,
          current.source,
        );
      } else if (current.kind === "wire" && draft.pending) {
        const p = draft.pending;
        if (p.direction === "input")
          await s.batch(
            [{ type: "DISCONNECT", payload: { link: p.link } }],
            current.source,
          );
        else {
          const t = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest<HTMLElement>(".port.input");
          if (t && root.value?.contains(t))
            await s.batch(
              [
                {
                  type: "CONNECT",
                  payload: {
                    link: {
                      fromNode: p.nodeId,
                      fromSocket: p.socket,
                      toNode: t.dataset.nodeId,
                      toSocket: t.dataset.socket,
                    },
                  },
                },
              ],
              current.source,
            );
        }
      }
    } catch (e: any) {
      s.report(e.message);
    } finally {
      if (turn === generation) cancel();
    }
  }
  function cancel() {
    generation++;
    cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    pendingMove = null;
    clearTimeout(wheelTimer);
    wheelTimer = undefined;
    gesture = null;
    if (pointer !== null && root.value?.hasPointerCapture(pointer))
      root.value.releasePointerCapture(pointer);
    pointer = null;
    if (Object.keys(draft.positions).length) draft.positions = {};
    draft.view = null;
    draft.navigating = false;
    wheelSource = null;
    draft.box = null;
    draft.pending = null;
  }
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  let wheelSource: any;
  function flushWheel() {
    if (!wheelTimer) return;
    clearTimeout(wheelTimer);
    wheelTimer = undefined;
    const turn = generation, value = draft.view, source = wheelSource;
    wheelSource = null;
    void s.run(() => s.action("SET_VIEW", { ...value }, source)).finally(() => {
      if (turn === generation && draft.view === value) { draft.view = null; draft.navigating = false; }
    });
  }
  function wheel(event: WheelEvent) {
    event.preventDefault();
    if (gesture) return;
    draft.navigating = true;
    if (!wheelTimer) wheelSource = s.snapshot.value;
    const b = root.value!.getBoundingClientRect(),
      before = { x: (event.clientX - b.left - view.value.x) / view.value.zoom, y: (event.clientY - b.top - view.value.y) / view.value.zoom },
      zoom = Math.max(
        0.35,
        Math.min(1.8, view.value.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)),
      );
    draft.view = {
        x: event.clientX - b.left - before.x * zoom,
        y: event.clientY - b.top - before.y * zoom,
        zoom,
    };
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(flushWheel, 120);
  }

  watch(
    [() => s.snapshot.value.documentToken, () => s.snapshot.value.stage],
    cancel,
  );
  onMounted(() => {
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  });
  onBeforeUnmount(() => {
    cancel();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("blur", cancel);
  });
  return {
    draft,
    view,
    world,
    nodeDown,
    portDown,
    branchDown,
    background,
    wheel,
    cancel,
  };
}

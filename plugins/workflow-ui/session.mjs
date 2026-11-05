import { reactive, shallowRef } from "vue";
import {
  createNodeIdAllocator,
  nodeIdBase,
  occupiedNodeIds,
} from "../../packages/workflow-tools/index.mjs";
const frozen = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) frozen(v);
  }
  return value;
};
/** 当前插件的视图会话。文档/选区从公开快照读取，草稿、剪贴板与指针状态不共享给其他插件。 */
export function createViewSession({
  workflow,
  preview,
  ui,
  preferences,
  interaction,
  shortcuts,
}) {
  const snapshot = shallowRef(frozen(workflow.snapshot())),
    projection = shallowRef(frozen(workflow.inspect()));
  const model = reactive({
    search: "",
    custom: null,
    message: "",
    timeEnabled: false,
    time: 0,
    collapsed: [],
    strategies: [],
    serial: 0,
    renameSignal: 0,
  });
  try {
    model.collapsed = JSON.parse(preferences.get("collapsed") || "[]");
  } catch {}
  let live = true,
    queued = false;
  const refresh = () => {
    if (queued || !live) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!live) return;
      const next = workflow.snapshot();
      if (
        next.documentToken !== snapshot.value.documentToken ||
        next.stage !== snapshot.value.stage
      ) {
        model.custom = null;
        model.timeEnabled = false;
        model.time = 0;
      }
      snapshot.value = frozen(next);
      projection.value = frozen(workflow.inspect());
      model.strategies = interaction?.list() || [];
      model.serial++;
    });
  };
  const stop = workflow.subscribe(refresh),
    stopStrategies = interaction?.subscribe(refresh);
  refresh();
  const report = (message) => {
    model.message = String(message);
    workflow.report(String(message));
  };
  const guard = (s = snapshot.value) => ({
    documentId: s.project.id,
    documentToken: s.documentToken,
    stage: s.stage,
    expectedRevision: s.graph.revision,
    expectedDocumentRevision: s.documentRevision,
  });
  async function execute(input, s = workflow.snapshot()) {
    if (!live) throw Error("工作流视图已停用");
    const result = await workflow.execute({ ...guard(s), ...input });
    if (!result.ok) throw Error(result.error);
    refresh();
    return result;
  }
  const action = (type, payload = {}, s = workflow.snapshot()) =>
    execute({ actions: [{ type, payload }] }, s);
  const batch = (commands, s = workflow.snapshot()) =>
    commands.length ? execute({ commands }, s) : Promise.resolve({ ok: true });
  const run = async (task) => {
    try {
      return await task();
    } catch (e) {
      report(e.message || e);
      return null;
    }
  };
  const select = (ids, source = workflow.snapshot()) =>
    action("SET_SELECTION", { nodeIds: ids }, source);
  const add = async (typeId, x, y) => {
    const {id}=await workflow.addNode({typeId,x,y});
    await select([id]);
    return id;
  };
  let clipboard = null;
  const copy = () => {
    const ids = new Set(snapshot.value.selection),
      graph = snapshot.value.graph,
      nodes = graph.nodes.filter((n) => ids.has(n.id));
    if (!nodes.length) throw Error("请先选择节点");
    const minX = Math.min(...nodes.map((n) => n.canvasX)),
      minY = Math.min(...nodes.map((n) => n.canvasY));
    clipboard = {
      nodes: nodes.map((n) => ({
        ...structuredClone(n),
        canvasX: n.canvasX - minX,
        canvasY: n.canvasY - minY,
      })),
      links: graph.links.filter(
        (l) => ids.has(l.fromNode) && ids.has(l.toNode),
      ),
    };
    report(`已复制 ${nodes.length} 个节点`);
    return clipboard;
  };
  const paste = async (p) => {
    if (!clipboard) throw Error("剪贴板没有节点");
    const allocate = createNodeIdAllocator(
      occupiedNodeIds(workflow.snapshot().document),
    );
    const ids = new Map(
      clipboard.nodes.map((n) => [n.id, allocate(nodeIdBase(n.typeId))]),
    );
    await batch([
      ...clipboard.nodes.map((n) => ({
        type: "ADD_NODE",
        payload: {
          node: {
            ...structuredClone(n),
            id: ids.get(n.id),
            canvasX: Math.round(p.x + n.canvasX),
            canvasY: Math.round(p.y + n.canvasY),
          },
        },
      })),
      ...clipboard.links.map((l) => ({
        type: "CONNECT",
        payload: {
          link: {
            ...l,
            fromNode: ids.get(l.fromNode),
            toNode: ids.get(l.toNode),
          },
        },
      })),
    ]);
    await select([...ids.values()]);
  };
  return {
    workflow,
    interaction,
    shortcuts,
    preview,
    ui,
    snapshot,
    projection,
    model,
    refresh,
    report,
    guard,
    execute,
    action,
    batch,
    run,
    select,
    add,
    copy,
    paste,
    hasClipboard: () => !!clipboard,
    async cut() {
      copy();
      await action("DELETE_SELECTED");
    },
    collapse(category) {
      model.collapsed = model.collapsed.includes(category)
        ? model.collapsed.filter((x) => x !== category)
        : [...model.collapsed, category];
      preferences.set("collapsed", JSON.stringify(model.collapsed));
    },
    document: () => {
      const s = snapshot.value;
      return {
        config: s.project,
        fragment: s.fragmentGraph,
        geometry: s.vertexTransform,
      };
    },
    dispose() {
      live = false;
      stop();
      stopStrategies?.();
      clipboard = null;
      model.custom = null;
    },
  };
}

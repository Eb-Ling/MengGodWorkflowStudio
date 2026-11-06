import { DocumentStore } from "../../packages/kernel/index.mjs";

/** 应用适配器：注入 GLSL 策略与存储端口，对画布保留只读图视图。 */
export function createDocumentController({
  service,
  policies,
  validate,
  getStage,
  onError,
}) {
  const initial = service.initialDocument();
  const core = new DocumentStore(initial, {
    policies,
    validate,
    onObserverError: onError,
  });
  // L2 只取得 L1 方法外观，不交付 DocumentStore 实例。
  const document = Object.fromEntries(
    [
      "revision",
      "commandState",
      "snapshot",
      "graph",
      "transact",
      "reset",
      "subscribe",
      "history",
      "undo",
      "redo",
    ].map((name) => [name, (...args) => core[name](...args)]),
  );
  service.attachDocument(document);
  const listeners = new Set();
  let dispatch = null,
    gesture = null;
  const emit = () => {
    for (const listener of listeners) {
      try {
        listener(store.snapshot());
      } catch (error) {
        onError(error);
      }
    }
  };
  const off = document.subscribe(emit);
  const store = {
    snapshot: () => document.graph(getStage()),
    node: (id) =>
      document.graph(getStage()).nodes.find((node) => node.id === id),
    batch: (items) =>
      document.transact({
        commands: items.map((item) => ({ ...item, stage: getStage() })),
        group: gesture,
      }),
    subscribe: (listener) => {
      listeners.add(listener);
      listener(store.snapshot());
      return () => listeners.delete(listener);
    },
    reset: (graph = policies(getStage()).starterGraph()) => {
      const result = document.transact({
        graphs: { [getStage()]: graph },
        label: "重置阶段",
      });
      if (!result.ok) throw new Error(result.error);
    },
    emit,
    checkpoint: () => {
      gesture = crypto.randomUUID();
    },
    endGesture: () => {
      gesture = null;
    },
    moveNodes: (items) =>
      dispatch(
        items.map((item) => ({
          type: "MOVE_NODE",
          payload: { nodeId: item.id, x: item.x, y: item.y },
        })),
      ),
    undo: () => document.undo(getStage()).ok,
    redo: () => document.redo(getStage()).ok,
    invalidate: emit,
  };
  return {
    dispose() {
      off();
      listeners.clear();
    },
    document,
    store,
    setDispatcher: (fn) => {
      dispatch = fn;
    },
    policies,
  };
}

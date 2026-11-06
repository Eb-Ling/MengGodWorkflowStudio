import { createCommandGateway } from "../../packages/kernel/index.mjs";

// The application composes private stores; UI graph controls and integrations use
// the same guarded transaction entry. The SDK facade never exposes the store.
export function createWorkflowAccess({
  snapshot,
  commandState = snapshot,
  store,
  action,
  session,
  document,
}) {
  const gateway = createCommandGateway({
    snapshot,
    commandState,
    graphTransaction: (items) => store.batch(items),
    documentTransaction: document
      ? (input) => {
          if (
            Object.keys(input).some(
              (key) => !["commands", "patch", "label"].includes(key),
            )
          )
            return { ok: false, error: "未知文档事务字段" };
          return document.transact(input);
        }
      : undefined,
    action,
  });
  const batch = (commands) => {
    if (!commands.length) return { ok: true };
    const current = commandState();
    return gateway.execute({
      documentId: current.project.id,
      documentToken: current.documentToken,
      stage: current.stage,
      expectedRevision: current.graph.revision,
      commands,
    });
  };
  return {
    action: (type, payload = {}) => {
      store.endGesture?.();
      const current = commandState();
      return gateway.execute({
        documentId: current.project.id,
        documentToken: current.documentToken,
        stage: current.stage,
        expectedRevision: current.graph.revision,
        actions: [{ type, payload }],
      });
    },
    api: Object.freeze({
      ...gateway,
      subscribe: session.subscribe,
      onActivity: session.onActivity,
    }),
    commands: Object.freeze({
      batch,
      command: (type, payload) => batch([{ type, payload }]),
      removeNodes: (ids) =>
        batch(
          [...new Set(ids)]
            .filter((id) => store.node(id))
            .map((nodeId) => ({ type: "REMOVE_NODE", payload: { nodeId } })),
        ),
    }),
  };
}

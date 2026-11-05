import { cloneData, validateRequest } from "../plugin-sdk/contracts.mjs";

// A public facade: consumers receive snapshots and results, never a mutable store.
export function createCommandGateway({
  snapshot,
  graphTransaction,
  documentTransaction,
  action,
}) {
  return Object.freeze({
    snapshot: () => cloneData(snapshot()),
    execute(request) {
      const failure = (error) => ({
        ok: false,
        error: error.message || String(error),
      });
      const success = (result) => ({
        ok: true,
        revision: snapshot().graph.revision,
        ...(snapshot().documentRevision !== undefined
          ? { documentRevision: snapshot().documentRevision }
          : {}),
        ...(result === undefined ? {} : { result: cloneData(result) }),
      });
      try {
        const { commands, actions, transaction } = validateRequest(request);
        const current = snapshot();
        if (
          request.documentId !== current.project.id ||
          request.documentToken !== current.documentToken
        )
          throw new Error("工作流已切换，请重新读取当前草稿");
        if (request.stage !== current.stage)
          throw new Error("着色阶段已切换，请重新读取当前草稿");
        if (
          !Number.isInteger(request.expectedRevision) ||
          request.expectedRevision !== current.graph.revision
        )
          throw new Error(
            `Revision conflict: expected ${request.expectedRevision}, current ${current.graph.revision}`,
          );
        if(request.expectedDocumentRevision!==undefined && request.expectedDocumentRevision!==current.documentRevision)
          throw Error('文档修订冲突，请重新读取快照');
        if (transaction) {
          if (!documentTransaction) throw new Error("宿主不支持文档事务");
          if (
            !Number.isInteger(request.expectedDocumentRevision) ||
            request.expectedDocumentRevision !== current.documentRevision
          )
            throw new Error("文档修订冲突，请重新读取快照");
          const result = documentTransaction(cloneData(transaction));
          if (!result.ok) return result;
        } else if (commands.length) {
          const result = graphTransaction(cloneData(commands));
          if (!result.ok) return result;
        } else {
          const result = action(actions[0].type, cloneData(actions[0].payload));
          if (result?.then) return result.then(success).catch(failure);
          return success(result);
        }
        return {
          ok: true,
          revision: snapshot().graph.revision,
          ...(snapshot().documentRevision !== undefined
            ? { documentRevision: snapshot().documentRevision }
            : {}),
        };
      } catch (error) {
        return failure(error);
      }
    },
  });
}

import {
  cloneData,
  validateRequest,
} from "../../packages/plugin-sdk/contracts.mjs";
import { readWorkflowCall } from "../../packages/plugin-sdk/workflow-edit.mjs";
import { readPreviewCall } from "../../packages/workflow-tools/preview-contract.mjs";
import { readPluginCall } from "../../packages/plugin-sdk/plugin-management.mjs";

// MCP owns transport leases and requests. Graph validation belongs to workflow.editor.
export function createBridgeService({
  now = Date.now,
  timeoutMs = 8000,
  leaseMs = 10000,
} = {}) {
  const editors = new Map(),
    pending = new Map();
  let activeId = null,
    sweepTimer,
    sequence = 0,
    disposed = false;
  const connected = () =>
    !disposed &&
    activeId &&
    now() - (editors.get(activeId)?.seenAt || 0) < leaseMs;
  const active = () => (connected() ? editors.get(activeId) : null);
  function requireIdentity(input) {
    if (!input?.editorId || !input?.incarnation)
      throw new Error("缺少编辑器身份，请重新加载页面");
  }
  function finish(id, result) {
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.offAccess?.();
    pending.delete(id);
    entry.resolve({ ...result, requestId: id });
  }
  function cancelEditor(editorId, message) {
    for (const [id, entry] of pending)
      if (entry.editorId === editorId)
        finish(id, { ok: false, error: message });
  }
  function expireEditors() {
    const time = now();
    for (const [id, editor] of editors) {
      if (time - editor.seenAt < leaseMs) continue;
      cancelEditor(id, "编辑器连接已过期");
      editors.delete(id);
      if (activeId === id) activeId = null;
    }
  }
  // 编辑器崩溃时没有 disconnect，桥接进程也必须自行丢弃旧文档和挂起的请求。
  function scheduleSweep() {
    if (sweepTimer || disposed || !editors.size) return;
    sweepTimer = setTimeout(() => {
      sweepTimer = undefined;
      expireEditors();
      scheduleSweep();
    }, leaseMs);
    sweepTimer.unref?.();
  }
  const api = {
    state() {
      const editor = active();
      return cloneData({
        ...editor?.state,
        source: editor ? "active_editor_draft" : "awaiting_active_editor",
        graph: editor?.state.graph || null,
        editorConnected: !!editor,
        activeEditorId: editor ? activeId : null,
      });
    },
    publish(input) {
      if (disposed) throw new Error("MCP 插件已停用");
      requireIdentity(input);
      if (!input.graph || !input.project || !input.documentToken)
        throw new Error("缺少工作流快照");
      expireEditors();
      const previous = editors.get(input.editorId);
      if (previous && previous.incarnation !== input.incarnation)
        cancelEditor(input.editorId, "编辑器已重新加载，操作已取消");
      editors.set(input.editorId, {
        state: cloneData(input),
        incarnation: input.incarnation,
        seenAt: now(),
      });
      scheduleSweep();
      return {
        ok: true,
        active: !!connected() && activeId === input.editorId,
        activeEditorId: connected() ? activeId : null,
      };
    },
    activate(input) {
      requireIdentity(input);
      const editor = editors.get(input.editorId);
      if (
        disposed ||
        !editor ||
        editor.incarnation !== input.incarnation ||
        now() - editor.seenAt >= leaseMs
      )
        throw new Error("请先发布当前编辑器快照");
      if (activeId && activeId !== input.editorId)
        cancelEditor(activeId, "活动编辑器已切换，操作已取消");
      activeId = input.editorId;
      return { ok: true, active: true, activeEditorId: activeId };
    },
    disconnect(input) {
      requireIdentity(input);
      let disconnected = false;
      if (editors.get(input.editorId)?.incarnation === input.incarnation) {
        disconnected = true;
        cancelEditor(input.editorId, "编辑器或 MCP 插件已关闭");
        editors.delete(input.editorId);
        if (activeId === input.editorId) activeId = null;
      }
      return { ok: true, disconnected };
    },
    submit(input, access) {
      access?.assertActive();
      const editor = active();
      if (!editor) throw new Error("工作区尚未连接，请打开工作流程序后稍候重试");
      const workflowCall = input.workflowCall
        ? readWorkflowCall(input.workflowCall)
        : null;
      const previewCall = input.previewCall
        ? readPreviewCall(input.previewCall)
        : null;
      const pluginCall = input.pluginCall ? readPluginCall(input.pluginCall) : null;
      if ([workflowCall, previewCall, pluginCall].filter(Boolean).length > 1) throw Error("一次请求只能调用一种能力");
      const capabilityCall = workflowCall || previewCall || pluginCall;
      if (
        capabilityCall &&
        (input.commands?.length || input.actions?.length || input.transaction)
      )
        throw Error("工作流能力调用不能混入其他事务");
      const { commands, actions, transaction } = capabilityCall
        ? { commands: [], actions: [] }
        : validateRequest(input);
      if (
        typeof input.documentId !== "string" ||
        typeof input.documentToken !== "string" ||
        !["vertex", "fragment"].includes(input.stage) ||
        !Number.isInteger(input.expectedRevision)
      )
        throw new Error(
          "写操作必须携带 documentId、documentToken、stage 与 expectedRevision，请先读取摘要",
        );
      if (pending.size >= 64) throw new Error("待处理请求过多");
      const snapshot = editor.state;
      if (
        transaction &&
        (!Number.isInteger(input.expectedDocumentRevision) ||
          input.expectedDocumentRevision !== snapshot.documentRevision)
      )
        throw new Error("文档修订冲突，请重读摘要");
      if (
        input.expectedRevision !== undefined &&
        input.expectedRevision !== snapshot.graph.revision
      )
        throw new Error(
          `Revision conflict: expected ${input.expectedRevision}, current ${snapshot.graph.revision}`,
        );
      for (const [key, expected] of [
        ["documentId", snapshot.project.id],
        ["documentToken", snapshot.documentToken],
        ["stage", snapshot.stage],
      ]) {
        if (input[key] !== undefined && input[key] !== expected)
          throw new Error("工作流或阶段已切换，请重新读取草稿");
      }
      const requestId = `mcp_${now()}_${++sequence}`;
      const envelope = cloneData({
        ...(capabilityCall
          ? {
              ...(workflowCall ? { workflowCall } : previewCall ? { previewCall } : { pluginCall }),
              expectedDocumentRevision:
                input.expectedDocumentRevision ?? snapshot.documentRevision,
            }
          : {}),
        commands,
        actions,
        ...(transaction
          ? {
              transaction,
              expectedDocumentRevision: input.expectedDocumentRevision,
            }
          : {}),
        documentId: snapshot.project.id,
        documentToken: snapshot.documentToken,
        stage: snapshot.stage,
        expectedRevision: snapshot.graph.revision,
      });
      return new Promise((resolve) => {
        const timer = setTimeout(
          () =>
            finish(requestId, {
              ok: false,
              error:
                "编辑器未及时确认，请重新读取草稿核对结果，已投递请求不会自动重放",
            }),
          timeoutMs,
        );
        pending.set(requestId, {
          editorId: activeId,
          incarnation: editor.incarnation,
          requestId,
          envelope,
          delivered: false,
          timer,
          resolve,
          access,
          offAccess: () => access?.signal.removeEventListener("abort", revoked),
        });
        function revoked() {
          finish(requestId, {
            ok: false,
            error: "接入凭据已撤销，未投递请求已取消",
          });
        }
        access?.signal.addEventListener("abort", revoked, { once: true });
        if (access?.signal.aborted) revoked();
      });
    },
    pull(input) {
      // 正常轮询即是心跳。仅已登记且仍有效的同代编辑器可续约，不抢占其他窗口。
      const known = editors.get(input.editorId);
      if (!known || known.incarnation !== input.incarnation || now() - known.seenAt >= leaseMs)
        return { cursor: sequence, requests: [], needsState: true };
      known.seenAt = now();
      const editor = active();
      if (
        !editor ||
        input.editorId !== activeId ||
        input.incarnation !== editor.incarnation
      )
        return { cursor: sequence, requests: [] };
      const requests = [];
      for (const entry of pending.values()) {
        try {
          entry.access?.assertActive();
        } catch {
          finish(entry.requestId, {
            ok: false,
            error: "接入凭据已过期，请重新配置",
          });
          continue;
        }
        if (
          entry.editorId === activeId &&
          entry.incarnation === editor.incarnation &&
          !entry.delivered
        ) {
          entry.delivered = true; // At-most-once delivery, including after a lost ACK/reload.
          requests.push({
            requestId: entry.requestId,
            ...cloneData(entry.envelope),
          });
        }
      }
      return { cursor: sequence, requests };
    },
    acknowledge(input) {
      const entry = pending.get(input.requestId);
      if (!entry) return { ok: true, ignored: true };
      if (
        input.editorId !== entry.editorId ||
        input.incarnation !== entry.incarnation ||
        !entry.delivered
      )
        throw new Error("只有接收该请求的编辑器可以确认");
      finish(
        input.requestId,
        input.ok === true
          ? {
              ok: true,
              revision: input.revision,
              ...(input.result === undefined
                ? {}
                : { result: cloneData(input.result) }),
            }
          : { ok: false, error: input.error || "编辑器拒绝操作" },
      );
      return { ok: true };
    },
    dispose() {
      disposed = true;
      clearTimeout(sweepTimer);
      for (const id of [...pending.keys()])
        finish(id, { ok: false, error: "MCP 插件已停用，待处理操作已取消" });
      editors.clear();
      activeId = null;
    },
  };
  return Object.freeze(api);
}

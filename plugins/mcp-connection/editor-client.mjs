// Browser-side transport uses only the public workflow and platform APIs.
import { readWorkflowCall } from "../../packages/plugin-sdk/workflow-edit.mjs";
import { readPreviewCall } from "../../packages/workflow-tools/preview-contract.mjs";
import { readPluginCall } from "../../packages/plugin-sdk/plugin-management.mjs";
export function createEditorClient({
  workflow,
  preview,
  plugins,
  extensionUi,
  platform,
  port,
  status = (_message) => {},
}) {
  const base = `http://127.0.0.1:${port}`;
  // Fresh identity per plugin activation also distinguishes tabs cloned by
  // window.open(), whose sessionStorage can initially be identical.
  const editorId = crypto.randomUUID();
  const incarnation = crypto.randomUUID(),
    identity = { editorId, incarnation };
  const abort = new AbortController();
  let disposed = false,
    pulling = false,
    pendingPublish = false,
    publishing = null,
    lastClaim = 0,
    hasState = false,
    dirty = true;
  async function request(route, input) {
    const response = await platform.fetch(base + route, {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]),
      ...(input
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        : {}),
    });
    const result = await response.json();
    if (!response.ok || result.ok === false)
      throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }
  function publish() {
    if (disposed) return Promise.resolve();
    pendingPublish = true;
    if (publishing) return publishing;
    publishing = (async () => {
      while (pendingPublish && !disposed) {
        pendingPublish = false;
        if (!dirty && hasState) continue;
        dirty = false;
        const result = await request("/v1/state", {
          ...workflow.snapshot(),
          ...identity,
        });
        hasState = true;
        if (!result.activeEditorId && !disposed) {
          await request("/v1/activate", identity);
          status("工作区已自动连接，AI 可按名称或 ID 选择工作流。");
        }
      }
    })().catch(error => { dirty = true; throw error; }).finally(() => {
      publishing = null;
    });
    return publishing;
  }
  async function activate(force = true) {
    if (disposed) throw new Error("MCP 插件已停用");
    if (!force && Date.now() - lastClaim < 750) return;
    lastClaim = Date.now();
    await publish();
    await request("/v1/activate", identity);
    if (!disposed) status("工作区已自动连接，AI 可按名称或 ID 选择工作流。");
  }
  let publishScheduled = false;
  const backgroundPublish = () => {
    dirty = true;
    if (publishScheduled) return;
    publishScheduled = true;
    queueMicrotask(() => {
      publishScheduled = false;
      publish().catch((error) => {
      if (!disposed) status("连接失败：" + error.message);
      });
    });
  };
  async function pull() {
    if (disposed || pulling) return;
    pulling = true;
    try {
      const result = await request(
        "/v1/commands?" + new URLSearchParams(identity),
      );
      if (result.needsState) { dirty = true; await publish(); }
      else if (dirty) await publish();
      for (const item of result.requests || []) {
        if (disposed) break;
        let outcome;
        try {
          if (item.workflowCall) {
            const call = readWorkflowCall(item.workflowCall),
              result = await workflow[call.method](
                ...(call.method === "inspect" ? [item] : [call.input, item]),
              );
            const current = workflow.snapshot();
            outcome = {
              ok: true,
              result,
              revision: current.graph.revision,
              documentRevision: current.documentRevision,
            };
          } else if (item.previewCall) {
            // 在实际执行时再次校验草稿身份及修订，避免队列等待期间切换文档。
            workflow.inspect(item);
            const call = readPreviewCall(item.previewCall),
              result = await preview[call.method](call.input);
            const current = workflow.snapshot();
            outcome = {
              ok: true,
              result,
              revision: current.graph.revision,
              documentRevision: current.documentRevision,
            };
          } else if (item.pluginCall) {
            workflow.inspect(item);
            const call = readPluginCall(item.pluginCall),
              { id } = call.input;
            // 连接链不能通过自身请求停用，否则没有可靠的完成确认。
            if (
              ["reload", "remove"].includes(call.method) ||
              (call.method === "setEnabled" && !call.input.enabled)
            ) {
              const impact = plugins.previewDisable(id);
              if (
                [...impact.stop, ...impact.restart].some((p) =>
                  [
                    "studio.mcp",
                    "studio.mcp-connection",
                    "studio.workspace",
                    "studio.plugin-service",
                  ].includes(p.id),
                )
              )
                throw Error("此操作会中断当前 MCP 接入，请在插件面板执行");
            }
            const result =
              call.method === "snapshot"
                ? plugins.snapshot()
                : call.method === "authorized"
                  ? await plugins.authorized()
                  : call.method === "inspectPanels"
                    ? await extensionUi.inspect({ owner: id })
                    : call.method === "registerAuthorized"
                      ? await plugins.registerAuthorized(
                          id,
                          call.input.authorizationId,
                        )
                      : call.method === "remove"
                        ? await plugins.remove(id, call.input.reviewKey)
                        : call.method === "previewDisable"
                          ? plugins.previewDisable(id)
                          : call.method === "reload"
                            ? await plugins.reload(id)
                            : await plugins.setEnabled(
                                id,
                                call.input.enabled,
                                call.input.reviewKey,
                              );
            const current = workflow.snapshot();
            outcome = {
              ok: true,
              result: result ?? plugins.snapshot(),
              revision: current.graph.revision,
              documentRevision: current.documentRevision,
            };
          } else outcome = await workflow.execute(item);
        } catch (error) {
          outcome = { ok: false, error: error.message || String(error) };
        }
        // 请求专属结果不进入周期性快照，过大结果明确拒绝，仍确认请求，避免桥接超时。
        if (JSON.stringify(outcome).length > 3500000)
          outcome = {
            ok: false,
            error: "操作结果超过 3.5 MB，请减小预览像素尺寸后重试",
          };
        await publish();
        if (disposed) break;
        await request("/v1/ack", {
          ...identity,
          requestId: item.requestId,
          ...outcome,
        });
        status(
          outcome.ok
            ? "MCP 操作已完成，修订 " + outcome.revision
            : "MCP 操作已拒绝：" + outcome.error,
        );
      }
    } catch (error) {
      if (!disposed) status("连接失败：" + error.message);
    } finally {
      pulling = false;
    }
  }
  const unsubscribe = workflow.subscribe(backgroundPublish);
  const activity = workflow.onActivity(() =>
    activate(false).catch((error) => {
      if (!disposed) status("连接失败：" + error.message);
    }),
  );
  const pollTimer = setInterval(pull, 250);
  activate().catch((error) => {
    if (!disposed) status("连接失败：" + error.message);
  });
  return {
    activate,
    async dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      clearInterval(pollTimer);
      unsubscribe();
      activity();
      try {
        await platform.fetch(base + "/v1/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(identity),
          keepalive: true,
          signal: AbortSignal.timeout(1000),
        });
      } catch {}
    },
  };
}

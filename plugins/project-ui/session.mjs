import { reactive, shallowRef } from "vue";
/** 当前插件的局部表单/对话框会话，写入只经过公开修订守卫。 */
export function createProjectSession({
  workflow,
  presentation,
  exporter,
  templates,
  files,
  picker,
  ui,
}) {
  const snapshot = shallowRef(workflow.snapshot()),
    model = reactive({
      importOpen: false,
      runtimeOpen: false,
      pendingExport: false,
      serial: 0,
    }),
    operationIds = shallowRef([]);
  let live = true,
    pendingToken = null;
  const refresh = () => {
    if (!live) return;
    const s = workflow.snapshot();
    if (s.documentToken !== snapshot.value.documentToken) {
      model.runtimeOpen = false;
      model.pendingExport = false;
      pendingToken = null;
    }
    snapshot.value = s;
    operationIds.value = ["studio.templates.example"];
    model.serial++;
  };
  const off = workflow.subscribe(refresh),
    offOps = exporter.subscribe(refresh);
  refresh();
  const guard = (s) => ({
    documentId: s.project.id,
    documentToken: s.documentToken,
    stage: s.stage,
    expectedRevision: s.graph.revision,
    expectedDocumentRevision: s.documentRevision,
  });
  async function action(type, payload = {}, source = workflow.snapshot()) {
    if (!live) throw Error("项目界面已停用");
    const r = await workflow.execute({
      ...guard(source),
      actions: [{ type, payload }],
    });
    if (!r.ok) throw Error(r.error);
    refresh();
    return r;
  }
  const report = (message) => {
    if (live) presentation.report({ message: String(message) });
  };
  async function run(task) {
    try {
      return await task();
    } catch (e) {
      report(e.message || e);
      return null;
    }
  }
  function runtime(pending = false) {
    model.pendingExport = pending;
    pendingToken = pending ? workflow.snapshot().documentToken : null;
    model.runtimeOpen = true;
  }
  async function exportEffect() {
    const s = workflow.snapshot();
    if (exporter.history({ path: s.project.runtimePath }).state !== "current") {
      runtime(true);
      return;
    }
    await action("EXPORT_RUNTIME", {}, s);
  }
  async function continueExport() {
    if (!live || pendingToken !== workflow.snapshot().documentToken)
      throw Error("导出请求来自已关闭的工作流");
    await action("EXPORT_RUNTIME");
    model.pendingExport = false;
    model.runtimeOpen = false;
    pendingToken = null;
  }
  return {
    files,
    picker,
    save: () => action("SAVE_WORKFLOW"),
    workflow,
    presentation,
    exporter,
    templates,
    ui,
    snapshot,
    model,
    operationIds,
    action,
    report,
    run,
    runtime,
    exportEffect,
    continueExport,
    dispose() {
      live = false;
      off();
      offOps();
      model.runtimeOpen = false;
      model.importOpen = false;
      model.pendingExport = false;
      pendingToken = null;
    },
  };
}

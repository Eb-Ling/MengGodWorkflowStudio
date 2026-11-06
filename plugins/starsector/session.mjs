import { runtimePackage } from "../../packages/starsector-contract/runtime.mjs";
/** 当前特效的导出会话：缓存、过期拒绝、保存顺序与依赖记录都属于导出插件。 */
export function createExportSession({
  service,
  workflow,
  files,
  history,
  downloads,
}) {
  let live = true,
    generation = 0,
    cache = null,
    last = null;
  const listeners = new Set();
  const snapshot = () => workflow.snapshot();
  const document = () => {
    const s = snapshot();
    return {
      config: s.project,
      fragment: s.fragmentGraph,
      geometry: s.vertexTransform,
    };
  };
  // 视口、选区和预览时间并不改变导出内容。
  const revisionKey = s => JSON.stringify([s.documentToken, s.documentRevision, s.catalogRevision]);
  let currentKey = revisionKey(snapshot());
  const key = () => revisionKey(workflow.revision?.() ?? snapshot());
  const emit = () => {
    for (const f of listeners)
      try {
        f();
      } catch {}
  };
  const assert = (s) => {
    const current = snapshot();
    if (
      !live ||
      s.documentToken !== current.documentToken ||
      s.documentRevision !== current.documentRevision ||
      s.catalogRevision !== current.catalogRevision
    )
      throw Error("工作流已改变或导出已停用，请重新导出");
  };
  const off = workflow.subscribe(() => {
    const next = key();
    if (next === currentKey) return;
    currentKey = next;
    generation++;
    cache = null;
    last = null;
    emit();
  });
  function request() {
    if (!live) throw Error("导出插件已停用");
    const id = key(),
      epoch = generation;
    if (cache?.key === id) return cache;
    const item = {
      key: id,
      state: "pending",
      value: null,
      error: null,
      promise: null,
    };
    cache = item;
    item.promise = Promise.resolve()
      .then(() => service.generate({ document: document() }))
      .then((value) => {
        if (!live || epoch !== generation || key() !== id)
          throw Error("编译结果已过期，请重试当前文档");
        item.state = "ready";
        item.value = value;
        return value;
      })
      .catch((error) => {
        item.state = "error";
        item.error = error;
        throw error;
      })
      .finally(() => {
        if (live && cache === item) emit();
      });
    item.promise.catch(() => {});
    return item;
  }
  const guard = (s) => ({
    documentId: s.project.id,
    documentToken: s.documentToken,
    stage: s.stage,
    expectedRevision: s.graph.revision,
    expectedDocumentRevision: s.documentRevision,
  });
  return {
    configuration: (options = {}) =>
      service.configuration({
        geometry: document().geometry,
        runtimePath: document().config.runtimePath,
        ...options,
      }),
    guide: (options = {}) =>
      service.guide({ document: document(), ...options }),
    dependency: (options) => service.dependency(options),
    history: (options) => history.status(options),
    async prepareDependency({ runtimePath }) {
      const configuration = service.configuration({ runtimePath }),
        dependency = await service.dependency({
          runtimePath: configuration.runtime.path,
        });
      return {
        configuration,
        dependency,
        status: history.status({ path: configuration.runtime.path }),
      };
    },
    async exportDependency({
      runtimePath = snapshot().project.runtimePath,
      download = false,
    } = {}) {
      const source = snapshot(),
        path = runtimePackage(runtimePath).replaceAll(".", "/"),
        dependency = await service.dependency({ runtimePath: path });
      assert(source);
      const r = await workflow.execute({
        ...guard(source),
        actions: [{ type: "SET_RUNTIME_PATH", payload: { path } }],
      });
      if (!r.ok) throw Error(r.error);
      if (download) downloads.text("WorkflowRuntime.java", dependency.content);
      history.recordExport({ path });
      emit();
      return { ...dependency, runtimePath: path };
    },
    async exportEffect({ download = true } = {}) {
      const source = snapshot(),
        sources = await request().promise;
      assert(source);
      if (
        history.status({ path: source.project.runtimePath }).state !== "current"
      )
        throw Error("请先在运行依赖设置中导出单个依赖 Java");
      const saved = await files.save();
      assert(source);
      if (saved?.cancelled) throw Error("保存已取消，未导出特效");
      last = structuredClone(sources);
      if (download)
        downloads.zip(source.project.className + ".zip", Object.values(last));
      workflow.report("已导出 1 个 Java + 2 个着色器");
      emit();
      return structuredClone(last);
    },
    sources: () => (last ? structuredClone(last) : null),
    readiness() {
      const item = request();
      return item.state === "ready"
        ? { ready: true, message: "双阶段编译与参数校验通过，可导出运行文件。" }
        : item.state === "error"
          ? { ready: false, message: "导出前校验失败：" + item.error.message }
          : { ready: false, pending: true, message: "正在编译当前工作流…" };
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispose() {
      live = false;
      generation++;
      cache = null;
      last = null;
      off();
      listeners.clear();
    },
  };
}

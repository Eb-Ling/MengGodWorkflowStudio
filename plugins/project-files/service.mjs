import { readDocument } from "../../packages/plugin-sdk/document.mjs";
import { projectContent } from "../../packages/plugin-sdk/project-files.mjs";

const guard = (s) => ({
  documentId: s.project.id,
  documentToken: s.documentToken,
  stage: s.stage,
  expectedRevision: s.graph.revision,
  expectedDocumentRevision: s.documentRevision,
});
/** 工作流文件会话：保留唯一编辑器文档，以内容版本保护磁盘写入。 */
export function createProjectFileService({
  workflow,
  storage,
  library,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let live = true,
    busy = false,
    restoring = false,
    last = workflow.snapshot(),
    file = library.read({ id: last.project.id })?.file || null,
    baseline = library.read({ id: last.project.id })?.document
      ? projectContent(library.read({ id: last.project.id }).document)
      : null,
    error = "",
    conflict = null,
    timer = null;
  let recoveryId = crypto.randomUUID(),
    recent = [],
    recoveries = [];
  const listeners = new Set();
  const dirty = () => {
    const record = file ? null : library.read({ id: last.project.id });
    const saved = file
      ? baseline
      : record
        ? projectContent(record.document)
        : null;
    return saved === null || projectContent(last.document) !== saved;
  };
  const view = () => ({
    available: storage.available,
    dirty: dirty(),
    busy,
    file: file ? { ...file } : null,
    saved: !!library.read({ id: last.project.id }) || !!file,
    error,
    conflict: conflict ? { ...conflict } : null,
    recent: structuredClone(recent),
    recoveries: structuredClone(recoveries),
  });
  const emit = () => {
    for (const listener of listeners) listener(view());
  };
  function checkpoint() {
    cancel(timer);
    timer = null;
    if (!storage.available) return;
    storage.checkpoint({
      id: recoveryId,
      record: dirty() ? { document: last.document, file, baseline } : null,
    });
  }
  function queuedCheckpoint() {
    cancel(timer);
    timer = schedule(() => {
      try {
        checkpoint();
      } catch (e) {
        error = "恢复草稿保存失败：" + e.message;
        emit();
      }
    }, 350);
  }
  const off = workflow.subscribe(() => {
    if (restoring) return;
    const next = workflow.snapshot();
    if (next.documentToken !== last.documentToken) {
      error = "";
      try {
        checkpoint();
      } catch (e) {
        error = "恢复草稿保存失败：" + e.message;
      }
      file = null;
      baseline = null;
      conflict = null;
      recoveryId = crypto.randomUUID();
    }
    if (
      next.documentToken !== last.documentToken ||
      next.documentRevision !== last.documentRevision
    ) {
      last = next;
      queuedCheckpoint();
      emit();
    }
  });
  async function status() {
    if (!live) throw Error("工作流存储插件已停用");
    if (storage.available) {
      [recent, recoveries] = await Promise.all([
        storage.list(),
        storage.recoveries(),
      ]);
    }
    return view();
  }
  async function run(task) {
    if (!live) throw Error("工作流存储插件已停用");
    if (busy) throw Error("工作流文件操作正在进行，请稍后重试");
    busy = true;
    error = "";
    emit();
    let cancelled = false;
    try {
      cancelled = (await task()) === false;
    } catch (e) {
      error = e.message;
      throw e;
    } finally {
      busy = false;
      if (live) {
        await status().catch((e) => {
          error = error || e.message;
        });
        emit();
      }
    }
    return { ...view(), cancelled };
  }
  function assertCurrent(source) {
    const now = workflow.snapshot();
    if (
      !live ||
      now.documentToken !== source.documentToken ||
      now.documentRevision !== source.documentRevision
    )
      throw Error("等待文件期间工作流已改变，请重新操作，当前修改已保留");
  }
  async function replace(document, source, binding, saved) {
    readDocument(document);
    assertCurrent(source);
    checkpoint();
    restoring = true;
    try {
      const result = await workflow.execute({
        ...guard(source),
        actions: [{ type: "RESTORE_PROJECT_DOCUMENT", payload: { document } }],
      });
      if (!result.ok) throw Error(result.error);
      recoveryId = crypto.randomUUID();
      file = binding;
      baseline = saved;
      last = workflow.snapshot();
      conflict = null;
      queuedCheckpoint();
    } finally {
      restoring = false;
    }
  }
  async function readFile(id, source) {
    const result = await storage.read({ fileId: id }),
      document = readDocument(JSON.parse(result.text));
    const { text, ...binding } = result;
    assertCurrent(source);
    library.save({ document, file: binding });
    await replace(document, source, binding, projectContent(document));
  }
  async function write(binding, expectedVersion, source) {
    checkpoint();
    let saved;
    try {
      saved = await storage.write({
        fileId: binding.fileId,
        expectedVersion,
        text: JSON.stringify(readDocument(source.document), null, 2) + "\n",
      });
    } catch (e) {
      // 冲突只属于原请求的文件与文档，另存目标不能污染已有绑定的覆盖确认。
      if (
        e.code === "CONFLICT" &&
        live &&
        workflow.snapshot().documentToken === source.documentToken &&
        file?.fileId === binding.fileId
      )
        conflict = { version: e.version ?? null, message: e.message };
      else if (e.code === "CONFLICT")
        e.message =
          "另存目标或原文档的磁盘版本已改变，请重新操作，当前草稿保留";
      throw e;
    }
    // 磁盘是已关联文件的来源，库保存同一快照及来源索引，下次打开库仍读磁盘。
    if (live && workflow.snapshot().documentToken === source.documentToken) {
      file = saved;
      last = workflow.snapshot();
    }
    try {
      library.save({ document: source.document, file: saved });
    } catch (e) {
      checkpoint();
      throw Error("文件已写入，但工作流库登记失败，草稿保留：" + e.message);
    }
    // 写入的是请求时快照。若用户已切换文档，不把旧文件重新绑定到新草稿。
    if (live && workflow.snapshot().documentToken === source.documentToken) {
      baseline = projectContent(source.document);
      conflict = null;
      checkpoint();
    }
  }
  const api = {
    status,
    subscribe(listener) {
      listeners.add(listener);
      listener(view());
      return () => listeners.delete(listener);
    },
    open: ({ fileId } = {}) =>
      run(async () => {
        const source = workflow.snapshot();
        checkpoint();
        const selected = fileId ? { fileId } : await storage.chooseOpen();
        if (!selected) return false;
        await readFile(selected.fileId, source);
      }),
    openSaved: ({ id }) =>
      run(async () => {
        const source = workflow.snapshot(),
          record = library.read({ id });
        if (!record) throw Error("未找到工作流：" + id);
        if (record.file) await readFile(record.file.fileId, source);
        else
          await replace(
            record.document,
            source,
            null,
            projectContent(record.document),
          );
      }),
    save: (options = {}) =>
      run(async () => {
        if (!file) {
          if (Object.hasOwn(options, "conflictVersion"))
            throw Error("当前工作流没有待覆盖的外部文件");
          const source = workflow.snapshot();
          checkpoint();
          library.save({ document: source.document, file: null });
          baseline = projectContent(source.document);
          last = workflow.snapshot();
          checkpoint();
          return;
        }
        let version = file.version;
        if (Object.hasOwn(options, "conflictVersion")) {
          if (!conflict || options.conflictVersion !== conflict.version)
            throw Error("覆盖确认已经失效，请重新检查磁盘版本");
          version = options.conflictVersion;
        }
        await write(file, version, workflow.snapshot());
      }),
    saveAs: () =>
      run(async () => {
        const source = workflow.snapshot();
        checkpoint();
        const selected = await storage.chooseSave();
        if (!selected) return false;
        assertCurrent(source);
        await write(selected, selected.version, source);
      }),
    reload: () =>
      run(async () => {
        const source = workflow.snapshot();
        if (file) await readFile(file.fileId, source);
        else {
          const record = library.read({ id: source.project.id });
          if (!record) throw Error("此工作流尚未保存");
          await replace(
            record.document,
            source,
            record.file,
            projectContent(record.document),
          );
        }
      }),
    recover: ({ recoveryId: id }) =>
      run(async () => {
        const source = workflow.snapshot(),
          record = await storage.recover({ recoveryId: id });
        await replace(
          readDocument(record.document),
          source,
          record.file || null,
          record.baseline ?? null,
        );
        // 继续维护同一份恢复记录，保存成功后清除，避免每次恢复产生重复草稿。
        recoveryId = id;
      }),
    backup: () =>
      run(async () => {
        const source = workflow.snapshot(),
          binding = file;
        const document = file
          ? readDocument(
              JSON.parse((await storage.backup({ fileId: file.fileId })).text),
            )
          : library.backup({ id: source.project.id });
        // 当前磁盘版本仍作为保存基线，恢复旧内容后明确为待保存。
        await replace(document, source, binding, baseline);
      }),
    checkpoint,
    dispose() {
      if (!live) return;
      try {
        checkpoint();
      } finally {
        live = false;
        cancel(timer);
        off();
        listeners.clear();
      }
    },
  };
  // 当前初始草稿也纳入恢复，关闭时有同步落盘兜底。
  const close = storage.onClose(() => checkpoint());
  const dispose = api.dispose;
  api.dispose = () => {
    close();
    dispose();
  };
  queuedCheckpoint();
  return api;
}

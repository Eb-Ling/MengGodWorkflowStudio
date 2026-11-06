/** L2 用户操作编排。编辑、模板、存储和导出保持单向依赖，不向宿主反向派发业务。 */
export function createWorkspaceService({
  editor,
  ports,
  preferences,
  exporter,
  files,
  templates,
  operations,
  layout,
}) {
  let live = true;
  const listeners = new Set();
  const needed = (value, name) => {
    if (!value) throw Error(name + "插件未启用");
    return value;
  };
  const emit = () => {
    if (live)
      for (const fn of listeners)
        try {
          fn();
        } catch {}
  };
  // 订阅稳定的操作目录，不绑定可卸载的叶插件。启停组件库不重启工作区或 MCP。
  let customNodeEditing = false;
  function readAuthors() {
    const ids = new Set(
      operations
        ?.list()
        .filter((op) => op.owner === "custom.glsl")
        .map((op) => op.id),
    );
    customNodeEditing =
      ids.has("custom.glsl.upsert") && ids.has("custom.glsl.remove");
  }
  readAuthors();
  const offOperations = operations?.subscribe(() => {
    readAuthors();
    emit();
  });
  const snapshot = () => {
    const current = editor.snapshot();
    return {
      ...current,
      generatedSources: exporter?.sources() ?? null,
      exportReadiness: exporter?.readiness() ?? {
        ready: false,
        message: "Starsector 导出插件未启用",
      },
      customNodeEditing,
      customNodes: customNodeEditing
        ? current.catalog.filter((n) => n.owner === "custom.glsl" && n.glsl)
        : [],
      workflowNodes: templates
        ? templates.list({}).items.map((i) => ({
            id: i.id,
            title: i.title,
            preset: !!i.preset,
            description: i.description || "",
            nodeCount: i.graph.nodes.length,
            linkCount: i.graph.links.length,
          }))
        : [],
    };
  };
  function editorAction(type, payload = {}) {
    const s = editor.snapshot(),
      r = editor.execute({
        documentId: s.project.id,
        documentToken: s.documentToken,
        stage: s.stage,
        expectedRevision: s.graph.revision,
        expectedDocumentRevision: s.documentRevision,
        actions: [{ type, payload }],
      });
    if (!r.ok) throw Error(r.error);
    return r.result;
  }
  async function action(type, payload) {
    if (!live) throw Error("工作区已停用");
    let result;
    switch (type) {
      case "SAVE_WORKFLOW":
        if (payload.config) editorAction("SET_PROJECT_CONFIG", payload.config);
        result = await needed(files, "存储").save();
        editor.report("已保存工作流：" + editor.snapshot().project.title);
        break;
      case "PROJECT_FILE": {
        const { operation, ...options } = payload;
        if (
          ![
            "status",
            "open",
            "save",
            "saveAs",
            "reload",
            "recover",
            "backup",
            "openSaved",
          ].includes(operation)
        )
          throw Error("未知文件操作");
        result = await needed(files, "存储")[operation](options);
        break;
      }
      case "OPEN_WORKFLOW":
        result = await needed(files, "存储").openSaved(payload);
        break;
      case "EXPORT_RUNTIME":
        result = await needed(exporter, "导出").exportEffect(payload);
        break;
      case "EXPORT_RUNTIME_DEPENDENCY":
        result = await needed(exporter, "导出").exportDependency(payload);
        break;
      case "DESCRIBE_EXPORT_CONFIGURATION":
        result = await needed(exporter, "导出").configuration(payload);
        break;
      case "AUTO_LAYOUT":
        result = needed(layout, "布局").arrange(payload);
        break;
      case "LOAD_MING_GOD_EXAMPLE": {
        const example = needed(templates, "模板").example({ id: "mingGod" });
        editorAction("OPEN_DOCUMENT", {
          config: example.config,
          graph: example.graph,
        });
        result = await needed(files, "存储").save();
        break;
      }
      case "SAVE_SELECTION_AS_WORKFLOW_NODE":
        result = needed(templates, "模板").save(payload);
        break;
      case "UPSERT_CUSTOM_NODE":
        if (!customNodeEditing) throw Error("自定义 GLSL 节点插件未启用");
        result = await operations.execute(
          "custom.glsl.upsert",
          payload.definition,
        );
        break;
      case "DELETE_CUSTOM_NODE":
        if (!customNodeEditing) throw Error("自定义 GLSL 节点插件未启用");
        result = await operations.execute("custom.glsl.remove", {
          typeId: payload.typeId,
        });
        break;
      case "DELETE_WORKFLOW_NODE":
        result = needed(templates, "模板").remove(payload);
        break;
      case "ADD_DEMO":
      case "EXPAND_WORKFLOW_NODE":
        result = needed(templates, "模板").expand({
          id: type === "ADD_DEMO" ? "demo" : payload.workflowNodeId,
          x: payload.canvasX ?? 115,
          y: payload.canvasY ?? 175,
        });
        editorAction("SET_SELECTION", { nodeIds: result.nodeIds });
        break;
      default:
        result = editorAction(type, payload);
        if (["NEW_WORKFLOW", "IMPORT_WORKFLOW_DATA"].includes(type))
          await needed(files, "存储").save();
    }
    emit();
    return result;
  }
  const guarded = ports.gateway({
    snapshot,
    graphTransaction: (commands) => editor.execute({ ...envelope(), commands }),
    documentTransaction: (transaction) =>
      editor.execute({ ...envelope(), transaction }),
    action,
  });
  function envelope() {
    const s = editor.snapshot();
    return {
      documentId: s.project.id,
      documentToken: s.documentToken,
      stage: s.stage,
      expectedRevision: s.graph.revision,
      expectedDocumentRevision: s.documentRevision,
    };
  }
  const off = editor.subscribe(emit),
    offExport = exporter?.subscribe(emit);
  return {
    ...guarded,
    execute(request) {
      const type = request?.actions?.[0]?.type;
      if (request?.actions?.length === 1 && (type === "SET_VIEW" || type === "SET_SELECTION")) {
        // 视图操作仍由同一命令守卫校验，省去工作区为此读取模板、导出物和双阶段图。
        return editor.execute(request);
      }
      return guarded.execute(request);
    },
    revision: () => editor.revision(),
    inspect: (...a) => editor.inspect(...a),
    edit: (...a) => editor.edit(...a),
    addNode: (...a) => editor.addNode(...a),
    setProperty: (...a) => editor.setProperty(...a),
    report: (...a) => editor.report(...a),
    activity: () => editor.activity(),
    onActivity: (fn) => editor.onActivity(fn),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    preferences(owner) {
      return {
        get: (key) => preferences.get(owner + "." + key),
        set: (key, value) => preferences.set(owner + "." + key, value),
      };
    },
    dispose() {
      live = false;
      off();
      offExport?.();
      offOperations?.();
      listeners.clear();
    },
  };
}

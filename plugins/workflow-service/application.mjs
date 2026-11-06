import { readWorkflowDocument as readDocument } from "../../packages/workflow-tools/custom-component-import.mjs";
import { createEditorSession } from "./editor-session.mjs";
import { createGraphSemantics } from "../../packages/workflow-tools/graph-semantics.mjs";
import { documentPolicy } from "./document-policy.mjs";
const clone = structuredClone;
import { starterGraph } from "../../packages/workflow-tools/defaults.mjs";
import {
  WorkflowService,
  defaultVertexTransform,
  previewResolution as normalizePreviewResolution,
} from "./document-session.mjs";
import { effectiveParameters, normalizeTransform } from "../../packages/workflow-tools/geometry.mjs";

import { createGraphData } from "../../packages/workflow-tools/graph-data.mjs";
import {
  stages,
  supportsStage,
} from "../../packages/workflow-tools/stages.mjs";

// 应用组合与项目表单适配，画布、检查器、节点库和几何视图由独立插件挂载。
export function createEditorApplication(ports, nodes) {
  const localPreferences = ports.preferences(),
    cleanups = [];
  let activeStage = ports.stage();
  let catalogRevision = 0;
  const stageHistory = new Map();
  let catalog = nodes.list();
  const {
    def,
    dependencyIssue,
    nodeDef,
    GLSL_TYPE_OPTIONS,
    typeKey,
    typeLabel,
    isSupportedType,
    resolveTypes,
    pruneInvalidLinks,
    variableBranchOwner,
    normalizedConstantValue,
    validateGraphProperties,
    typedPropertyType,
    typedValueProperty,
    validateNodeProperty,
    validateStageGraph,
    validateCommand,
  } = createGraphSemantics(
    () => catalog,
    () => activeStage,
  );
  const workflowService = new WorkflowService(ports.repository());
  const editorSession = createEditorSession();
  const documentController = ports.document({
    ...documentPolicy(() => catalog),
    service: workflowService,
    getStage: () => activeStage,
    onError: (error) => {
      ports.text(
        "#footer-message",
        "编辑已提交，但刷新或草稿保存失败：" + (error.message || error),
      );
    },
  });
  const { store, document: documentStore } = documentController;
  const {
    api: workflowApi,
    commands: graphCommands,
    action: dispatchAction,
  } = ports.access({
    snapshot: applicationSnapshot,
    commandState: () => ({ ...documentStore.commandState(activeStage), documentToken: editorSession.token(), stage: activeStage }),
    store,
    action: executeEditorAction,
    session: editorSession,
    document: documentStore,
  });
  documentController.setDispatcher((items) => graphCommands.batch(items));
  let lastGeneratedSources = null;
  const ui = {
    selected: null,
    selectedNodes: new Set(),
    view: { x: 0, y: 0, zoom: 1 },
  };

  let actionDepth = 0;
  function executeEditorAction(type, payload) {
    actionDepth++;
    try {
      return applyEditorAction(type, payload);
    } finally {
      actionDepth--;
    }
  }
  function applyEditorAction(type, payload) {
    if (type === "UNDO" || type === "REDO") {
      const result =
        type === "UNDO"
          ? documentStore.undo(activeStage)
          : documentStore.redo(activeStage);
      if (!result.ok) throw new Error(result.error);
    } else if (type === "SET_RUNTIME_PATH") {
      workflowService.setRuntimePath(payload.path);
      persistCurrentWorkflow();
    } else if (type === "RESTORE_PROJECT_DOCUMENT") {
      const next = readDocument(payload.document);
      // 文件打开保留用户节点 ID，导入模板仍使用原有的新建 ID 规则。
      documentStore.reset(next);
      editorSession.replace();
      stageHistory.clear();
      ui.selected = null;
      ui.selectedNodes.clear();
      Object.assign(ui.view, { x: 0, y: 0, zoom: 1 });
      store.emit();
      updateView();
      renderWorkflowLibrary();
    } else if (type === "OPEN_DOCUMENT") {
      validateStageGraph(payload.graph, "fragment");
      openWorkflow(
        payload.config,
        payload.graph,
        payload.closeDialog ?? true,
        payload.vertexTransform ?? null,
      );
    } else if (type === "SET_STAGE") {
      if (!stages[payload.stage]) throw new Error("未知着色阶段");
      switchStage(payload.stage);
    } else if (type === "NEW_WORKFLOW") {
      const config = normalizeProjectConfig(payload);
      openWorkflow(config, starterGraph(), false);
    } else if (type === "RESET_CURRENT_DRAFT") {
      store.reset(stageStarterGraph());
      ui.selected = null;
      ui.selectedNodes.clear();
    } else if (type === "DELETE_WORKFLOW") {
      workflowService.delete(payload.id);
      if (projectConfig().id === payload.id)
        openWorkflow(newWorkflowConfig(), starterGraph(), false);
      renderWorkflowLibrary();
    } else if (type === "IMPORT_WORKFLOW_DATA") {
      const imported = validateImportedWorkflow(payload.workflow);
      openWorkflow(imported.project, imported.graphs.fragment, false, {
        ...imported.geometry,
        graph: imported.graphs.vertex,
      });
    } else if (type === "SET_PROJECT_CONFIG") {
      const config = {
        ...projectConfig(),
        ...normalizeProjectConfig(payload, projectConfig()),
      };
      workflowService.setConfig(config);
      store.invalidate();
    } else if (type === "SET_VERTEX_TRANSFORM") {
      const transform = normalizeGeometryInput({
        ...currentVertexTransform(),
        ...payload,
      });
      validateStageGraph(transform.graph, "vertex");
      workflowService.setTransform(transform, true);
    } else if (type === "SET_VIEW") {
      ui.view.x = Number(payload.x) || 0;
      ui.view.y = Number(payload.y) || 0;
      ui.view.zoom = Math.max(0.35, Math.min(1.8, Number(payload.zoom) || 1));
    } else if (type === "SET_SELECTION") {
      const valid = new Set(store.snapshot().nodes.map((node) => node.id));
      ui.selectedNodes = new Set(
        (payload.nodeIds || []).filter((id) => valid.has(id)),
      );
      ui.selected = [...ui.selectedNodes][0] || null;
    } else if (type === "DELETE_SELECTED") {
      const ids = [...ui.selectedNodes];
      ui.selectedNodes.clear();
      ui.selected = null;
      graphCommands.removeNodes(ids);
    } else if (type === "DISCONNECT_SELECTED") {
      const ids = new Set(ui.selectedNodes),
        links = store
          .snapshot()
          .links.filter(
            (link) => ids.has(link.fromNode) || ids.has(link.toNode),
          );
      if (links.length)
        graphCommands.batch(
          links.map((link) => ({ type: "DISCONNECT", payload: { link } })),
        );
    } else if (type === "TOGGLE_SELECTED_PREVIEW") {
      const nodes = store
          .snapshot()
          .nodes.filter((node) => ui.selectedNodes.has(node.id)),
        enabled =
          typeof payload.enabled === "boolean"
            ? payload.enabled
            : !nodes.every((node) => node.properties.previewEnabled);
      if (nodes.length)
        graphCommands.batch(
          nodes.map((node) => ({
            type: "SET_PROPERTY",
            payload: { nodeId: node.id, key: "previewEnabled", value: enabled },
          })),
        );
    } else throw new Error(`未知工作流操作：${type}`);
    editorSession.changed();
  }
  function previewResolution(config = projectConfig()) {
    return normalizePreviewResolution(config);
  }
  function normalizeProjectConfig(payload = {}, base = newWorkflowConfig()) {
    const resolution = previewResolution({
      ...base,
      previewWidth: payload.previewWidth ?? base.previewWidth,
      previewHeight: payload.previewHeight ?? base.previewHeight,
    });
    return {
      id: String(payload.id || base.id || `workflow_${Date.now()}`),
      title: String(payload.title || base.title || "Untitled Workflow"),
      className:
        String(
          payload.className || base.className || "GeneratedCombatLayerPlugin",
        ).replace(/[^A-Za-z0-9_]/g, "") || "GeneratedCombatLayerPlugin",
      shaderDir: String(
        payload.shaderDir || base.shaderDir || "data/shaders/generated",
      ),
      runtimePath: String(
        payload.runtimePath ??
          base.runtimePath ??
          workflowService.defaultRuntimePath(),
      ),
      previewWidth: resolution.width,
      previewHeight: resolution.height,
      blendMode: payload.blendMode ?? base.blendMode ?? "alpha",
    };
  }
  function normalizeGeometryInput(payload = {}) {
    return normalizeTransform(payload);
  }
  function updateView() {
    editorSession.changed();
  }

  function select(nodeId, append = false) {
    if (!append) ui.selectedNodes.clear();
    if (nodeId) ui.selectedNodes.add(nodeId);
    ui.selected = nodeId;
    editorSession.changed();
  }
  function renderCatalog() {
    editorSession.changed();
  }
  function renderGraph() {
    editorSession.changed();
  }

  function projectConfig() {
    return workflowService.config();
  }
  function loadCurrentGraph() {
    return workflowService.graph(activeStage);
  }
  function validateImportedWorkflow(value) {
    if (!value || typeof value !== "object")
      throw new Error("根对象必须是 JSON 对象");
    const canonical = readDocument(value);
    validateStageGraph(canonical.graphs.fragment, "fragment");
    validateStageGraph(canonical.graphs.vertex, "vertex");
    canonical.project = normalizeProjectConfig(canonical.project, {
      ...newWorkflowConfig(),
      title: "Imported Workflow",
    });
    const { graph, ...geometry } = normalizeTransform({
      ...canonical.geometry,
      graph: canonical.graphs.vertex,
    });
    canonical.geometry = geometry;
    return canonical;
  }
  function persistCurrentGraph() {
    persistActiveGraph(store.snapshot());
  }

  function currentVertexTransform() {
    return workflowService.transform();
  }
  function setGeometryTransform(transform) {
    const result = dispatchAction("SET_VERTEX_TRANSFORM", transform);
    if (!result.ok) throw new Error(result.error);
  }
  function setParameterScope(name, scope) {
    const t = currentVertexTransform();
    t.parameterModes[name] = scope;
    setGeometryTransform(t);
  }
  function effectiveScope(node) {
    return (
      currentVertexTransform().parameterModes[inputUniformName(node)] ??
      node.properties.scope ??
      "shared"
    );
  }
  function runtimeInputs(graph) {
    return effectiveParameters(graphInputs(graph), currentVertexTransform());
  }
  function currentFragmentGraph() {
    return workflowService.fragment();
  }
  function stageStarterGraph() {
    return activeStage === "vertex"
      ? normalizeTransform().graph
      : starterGraph();
  }
  function persistActiveGraph(graph) {
    workflowService.persistGraph(activeStage, graph);
  }
  function switchStage(stage) {
    if (!actionDepth) return dispatchAction("SET_STAGE", { stage });
    if (!stages[stage] || stage === activeStage) return;
    persistActiveGraph(store.snapshot());
    stageHistory.set(activeStage, {
      selected: [...ui.selectedNodes],
      view: { x: ui.view.x, y: ui.view.y, zoom: ui.view.zoom },
    });
    activeStage = stage;
    const saved = stageHistory.get(stage);
    ui.selectedNodes = new Set(saved?.selected || []);
    ui.selected = [...ui.selectedNodes][0] || null;
    Object.assign(ui.view, saved?.view || { x: 0, y: 0, zoom: 1 });
    store.endGesture();
    updateStageUI();
    updateView();
    store.emit();
  }
  function updateStageUI() {
    ports.setStage(activeStage, stages[activeStage].title);
    renderCatalog();
  }

  function newWorkflowConfig() {
    return workflowService.newConfig();
  }
  function persistCurrentWorkflow(silent = true) {
    workflowService.repository.setDocument(workflowService.snapshot());
  }
  // Opening must be read-only against the workflow library.  Persisting the outgoing in-memory
  // draft here used to overwrite a saved entry while the user was trying to load it.
  function openWorkflow(
    config,
    graph,
    closeDialog = true,
    vertexTransform = null,
  ) {
    if (!actionDepth)
      return dispatchAction("OPEN_DOCUMENT", {
        config,
        graph,
        closeDialog,
        vertexTransform,
      });
    editorSession.replace();
    const draft = workflowService.open(config, graph, vertexTransform);
    stageHistory.clear();
    ui.selected = null;
    ui.selectedNodes.clear();
    Object.assign(ui.view, { x: 0, y: 0, zoom: 1 });
    store.emit();
    updateView();

    renderWorkflowLibrary();
  }
  function renderWorkflowLibrary() {
    editorSession.changed();
  }
  const shaderData = createGraphData(nodeDef);
  const { inputUniformName, graphInputs, graphTextureInputs } =
    shaderData;
  const renderInspector = () => editorSession.changed();
  const workflowMetadata = {
    nodeDef,
    typeLabel,
    typeKey,
    typeOptions: () => GLSL_TYPE_OPTIONS,
    typedPropertyType,
    typedValueProperty,
    normalizedConstantValue,
    validateNodeProperty,
    variableBranchOwner,
    effectiveScope,
    parameterName: inputUniformName,
    parameters: () =>
      runtimeInputs({
        nodes: [
          ...currentFragmentGraph().nodes,
          ...currentVertexTransform().graph.nodes,
        ],
      }),
    activity: editorSession.activity,
    report: (message) => ports.text("#footer-message", message),
  };

  cleanups.push(
    store.subscribe((graph) => {
      lastGeneratedSources = null;
      persistActiveGraph(graph);
      ports.text("#revision", graph.revision);
      ports.text("#workflow-name", projectConfig().title);
      ports.text(
        "#footer-message",
        `${graph.nodes.length} 节点 · ${graph.links.length} 连线`,
      );
      renderGraph(graph);
      renderInspector(graph);

      editorSession.changed();
    }),
  );
  renderCatalog();
  updateStageUI();

  function applicationSnapshot() {
    const document = documentStore.snapshot(), resolution = previewResolution(document.project);
    return {
      documentToken: editorSession.token(),
      catalogRevision,
      documentRevision: document.revision,
      document,
      dependencyDiagnostics: Object.entries(document.graphs).flatMap(([stage, graph]) =>
        graph.nodes.map((node) => dependencyIssue(node, stage)).filter(Boolean)),
      history: documentStore.history(activeStage),
      stage: activeStage,
      graph: document.graphs[activeStage],
      fragmentGraph: document.graphs.fragment,
      project: { ...document.project, previewWidth: resolution.width, previewHeight: resolution.height },
      vertexTransform: { ...document.geometry, graph: document.graphs.vertex },
      selection: [...ui.selectedNodes],
      view: { x: ui.view.x, y: ui.view.y, zoom: ui.view.zoom },
      savedWorkflows: workflowService.repository.librarySummaries(),
      workflowNodes: [],
      generatedSources: lastGeneratedSources,
      catalog: catalog
        .filter(
          (n) =>
            supportsStage(n.typeId, activeStage) &&
            (!n.stages || n.stages.includes(activeStage)),
        )
        .map(
          ({
            owner,
            typeId,
            title,
            category,
            inputs,
            outputs,
            properties,
            propertySchema,
            glsl,
            stages,
            targets,
          }) => ({
            owner,
            typeId,
            title,
            category,
            inputs,
            outputs,
            properties,
            propertySchema,
            glsl,
            stages,
            targets,
          }),
        ),
    };
  }

  cleanups.push(
    nodes.subscribe(() => {
      catalog = nodes.list();
      catalogRevision++;
      renderCatalog();
      store.emit();
      editorSession.changed();
    }),
  );
  return {
    dispose() {
      for (const off of cleanups.splice(0).reverse()) off();
      workflowService.dispose();
      editorSession.dispose();
      documentController.dispose();
    },
    libraryApi: {
      read: ({ id }) => workflowService.repository.record(id),
      save: ({ document, file = null }) => {
        const value = workflowService.repository.saveRecord(document, file);
        renderWorkflowLibrary();
        return value;
      },
      backup: ({ id }) => workflowService.repository.backup(id),
    },
    workflowApi: { ...workflowApi, revision: () => ({
      documentToken: editorSession.token(), documentRevision: documentStore.revision(), stage: activeStage, catalogRevision,
    }) },
    workflowMetadata,
  };
}

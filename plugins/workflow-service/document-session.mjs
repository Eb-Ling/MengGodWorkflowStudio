const clone = structuredClone;
import { starterGraph } from "../../packages/workflow-tools/defaults.mjs";
import { normalizeTransform } from "../../packages/workflow-tools/geometry.mjs";
import {
  createDocument,
  readDocument,
} from "../../packages/plugin-sdk/document.mjs";
export function previewResolution(config) {
  const value = (key) =>
    Math.max(64, Math.min(4096, Math.round(Number(config[key]) || 1024)));
  return { width: value("previewWidth"), height: value("previewHeight") };
}
const defaultConfig = () => ({
  id: "default",
  title: "Untitled Workflow",
  className: "GeneratedCombatLayerPlugin",
  shaderDir: "data/shaders/generated",
  previewWidth: 1024,
  previewHeight: 1024,
});
export function defaultVertexTransform() {
  return {
    vertices: [
      [-180, -90],
      [180, -90],
      [-180, 90],
      [180, 90],
    ],
    tx: 0,
    ty: 0,
    sx: 1,
    sy: 1,
    rotation: 0,
  };
}
/** 只编排当前文档与 IO，不持有第二套可写草稿，也不读取历史分散存储键。 */
export class WorkflowService {
  constructor(repository) {
    this.repository = repository;
  }
  initialDocument() {
    const saved = this.repository.getDocument();
    if (saved) return saved;
    const defaultRecord = this.repository.record("default");
    if (defaultRecord) return defaultRecord.document;
    const { graph: vertex, ...geometry } = normalizeTransform(
      defaultVertexTransform(),
    );
    return createDocument({
      project: { ...defaultConfig(), runtimePath: this.defaultRuntimePath() },
      graphs: { fragment: starterGraph(), vertex },
      geometry,
    });
  }
  attachDocument(store) {
    this.documentStore = store;
    this.off = store.subscribe((value) => this.repository.setDocument(value));
  }
  dispose() {
    this.off?.();
  }
  snapshot() {
    if (!this.documentStore) throw new Error("文档服务尚未装配");
    return this.documentStore.snapshot();
  }
  config() {
    const value = this.snapshot().project,
      resolution = previewResolution(value);
    return {
      ...value,
      previewWidth: resolution.width,
      previewHeight: resolution.height,
    };
  }
  newConfig() {
    return {
      ...defaultConfig(),
      id: "workflow_" + Date.now(),
      runtimePath: this.defaultRuntimePath(),
    };
  }
  defaultRuntimePath() {
    return this.repository.getRuntimePath();
  }
  fragment() {
    return this.documentStore.graph("fragment");
  }
  transform() {
    const value = this.snapshot();
    return { ...value.geometry, graph: value.graphs.vertex };
  }
  graph(stage) {
    return this.documentStore.graph(stage);
  }
  // 此处是列表展示投影，仓储中只有规范文档，没有重复的 config/graph 字段。
  library() {
    const bindings = this.repository.readIndex("workflow.fileBindings");
    return this.repository.getLibrary().map((value) => ({
      id: value.project.id,
      config: value.project,
      graph: value.graphs.fragment,
      vertexTransform: { ...value.geometry, graph: value.graphs.vertex },
      document: value,
      file: bindings[value.project.id] || null,
    }));
  }
  commit(change) {
    const result = this.documentStore.transact(change);
    if (!result.ok) throw new Error(result.error);
  }
  setConfig(config) {
    // 保存按钮会再次提交表单，相同配置不制造修订和无意义的磁盘备份。
    if (
      JSON.stringify({ ...this.config(), ...config }) ===
      JSON.stringify(this.config())
    )
      return;
    this.commit({ patch: { project: config }, label: "修改工作流配置" });
  }
  setTransform(value) {
    const { graph, ...geometry } = normalizeTransform(value);
    const graphs =
      JSON.stringify(graph) !== JSON.stringify(this.graph("vertex"))
        ? { vertex: graph }
        : {};
    this.commit({ patch: { geometry }, graphs, label: "修改几何参数" });
  }
  persistGraph(stage, graph) {
    if (JSON.stringify(graph) !== JSON.stringify(this.graph(stage)))
      this.commit({ graphs: { [stage]: graph }, label: "更新阶段" });
    this.repository.setDocument(this.snapshot());
  }
  open(config, graph, vertexTransform = null) {
    const { graph: vertex, ...geometry } = normalizeTransform(
      vertexTransform || defaultVertexTransform(),
    );
    const snapshot = createDocument({
      project: {
        ...clone(config),
        runtimePath: config.runtimePath || this.defaultRuntimePath(),
      },
      graphs: { fragment: clone(graph), vertex },
      geometry,
    });
    this.documentStore.reset(snapshot);
  }
  save(stage, graph, { existingOnly = false } = {}) {
    this.persistGraph(stage, graph);
    const snapshot = this.snapshot(),
      library = this.repository.getLibrary(),
      index = library.findIndex(
        (value) => value.project.id === snapshot.project.id,
      );
    if (existingOnly && index < 0) return null;
    this.repository.saveRecord(snapshot, null);
    return {
      id: snapshot.project.id,
      config: snapshot.project,
      document: readDocument(snapshot),
    };
  }
  delete(id) {
    this.repository.deleteRecord(id);
  }
  setRuntimePath(runtimePath) {
    this.setConfig({ ...this.config(), runtimePath });
    this.repository.setRuntimePath(runtimePath);
  }
}

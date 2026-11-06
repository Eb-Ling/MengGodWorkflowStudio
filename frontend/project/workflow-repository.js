import { readWorkflowDocument as readDocument } from "../../packages/workflow-tools/custom-component-import.mjs";
import { projectContent } from "../../packages/plugin-sdk/project-files.mjs";
/** 当前文档仓储：草稿与项目库都只保存完整 v1.0 文档。 */
export class WorkflowRepository {
  constructor({ session, local }) {
    this.session = session;
    this.local = local;
  }
  read(storage, key, fallback = null) {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }
  write(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }
  getDocument() {
    const value = this.read(this.session, "workflow.document");
    return value ? readDocument(value) : null;
  }
  setDocument(value) {
    this.write(this.session, "workflow.document", readDocument(value));
  }
  getLibrary() {
    const values = this.read(this.local, "workflow.documents", []);
    if (!Array.isArray(values)) throw new Error("项目库必须是 v1.0 文档数组");
    return values.map(readDocument);
  }
  /** 快照只需要库索引。同一版存储不重复解析、校验所有保存的节点。 */
  librarySummaries() {
    const keys = ["workflow.documents", "workflow.fileBindings"];
    const version = this.local.getVersion?.(keys);
    const raw = version === undefined ? keys.map(key => this.local.getItem(key)) : null;
    const cache = this.summaryCache;
    if (!cache || cache.version !== version || (raw && raw.some((v, i) => v !== cache.raw[i]))) {
      const bindings = this.readIndex(keys[1]);
      const items = this.getLibrary().map(({ project, graphs }) => ({
        id: project.id, title: project.title, className: project.className, shaderDir: project.shaderDir,
        nodeCount: graphs.fragment.nodes.length, linkCount: graphs.fragment.links.length,
        file: bindings[project.id] || null,
      }));
      this.summaryCache = { version, raw, items };
    }
    return structuredClone(this.summaryCache.items);
  }
  setLibrary(values) {
    this.write(this.local, "workflow.documents", values.map(readDocument));
  }
  readIndex(key) {
    const value = this.read(this.local, key, {});
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("工作流索引格式无效");
    // 用户可自定义文档 ID，不能把 constructor / __proto__ 当成对象原型成员。
    return Object.assign(Object.create(null), value);
  }
  /** 工作流库唯一保存记录，file 仅是外部来源元数据，不写入可交换的 Document。 */
  record(id) {
    const document = this.getLibrary().find((value) => value.project.id === id);
    return document
      ? {
          document,
          file: this.readIndex("workflow.fileBindings")[id] || null,
        }
      : null;
  }
  saveRecord(snapshot, file = null) {
    snapshot = readDocument(snapshot);
    const id = snapshot.project.id,
      documents = this.getLibrary(),
      index = documents.findIndex((value) => value.project.id === id);
    const bindings = this.readIndex("workflow.fileBindings"),
      backups = this.readIndex("workflow.backups");
    if (index >= 0) {
      if (projectContent(documents[index]) !== projectContent(snapshot))
        backups[id] = documents[index];
      documents.splice(index, 1);
    }
    documents.push(snapshot);
    if (file) bindings[id] = file;
    else delete bindings[id];
    const items = {
      "workflow.documents": JSON.stringify(documents),
      "workflow.fileBindings": JSON.stringify(bindings),
      "workflow.backups": JSON.stringify(backups),
    };
    this.commitItems(items);
    return { document: snapshot, file };
  }
  /** 删除库记录同时清除它的来源索引及备份，绝不删除外部源文件。 */
  deleteRecord(id) {
    const documents = this.getLibrary();
    if (!documents.some(value=>value.project.id===id)) throw Error('未找到工作流：'+id);
    const bindings=this.readIndex('workflow.fileBindings'), backups=this.readIndex('workflow.backups');
    delete bindings[id]; delete backups[id];
    this.commitItems({
      'workflow.documents':JSON.stringify(documents.filter(value=>value.project.id!==id)),
      'workflow.fileBindings':JSON.stringify(bindings),
      'workflow.backups':JSON.stringify(backups),
    });
  }
  commitItems(items) {
    if (this.local.setItems) this.local.setItems(items);
    else {
      // 浏览器没有原生事务端口，失败时回退本次修改，保持原库可读。
      const before = Object.fromEntries(
        Object.keys(items).map((key) => [key, this.local.getItem(key)]),
      );
      try {
        for (const [key, value] of Object.entries(items))
          this.local.setItem(key, value);
      } catch (error) {
        for (const [key, value] of Object.entries(before)) {
          if (value === null) this.local.removeItem?.(key);
          else this.local.setItem(key, value);
        }
        throw error;
      }
    }
  }
  backup(id) {
    const document = this.readIndex("workflow.backups")[id];
    if (!document) throw Error("此工作流还没有上一次保存的备份");
    return readDocument(document);
  }
  getRuntimePath() {
    return this.local.getItem("workflow.runtimePath") || "data/method";
  }
  setRuntimePath(value) {
    this.local.setItem("workflow.runtimePath", value);
  }
}

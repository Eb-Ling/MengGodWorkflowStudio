import { GraphStore } from "./graph-store.mjs";
import { copyJson } from "../plugin-sdk/schema.mjs";
import { STAGES, validateDocument, documentDependencies } from "../plugin-sdk/document.mjs";

/** 规范文档的唯一可写状态。跨阶段事务先校验副本，成功后一次提交、一次通知。 */
export class DocumentStore {
  #state;
  #policies;
  #validate;
  #listeners = new Set();
  #history = { vertex: [], fragment: [] };
  #redo = { vertex: [], fragment: [] };
  #serial = 0;
  constructor(
    document,
    { policies, validate = () => {}, onObserverError = () => {} },
  ) {
    this.#policies = policies;
    this.#validate = validate;
    this.onObserverError = onObserverError;
    this.reset(document, false);
  }
  snapshot() {
    return copyJson(this.#state);
  }
  graph(stage) {
    return copyJson(this.#state.graphs[stage]);
  }
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  #emit() {
    for (const listener of this.#listeners) {
      try {
        listener(this.snapshot());
      } catch (error) {
        try {
          this.onObserverError(error);
        } catch {}
      }
    }
  }
  #check(value, derive = false) {
    if (derive) value.requiredPlugins = documentDependencies(value.graphs);
    validateDocument(value);
    this.#validate(value);
    value.requiredPlugins = documentDependencies(value.graphs);
    validateDocument(value);
  }
  reset(document, notify = true) {
    const next = copyJson(document);
    this.#check(next);
    next.revision = Math.max(
      next.revision,
      (this.#state?.revision ?? -1) + 1,
      ...Object.values(next.graphs).map((graph) => graph.revision || 0),
    );
    for (const stage of STAGES) next.graphs[stage].revision = next.revision;
    this.#state = next;
    this.#history = { vertex: [], fragment: [] };
    this.#redo = { vertex: [], fragment: [] };
    if (notify) this.#emit();
  }
  /** commands 的每项显式给出 stage，patch 可同时修改 project/geometry，不能混入文件 IO。 */
  transact({
    commands = [],
    patch = {},
    graphs = {},
    label = "编辑工作流",
    group = null,
  } = {}) {
    const before = this.snapshot(),
      next = this.snapshot(),
      affected = new Set();
    try {
      if (!Array.isArray(commands) || commands.length > 1000)
        throw new Error("事务命令数量无效");
      if (
        !patch ||
        typeof patch !== "object" ||
        Array.isArray(patch) ||
        Object.keys(patch).some(
          (key) => !["project", "geometry", "requiredPlugins"].includes(key),
        )
      )
        throw new Error("未知文档修改字段");
      if (patch.project?.id && patch.project.id !== before.project.id)
        throw new Error("文档 ID 不可通过事务修改，请使用打开或新建操作");
      for (const [stage, graph] of Object.entries(graphs)) {
        if (!STAGES.includes(stage)) throw new Error("未知替换阶段");
        next.graphs[stage] = copyJson(graph);
        affected.add(stage);
      }
      const partitions = new Map();
      for (const command of commands) {
        if (!STAGES.includes(command.stage))
          throw new Error("命令缺少有效阶段");
        if (!partitions.has(command.stage)) partitions.set(command.stage, []);
        partitions
          .get(command.stage)
          .push({ type: command.type, payload: command.payload });
      }
      for (const [stage, items] of partitions) {
        const store = new GraphStore(next.graphs[stage], this.#policies(stage));
        const result = store.batch(copyJson(items));
        if (!result.ok) throw new Error(result.error);
        next.graphs[stage] = store.snapshot();
        affected.add(stage);
      }
      for (const key of Object.keys(patch)) {
        if (
          !patch[key] ||
          typeof patch[key] !== "object" ||
          Array.isArray(patch[key])
        )
          throw new Error(`无效文档字段：${key}`);
        next[key] = { ...next[key], ...copyJson(patch[key]) };
        STAGES.forEach((stage) => affected.add(stage));
      }
      if (!affected.size) return { ok: true, revision: before.revision };
      if (Object.hasOwn(patch, "requiredPlugins")) validateDocument(next);
      this.#check(next, true);
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
    next.revision = before.revision + 1;
    for (const stage of STAGES) {
      next.graphs[stage].revision = next.revision;
      if (affected.has(stage))
        next.graphs[stage].previewRevision =
          (before.graphs[stage].previewRevision || 0) + 1;
    }
    const scopes = [...affected],
      metadata = Object.keys(patch);
    // 联合历史有共享条目。撤销前要求它在所有受影响阶段都位于栈顶，避免覆盖后续编辑。
    const previous =
      scopes.length === 1 ? this.#history[scopes[0]].at(-1) : null;
    if (group && previous?.group === group && previous.scopes.length === 1) {
      previous.after = copyJson(next);
    } else {
      const entry = {
        id: ++this.#serial,
        before,
        after: copyJson(next),
        scopes,
        metadata,
        label,
        group,
      };
      for (const stage of scopes) this.#history[stage].push(entry);
      const expired = new Set(
        STAGES.flatMap((stage) => this.#history[stage].slice(0, -100)),
      );
      for (const stage of STAGES)
        this.#history[stage] = this.#history[stage].filter(
          (item) => !expired.has(item),
        );
    }
    // 新分支会使重叠范围的重做条目失效，同时清除联合条目在另一栈中的引用。
    const invalid = new Set(scopes.flatMap((stage) => this.#redo[stage]));
    for (const stage of STAGES)
      this.#redo[stage] = this.#redo[stage].filter(
        (entry) => !invalid.has(entry),
      );
    this.#state = next;
    this.#emit();
    return { ok: true, revision: next.revision };
  }
  /** 撤销当前阶段，联合事务在两个阶段一起恢复，有后续冲突时返回错误。 */
  undo(stage) {
    return this.#travel(stage, false);
  }
  /** 重做当前阶段，修订保持递增，旧请求不会因撤销而重新有效。 */
  redo(stage) {
    return this.#travel(stage, true);
  }
  #travel(stage, forward) {
    if (!STAGES.includes(stage)) return { ok: false, error: "未知阶段" };
    const from = forward ? this.#redo : this.#history,
      to = forward ? this.#history : this.#redo,
      entry = from[stage].at(-1);
    if (!entry)
      return {
        ok: false,
        error: forward ? "没有可重做的操作" : "没有可撤销的操作",
      };
    if (entry.scopes.some((scope) => from[scope].at(-1) !== entry))
      return {
        ok: false,
        error: "另一阶段有后续操作，请先撤销/重做该阶段的操作",
      };
    const source = forward ? entry.after : entry.before,
      next = this.snapshot();
    for (const scope of entry.scopes) {
      next.graphs[scope] = copyJson(source.graphs[scope]);
      next.graphs[scope].revision = this.#state.graphs[scope].revision + 1;
      next.graphs[scope].previewRevision =
        (this.#state.graphs[scope].previewRevision || 0) + 1;
    }
    for (const key of entry.metadata) next[key] = copyJson(source[key]);
    try {
      this.#check(next, true);
    } catch (error) {
      return { ok: false, error: error.message };
    }
    next.revision++;
    for (const scope of STAGES) next.graphs[scope].revision = next.revision;
    for (const scope of entry.scopes) {
      from[scope].pop();
      to[scope].push(entry);
    }
    this.#state = next;
    this.#emit();
    return { ok: true, revision: next.revision };
  }
  /** 当前阶段历史摘要只提供数据，不暴露历史栈或可写文档。 */
  history(stage) {
    return {
      undo: this.#history[stage].map((x) => ({
        id: x.id,
        label: x.label,
        stages: [...x.scopes],
      })),
      redo: this.#redo[stage].map((x) => ({
        id: x.id,
        label: x.label,
        stages: [...x.scopes],
      })),
    };
  }
}

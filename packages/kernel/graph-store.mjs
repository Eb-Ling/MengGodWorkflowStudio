import {
  cloneData as clone,
  GRAPH_COMMANDS,
} from "../plugin-sdk/contracts.mjs";

import { validateGraphCommand } from "../plugin-sdk/commands.mjs";
const commands = new Set(GRAPH_COMMANDS);

// Platform-neutral graph/history kernel. Shader semantics are supplied policies.
export class GraphStore {
  constructor(graph, policies) {
    this.policies = policies;
    this.listeners = new Set();
    this.previewRevision = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.reset(graph);
  }

  reset(graph = this.policies.starterGraph()) {
    const previousRevision = this.graph?.revision;
    this.undoStack = [];
    this.redoStack = [];
    this.graph = clone(graph);
    this.graph.revision = Number.isFinite(this.graph.revision)
      ? this.graph.revision
      : 0;
    if (previousRevision !== undefined)
      this.graph.revision = Math.max(this.graph.revision, previousRevision + 1);
    this.graph.previewRevision = ++this.previewRevision;
    this.emit();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    return clone(this.graph);
  }

  invalidate() {
    this.graph.revision++;
    this.graph.previewRevision = ++this.previewRevision;
    this.emit();
  }

  emit() {
    for (const listener of this.listeners) {
      try {
        listener(this.snapshot());
      } catch (error) {
        // Observers run after commit. A failed view/storage observer must not
        // report a committed transaction as rejected or skip other observers.
        try {
          this.policies.onListenerError?.(error);
        } catch {}
      }
    }
  }

  checkpoint() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  restore(graph) {
    const revision = this.graph.revision + 1;
    this.graph = clone(graph);
    this.graph.revision = revision;
    this.graph.previewRevision = ++this.previewRevision;
    this.emit();
  }

  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.snapshot());
    this.restore(this.undoStack.pop());
    return true;
  }

  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.snapshot());
    this.restore(this.redoStack.pop());
    return true;
  }

  command(type, payload) {
    if (!commands.has(type)) throw new Error("未知节点命令：" + type);
    return this.batch([{ type, payload }]);
  }

  batch(items) {
    if (!Array.isArray(items) || !items.length)
      return { ok: false, error: "图事务不能为空" };
    const staged = new GraphStore(this.snapshot(), {
      ...this.policies,
      onRejected: undefined,
    });
    try {
      for (const item of items) {
        validateGraphCommand(item?.type, item?.payload);
        const { type, payload } = clone(item);
        if (!commands.has(type) || !payload || typeof payload !== "object")
          throw new Error("未知节点命令或无效参数");
        // Detached graph: no listeners, persistence or history before commit.
        if (type === "CONNECT") {
          const error = this.policies.connectionError(
            staged.graph,
            payload.link,
          );
          if (error) throw new Error(error);
        }
        staged.validate(type, payload);
        this.policies.validateCommand?.(staged.graph, type, payload);
        const result = staged.apply(type, payload);
        if (!result.ok) throw new Error(result.error);
      }
    } catch (error) {
      const message = error.message || String(error);
      this.policies.onRejected?.(message);
      return { ok: false, error: message };
    }
    this.checkpoint();
    staged.graph.revision = this.graph.revision + 1;
    staged.graph.previewRevision = items.some(
      (item) => item.type !== "MOVE_NODE",
    )
      ? ++this.previewRevision
      : this.graph.previewRevision;
    this.graph = staged.graph;
    this.emit();
    return { ok: true };
  }

  validate(type, payload) {
    const node = this.node(payload.nodeId);
    if (
      [
        "REMOVE_NODE",
        "MOVE_NODE",
        "SET_PROPERTY",
        "RENAME_NODE",
        "RENAME_NODE_ID",
        "SET_OUTPUT",
      ].includes(type) &&
      !node
    )
      throw new Error("未知节点：" + payload.nodeId);
    if (
      type === "ADD_NODE" &&
      (!payload.node?.id ||
        typeof payload.node.id !== "string" ||
        this.node(payload.node.id))
    )
      throw new Error("节点 ID 为空或重复");
    if (
      type === "MOVE_NODE" &&
      (!Number.isFinite(payload.x) || !Number.isFinite(payload.y))
    )
      throw new Error("坐标必须是有限数字");
    if (
      type === "SET_PROPERTY" &&
      (typeof payload.key !== "string" ||
        !payload.key ||
        ["__proto__", "constructor", "prototype"].includes(payload.key) ||
        payload.value === undefined)
    )
      throw new Error("无效节点属性");
    if (type === "RENAME_NODE" && typeof payload.title !== "string")
      throw new Error("节点标题必须是字符串");
    if (
      type === "RENAME_NODE_ID" &&
      (typeof payload.id !== "string" ||
        !payload.id ||
        (payload.id !== payload.nodeId && this.node(payload.id)))
    )
      throw new Error("节点 ID 为空或重复");
    if (type === "SET_OUTPUT" && node.typeId !== this.policies.outputType())
      throw new Error("输出必须是当前阶段的输出节点");
    if (type === "CONNECT" || type === "DISCONNECT") {
      const link = payload.link;
      if (
        !link ||
        !this.node(link.fromNode) ||
        !this.node(link.toNode) ||
        !link.fromSocket ||
        !link.toSocket
      )
        throw new Error("连线引用未知节点或端口");
      if (
        type === "DISCONNECT" &&
        !this.graph.links.some((item) =>
          ["fromNode", "fromSocket", "toNode", "toSocket"].every(
            (key) => item[key] === link[key],
          ),
        )
      )
        throw new Error("待断开的连线不存在");
    }
  }

  apply(type, payload) {
    if (!commands.has(type)) throw new Error(`未知节点命令：${type}`);
    if (type === "CONNECT") {
      const error = this.policies.connectionError(this.graph, payload.link);
      if (error) {
        this.policies.onRejected?.(error);
        return { ok: false, error };
      }
    }

    const graph = this.graph;
    switch (type) {
      case "RENAME_NODE_ID": {
        this.node(payload.nodeId).id = payload.id;
        for (const link of graph.links) {
          if (link.fromNode === payload.nodeId) link.fromNode = payload.id;
          if (link.toNode === payload.nodeId) link.toNode = payload.id;
        }
        if (graph.outputNodeId === payload.nodeId)
          graph.outputNodeId = payload.id;
        break;
      }
      case "ADD_NODE":
        graph.nodes.push(clone(payload.node));
        if (payload.node.typeId === this.policies.outputType())
          graph.outputNodeId = payload.node.id;
        break;
      case "RENAME_NODE": {
        const node = this.node(payload.nodeId);
        if (node)
          node.title =
            String(payload.title || "").trim() || this.policies.nodeTitle(node);
        break;
      }
      case "MOVE_NODE": {
        const node = this.node(payload.nodeId);
        if (node)
          Object.assign(node, { canvasX: payload.x, canvasY: payload.y });
        graph.revision++;
        this.emit();
        return { ok: true };
      }
      case "SET_PROPERTY": {
        const node = this.node(payload.nodeId);
        if (node) node.properties[payload.key] = clone(payload.value);
        break;
      }
      case "SET_OUTPUT":
        if (this.node(payload.nodeId)) graph.outputNodeId = payload.nodeId;
        break;
      case "REMOVE_NODE":
        this.deleteNodes(new Set([payload.nodeId]));
        break;
      case "CONNECT":
        graph.links = graph.links.filter(
          (link) =>
            !(
              link.toNode === payload.link.toNode &&
              link.toSocket === payload.link.toSocket
            ),
        );
        graph.links.push(clone(payload.link));
        break;
      case "DISCONNECT":
        graph.links = graph.links.filter(
          (link) =>
            !(
              link.fromNode === payload.link.fromNode &&
              link.fromSocket === payload.link.fromSocket &&
              link.toNode === payload.link.toNode &&
              link.toSocket === payload.link.toSocket
            ),
        );
        break;
    }
    this.finishEdit();
    return { ok: true };
  }

  node(id) {
    return this.graph.nodes.find((node) => node.id === id);
  }

  moveNodes(nodes, record = true) {
    const positions = new Map(nodes.map((node) => [node.id, node]));
    if (!positions.size) return;
    if (record) this.checkpoint();
    this.graph.nodes.forEach((node) => {
      const position = positions.get(node.id);
      if (position)
        Object.assign(node, { canvasX: position.x, canvasY: position.y });
    });
    this.graph.revision++;
    this.emit();
  }

  removeNodes(nodeIds) {
    const ids = [...new Set(nodeIds)].filter((id) => this.node(id));
    if (!ids.length) return { ok: true };
    return this.batch(
      ids.map((nodeId) => ({ type: "REMOVE_NODE", payload: { nodeId } })),
    );
  }

  deleteNodes(ids) {
    this.graph.nodes = this.graph.nodes.filter((node) => !ids.has(node.id));
    this.graph.links = this.graph.links.filter(
      (link) => !ids.has(link.fromNode) && !ids.has(link.toNode),
    );
    if (ids.has(this.graph.outputNodeId)) this.graph.outputNodeId = null;
  }

  finishEdit() {
    this.policies.resolveTypes(this.graph);
    this.policies.pruneInvalidLinks(this.graph);
    this.graph.previewRevision = ++this.previewRevision;
    this.graph.revision++;
    this.emit();
  }
}

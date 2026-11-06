import { adoptComponents } from "../../packages/workflow-tools/custom-component-import.mjs";
import { copyJson } from "../../packages/plugin-sdk/schema.mjs";
import {
  templateOperations,
  createNodeIdAllocator,
  nodeIdBase,
  occupiedNodeIds,
} from "../../packages/workflow-tools/index.mjs";
import { starterGraph } from "../../packages/workflow-tools/defaults.mjs";
import { templatesManifest } from "./manifest.mjs";
import { presetWorkflowNodes } from "./presets.mjs";
import { mingGodSignGraph } from "./examples.mjs";
import wave from "./instanced-wave.workflow.json" with { type: "json" };
const envelope = (s) => ({
  documentId: s.project.id,
  documentToken: s.documentToken,
  stage: s.stage,
  expectedRevision: s.graph.revision,
  expectedDocumentRevision: s.documentRevision,
});
/** 纯 JSON 模板数据验证，不访问 UI 或某个节点插件的实现。 */
export function validateFragment(fragment) {
  if (
    !fragment ||
    !Array.isArray(fragment.nodes) ||
    !fragment.nodes.length ||
    !Array.isArray(fragment.links)
  )
    throw Error("模板需要节点和内部连线");
  if (fragment.nodes.length + fragment.links.length > 1000)
    throw Error("模板最多包含 1000 项操作");
  const ids = new Set();
  for (const n of fragment.nodes) {
    if (
      !n.id ||
      ids.has(n.id) ||
      !n.typeId ||
      ![n.canvasX, n.canvasY].every(Number.isFinite) ||
      !n.properties
    )
      throw Error("模板节点声明无效");
    ids.add(n.id);
  }
  for (const l of fragment.links)
    if (
      !ids.has(l.fromNode) ||
      !ids.has(l.toNode) ||
      !l.fromSocket ||
      !l.toSocket
    )
      throw Error("模板包含外部或无效连线");
  return copyJson(fragment);
}
/** 通过一次公开事务展开，按当前图分配可读且唯一的 ID，同步重连内部连线。 */
export function instantiate(fragment, x = 100, y = 100, existingIds = []) {
  const graph = validateFragment(fragment);
  adoptComponents(graph);
  if (![x, y].every(Number.isFinite)) throw Error("模板插入坐标必须为有限数值");
  const minX = Math.min(...graph.nodes.map((n) => n.canvasX)),
    minY = Math.min(...graph.nodes.map((n) => n.canvasY));
  const allocate = createNodeIdAllocator(existingIds);
  const ids = new Map(
    graph.nodes.map((n) => [n.id, allocate(nodeIdBase(n.typeId))]),
  );
  return {
    nodeIds: [...ids.values()],
    commands: [
      ...graph.nodes.map((n) => ({
        type: "ADD_NODE",
        payload: {
          node: {
            ...n,
            id: ids.get(n.id),
            canvasX: n.canvasX - minX + x,
            canvasY: n.canvasY - minY + y,
          },
        },
      })),
      ...graph.links.map((l) => ({
        type: "CONNECT",
        payload: {
          link: {
            ...l,
            fromNode: ids.get(l.fromNode),
            toNode: ids.get(l.toNode),
          },
        },
      })),
    ],
  };
}
export const templatesPlugin = {
  manifest: templatesManifest,
  activate(context) {
    const workflow = context.api("workflow.editor"),
      storage = context.api("workflow.template-storage");
    function saved() {
      const items = storage.read();
      if (!Array.isArray(items)) throw Error("模板存储格式无效");
      for (const item of items) {
        if (!item.id || !item.title || item.preset)
          throw Error("用户模板声明无效");
        validateFragment(item.graph);
      }
      return items;
    }
    const handlers = {
      list: () => ({ items: [...presetWorkflowNodes(), ...saved()] }),
      save({ title }) {
        const s = workflow.snapshot(),
          ids = new Set(s.selection),
          graph = {
            nodes: s.graph.nodes.filter((n) => ids.has(n.id)),
            links: s.graph.links.filter(
              (l) => ids.has(l.fromNode) && ids.has(l.toNode),
            ),
          };
        validateFragment(graph);
        const items = saved(),
          item = {
            id: "subgraph_" + crypto.randomUUID(),
            title: String(title || "工作流节点 " + (items.length + 1)).trim(),
            preset: false,
            description: "用户保存的组合节点",
            graph,
          };
        if (!item.title || item.title.length > 200)
          throw Error("模板名称需要 1–200 个字符");
        storage.write([...items, item]);
        return item;
      },
      remove({ id }) {
        const items = saved();
        if (!items.some((i) => i.id === id))
          throw Error("用户模板不存在，预设模板不可删除");
        storage.write(items.filter((i) => i.id !== id));
        return { removed: true };
      },
      expand({ id, x = 100, y = 100 }) {
        const item =
          id === "demo"
            ? { title: "演示节点", graph: starterGraph() }
            : handlers.list().items.find((i) => i.id === id);
        if (!item) throw Error("模板不存在：" + id);
        const s = workflow.snapshot(),
          plan = instantiate(item.graph, x, y, occupiedNodeIds(s.document)),
          result = workflow.execute({
            ...envelope(s),
            commands: plan.commands,
          });
        if (result?.then) throw Error("当前模板操作要求同步图事务");
        if (!result.ok) throw Error(result.error);
        return { ok: true, title: item.title, nodeIds: plan.nodeIds };
      },
      example({ id }) {
        if (id === "mingGod")
          return {
            config: {
              id: "workflow_" + crypto.randomUUID(),
              title: "明神印记旋涡",
              className: "Meng_MingGodSignPlugin",
              shaderDir: "data/shaders/meng",
              previewWidth: 1024,
              previewHeight: 1024,
            },
            graph: mingGodSignGraph(),
          };
        if (id === "instancedWave") return { workflow: copyJson(wave) };
        throw Error("示例不存在：" + id);
      },
    };
    context.provide("workflow.templates", handlers);
    context.api("workflow.operations").register(
      Object.entries(templateOperations).map(([name, id]) => ({
        id,
        title: "工作流模板 " + name,
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        run: handlers[name],
      })),
    );
  },
};

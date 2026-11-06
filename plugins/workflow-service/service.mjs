import { validateValue } from "../../packages/plugin-sdk/schema.mjs";
import {
  workflowEditSchema,
  workflowPropertySchema,
} from "../../packages/plugin-sdk/workflow-edit.mjs";
import {
  createNodeIdAllocator,
  nodeIdBase,
  occupiedNodeIds,
} from "../../packages/workflow-tools/index.mjs";

/** 工作流业务入口。草稿只在宿主中保存，节点构造、编辑编排与错误处理属于本插件。 */
export function createWorkflowService(port, presentation) {
  const guard = (s) => ({
    documentId: s.project.id,
    documentToken: s.documentToken,
    stage: s.stage,
    expectedRevision: s.graph.revision,
    expectedDocumentRevision: s.documentRevision,
  });
  function source(expected) {
    const s = port.snapshot();
    if (expected)
      for (const key of Object.keys(guard(s)))
        if (expected[key] !== undefined && expected[key] !== guard(s)[key])
          throw Error("工作流已改变，请重新读取快照：" + key);
    return s;
  }
  async function submit(input, s) {
    const result = await port.execute({ ...guard(s), ...input });
    if (!result.ok) throw Error(result.error);
    return result;
  }
  const api = {
    revision: () => port.revision(),
    snapshot: () => port.snapshot(),
    execute: (request) => port.execute(request),
    subscribe: (listener) => port.subscribe(listener),
    onActivity: (listener) => port.onActivity(listener),
    inspect(expected) {
      source(expected);
      return presentation.snapshot();
    },
    report: (message) => presentation.report({ message }),
    activity: () => presentation.activity(),
    async setProperty(input, expected) {
      validateValue(input, workflowPropertySchema);
      const s = source(expected),
        intent = presentation.edit(input);
      return submit(intent, s);
    },
    async edit(input, expected) {
      validateValue(input, workflowEditSchema);
      const s = source(expected),
        commands = [],
        added = [],
        occupied = new Set(occupiedNodeIds(s.document));
      // 显式 ID 先保留，避免自动 ID 抢占同批后续命名，不悄悄改掉用户给定的 ID。
      for (const item of input.add || [])
        if (item.id !== undefined) {
          if (
            !/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(item.id) ||
            occupied.has(item.id)
          )
            throw Error("节点 ID 无效或已被占用：" + item.id);
          occupied.add(item.id);
        }
      const allocate = createNodeIdAllocator(occupied);
      for (const nodeId of input.remove || [])
        commands.push({ type: "REMOVE_NODE", payload: { nodeId } });
      for (const item of input.add || []) {
        const def = s.catalog.find((d) => d.typeId === item.typeId);
        if (!def) throw Error("节点当前不可用：" + item.typeId);
        const id = item.id ?? allocate(nodeIdBase(item.typeId));
        const properties = {
          ...structuredClone(def.properties),
          previewEnabled: item.typeId !== "studio.math.constant",
          ...structuredClone(item.properties || {}),
        };
        if (["io.input", "input.texture"].includes(item.typeId)) {
          if (!Object.hasOwn(item.properties || {}, "parameterId"))
            properties.parameterId = id;
          if (!Object.hasOwn(item.properties || {}, "uniform"))
            properties.uniform = "u_" + id;
        }
        added.push(id);
        commands.push({
          type: "ADD_NODE",
          payload: {
            node: {
              id,
              typeId: item.typeId,
              title: item.title ?? def.title,
              canvasX: Math.round(item.x ?? 40 + added.length * 30),
              canvasY: Math.round(item.y ?? 60),
              properties,
            },
          },
        });
      }
      for (const link of input.disconnect || [])
        commands.push({ type: "DISCONNECT", payload: { link } });
      for (const link of input.connect || [])
        commands.push({ type: "CONNECT", payload: { link } });
      if (input.output !== undefined)
        commands.push({
          type: "SET_OUTPUT",
          payload: { nodeId: input.output },
        });
      if (!commands.length) throw Error("请提供至少一项编辑操作");
      return { ...(await submit({ commands }, s)), added };
    },
    async addNode(input, expected) {
      const result = await api.edit({ add: [input] }, expected);
      return { ...result, id: result.added[0] };
    },
  };
  return api;
}

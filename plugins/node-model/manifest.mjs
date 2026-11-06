const local = (methods) => ({
  version: "1.0.0",
  transport: "local",
  scoped: true,
  methods: Object.fromEntries(
    Object.entries(methods).map(([name, capability]) => [name, { capability }]),
  ),
});
/** 节点贡献与无状态图准备独立于编辑会话，算法与编译消费者无需启动编辑器。 */
export const nodeModelManifest = {
  id: "studio.node-model",
  layer: 2,
  name: "节点目录与图语义能力",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: { "platform.node-registry": "^1.0.0" },
  capabilities: ["nodes.host"],
  providesApis: {
    "workflow.nodes": local({
      list: "nodes.read",
      get: "nodes.read",
      register: "nodes.register",
    }),
    "workflow.node-catalog": local({
      list: "nodes.read",
      subscribe: "nodes.read",
    }),
    "workflow.graph-snapshot": local({
      identity: "graph.snapshot",
      describe: "graph.snapshot",
      prepare: "graph.snapshot",
    }),
  },
};

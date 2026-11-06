import { createNodeCatalog } from "./node-catalog.mjs";
import { createGraphSnapshotApi } from "./graph-snapshot.mjs";
import { createGraphSemantics } from "../../packages/workflow-tools/graph-semantics.mjs";
import { createGraphData } from "../../packages/workflow-tools/graph-data.mjs";
/** 只持有节点贡献，不持有当前文档、编辑会话、UI、文件选择器或 GPU。 */
export function createNodeModel(ports) {
  const contributions = ports.contributions(createNodeCatalog());
  const { catalog, registry } = contributions;
  const semantics = createGraphSemantics(
    () => catalog,
    () => "fragment",
  );
  const snapshots = createGraphSnapshotApi({
    semantics,
    data: createGraphData(semantics.nodeDef),
    registry,
  });
  return {
    nodeApi: contributions.createApi,
    snapshots,
    catalog: {
      list: () => structuredClone(catalog),
      subscribe: (fn) => registry.subscribe(fn),
    },
    dispose: contributions.dispose,
  };
}

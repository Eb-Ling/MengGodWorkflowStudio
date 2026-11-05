import { createNodeCatalog } from "./node-catalog.mjs";
import { createGraphSnapshotApi } from "./graph-snapshot.mjs";
import { createGraphSemantics } from "../../packages/workflow-tools/graph-semantics.mjs";
import { createGraphData } from "../../packages/workflow-tools/graph-data.mjs";
/** 只持有节点贡献，不持有当前文档、编辑会话、UI、文件选择器或 GPU。 */
export function createNodeModel(ports) {
  const preferences = ports.preferences();
  const read = (key, fallback) => {
    try {
      return JSON.parse(preferences.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };
  let overrides = read("workflow.customNodeOverrides", {}),
    customNodes = read("workflow.customNodes", []);
  const contributions = ports.contributions(
    createNodeCatalog({ overrides, customNodes }),
  );
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
  function publish() {
    const builtins = createNodeCatalog({ overrides, customNodes });
    catalog.splice(
      0,
      catalog.length,
      ...builtins,
      ...catalog.filter((n) => n.owner && n.owner !== "studio.builtin"),
    );
    contributions.replaceBuiltins();
  }
  return {
    nodeApi: contributions.createApi,
    snapshots,
    catalog: {
      list: () => structuredClone(catalog),
      subscribe: (fn) => registry.subscribe(fn),
      customNodes: () => structuredClone(customNodes),
      setCustom(input) {
        const definition = structuredClone(input);
        if (!/^custom\.[A-Za-z0-9._-]+$/.test(definition.typeId))
          throw Error("只能配置自定义节点");
        if (
          ["custom.radialFade", "custom.innerFade"].includes(definition.typeId)
        ) {
          const next = { ...overrides, [definition.typeId]: definition };
          preferences.setItem(
            "workflow.customNodeOverrides",
            JSON.stringify(next),
          );
          overrides = next;
        } else {
          const next = [
            ...customNodes.filter((n) => n.typeId !== definition.typeId),
            definition,
          ];
          preferences.setItem("workflow.customNodes", JSON.stringify(next));
          customNodes = next;
        }
        publish();
      },
      removeCustom(id) {
        if (
          !id.startsWith("custom.") ||
          ["custom.radialFade", "custom.innerFade"].includes(id)
        )
          throw Error("只能删除用户自定义节点");
        const next = customNodes.filter((n) => n.typeId !== id);
        preferences.setItem("workflow.customNodes", JSON.stringify(next));
        customNodes = next;
        publish();
      },
    },
    dispose: contributions.dispose,
  };
}

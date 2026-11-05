import { nodeModelManifest } from "./manifest.mjs";
import { createNodeModel } from "./service.mjs";
export const nodeModelPlugin = {
  manifest: nodeModelManifest,
  activate(context) {
    const service = createNodeModel(context.api("platform.node-registry"));
    context.onDispose(() => service.dispose());
    context.provide("workflow.nodes", service.nodeApi);
    context.provide("workflow.graph-snapshot", () => service.snapshots);
    context.provide("workflow.node-catalog", (owner, own) => ({
      list: service.catalog.list,
      customNodes: service.catalog.customNodes,
      subscribe(listener) {
        const off = service.catalog.subscribe(listener);
        own(off);
        return off;
      },
      setCustom(definition) {
        if (owner !== "studio.workflow-service")
          throw Error("自定义节点配置只能通过编辑能力提交");
        return service.catalog.setCustom(definition);
      },
      removeCustom(id) {
        if (owner !== "studio.workflow-service")
          throw Error("自定义节点配置只能通过编辑能力提交");
        return service.catalog.removeCustom(id);
      },
    }));
  },
};

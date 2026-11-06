import { ownCleanup } from "../../packages/plugin-sdk/registration.mjs";
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
      subscribe(listener) {
        const off = service.catalog.subscribe(listener);
        return ownCleanup(own, off);
      },
    }));
  },
};

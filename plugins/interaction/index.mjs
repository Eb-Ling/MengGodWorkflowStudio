import { layoutOperations } from "../../packages/workflow-tools/index.mjs";
import { interactionManifest } from "./manifest.mjs";
import { createStrategyRegistry } from "./registry.mjs";
export const interactionPlugin = {
  manifest: interactionManifest,
  activate(context) {
    const operations = context.api("workflow.operations");
    const registry = createStrategyRegistry([
      {
        id: "studio.interaction.intersect",
        title: "相交即选中",
        kind: "selection",
        run: ({ bounds, box }) => ({
          nodeIds: bounds
            .filter(
              (n) =>
                n.x < box.x + box.width &&
                n.x + n.width > box.x &&
                n.y < box.y + box.height &&
                n.y + n.height > box.y,
            )
            .map((n) => n.id),
        }),
      },
      {
        id: "studio.interaction.contain",
        title: "完整包围才选中",
        kind: "selection",
        run: ({ bounds, box }) => ({
          nodeIds: bounds
            .filter(
              (n) =>
                n.x >= box.x &&
                n.y >= box.y &&
                n.x + n.width <= box.x + box.width &&
                n.y + n.height <= box.y + box.height,
            )
            .map((n) => n.id),
        }),
      },
      {
        id: "studio.interaction.document-order",
        title: "文档顺序",
        kind: "layers",
        run: ({ nodes }) => ({ nodeIds: nodes.map((n) => n.id) }),
      },
      {
        id: "studio.interaction.selected-front",
        title: "选中节点置前",
        kind: "layers",
        run: ({ nodes, selection }) => ({
          nodeIds: [
            ...nodes.filter((n) => !selection.includes(n.id)),
            ...nodes.filter((n) => selection.includes(n.id)),
          ].map((n) => n.id),
        }),
      },
      {
        id: "studio.interaction.auto-layout",
        title: "控制区域安全布局",
        kind: "layout",
        run: (input) => operations.execute(layoutOperations.plan, input),
      },
    ]);
    context.onDispose(() => registry.dispose());
    context.provide("workflow.interaction", registry.scoped);
  },
};

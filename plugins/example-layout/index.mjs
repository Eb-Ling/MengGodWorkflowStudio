import { layoutManifest } from "./manifest.mjs";
/** 提供者只负责坐标计算，不依赖画布、UI、MCP 或消费者实现。 */
export const layoutPlugin = {
  manifest: layoutManifest,
  activate(context) {
    context.provide("example.layout.grid", {
      /** count 为节点数量，返回可直接放入 MOVE_NODE 的世界坐标。 */
      positions({ count, columns = 4, spacing = 260 }) {
        return Array.from({ length: count }, (_, index) => ({
          x: 100 + (index % columns) * spacing,
          y: 120 + Math.floor(index / columns) * spacing,
        }));
      },
    });
  },
};

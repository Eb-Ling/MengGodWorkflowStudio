/** 插件间共享数据协议、操作 ID 和无状态基础函数，不共享实现实例。 */
export {
  createNodeIdAllocator,
  nodeIdBase,
  occupiedNodeIds,
} from "./node-ids.mjs";
const object = { type: "object" },
  args = { type: "array", minItems: 1, maxItems: 1, items: object };
export const api = (methods, capability) => ({
  version: "1.0.0",
  methods: Object.fromEntries(
    methods.map((name) => [
      name,
      { arguments: args, returns: object, capability },
    ]),
  ),
});
export const templateOperations = {
  list: "studio.templates.list",
  save: "studio.templates.save",
  remove: "studio.templates.remove",
  expand: "studio.templates.expand",
  example: "studio.templates.example",
};
export const layoutOperations = {
  plan: "studio.layout.plan",
  arrange: "studio.layout.arrange",
};
/** 高分辨率按长边缩放，保持工作流宽高比，最大 4096，不改变项目设置。 */
export function enlargedSize(width = 1024, height = 1024, longEdge = 2048) {
  if (![width, height, longEdge].every((n) => Number.isFinite(n) && n > 0))
    throw Error("预览尺寸必须为正数");
  const scale =
    Math.min(4096, Math.max(64, longEdge)) / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 公共契约包：只有标识、版本和数据 schema，没有布局算法或插件实现。 */
export const LAYOUT_API = "example.layout.grid";
export const layoutContract = {
  version: "1.0.0",
  methods: {
    positions: {
      arguments: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: {
          type: "object",
          required: ["count"],
          properties: {
            count: { type: "integer", minimum: 1, maximum: 100 },
            columns: { type: "integer", minimum: 1, maximum: 20 },
            spacing: { type: "number", minimum: 20, maximum: 1000 },
          },
          additionalProperties: false,
        },
      },
      returns: {
        type: "array",
        items: {
          type: "object",
          required: ["x", "y"],
          properties: { x: { type: "number" }, y: { type: "number" } },
          additionalProperties: false,
        },
      },
    },
  },
};

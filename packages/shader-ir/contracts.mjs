/** 后端协议：单参数/单结果，只有 JSON。后续可经 IPC 或 WASM 实现同一协议。 */
export const backendApi = {
  version: "1.0.0",
  methods: {
    emit: {
      arguments: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: {
          type: "object",
          required: ["target", "module"],
          properties: {
            target: { type: "string" },
            module: { type: "object" },
          },
          additionalProperties: false,
        },
      },
      returns: {
        type: "object",
        required: ["ok", "source", "diagnostics", "reflection", "sourceMap"],
        properties: {
          ok: { type: "boolean" },
          source: { type: "string" },
          diagnostics: { type: "array" },
          reflection: { type: "object" },
          sourceMap: { type: "array" },
        },
        additionalProperties: false,
      },
      capability: "shaders.emit",
    },
  },
};
export const compilationOperations = {
  describe: "studio.compiler.describe",
  lower: "studio.compiler.lower",
  preview: "studio.compiler.preview",
};

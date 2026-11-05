const json = { type: "object" },
  single = { type: "array", minItems: 1, maxItems: 1, items: json };
export const compilerManifest = {
  id: "studio.compiler", layer:2,
  name: "工作流编译前端",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "workflow.graph-snapshot": "^1.0.0",
    "shader.backend.glsl": "^1.0.0",
    "workflow.operations": "^1.0.0",
  },
  providesApis: {
    "workflow.compilation": {
      version: "1.0.0",
      methods: Object.fromEntries(
        ["describe", "lower", "preview", "identity", "status"].map((name) => [
          name,
          { arguments: name === "status" ? { type: "array", maxItems: 0 } : single, returns: json, capability: "shaders.compile" },
        ]),
      ),
    },
  },
  capabilities: ["graph.snapshot", "shaders.emit", "operations.register"],
};

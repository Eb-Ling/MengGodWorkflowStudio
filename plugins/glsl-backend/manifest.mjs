import { backendApi } from "../../packages/shader-ir/contracts.mjs";
export const glslManifest = {
  id: "studio.glsl", layer:2,
  name: "GLSL 编译后端",
  version: "1.0.0",
  apiVersion: "1.0.0",
  activationEvents: ["onApi:shader.backend.glsl"],
  requiredApis: {},
  providesApis: { "shader.backend.glsl": backendApi },
  capabilities: [],
};

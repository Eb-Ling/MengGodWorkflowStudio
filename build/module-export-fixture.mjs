import { shader, constant } from "../packages/shader-ir/index.mjs";
import { backend } from "./compiler-pipeline-support.mjs";
/** 无图开发夹具，实际 UI/MCP 下载验收不使用它。 */
export const loweredVertex = {
  schemaVersion: 1,
  stage: "vertex",
  body: [],
  functions: [],
  inputs: [],
  textures: [],
  outputs: {
    position: shader.symbol("VEC2", "a_position"),
    uv: shader.symbol("VEC2", "v_uv"),
  },
};
export const loweredFragment = {
  schemaVersion: 1,
  stage: "fragment",
  body: [],
  functions: [],
  inputs: [],
  textures: [],
  outputs: { color: constant("VEC4", 1) },
};
export const exportFixture = {
  config: { className: "TestEffect", shaderDir: "data/shaders/test" },
  transform: {},
  inputs: [],
  textures: [],
  vertex: loweredVertex,
  fragment: loweredFragment,
  backend,
};

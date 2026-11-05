import {
  LAYOUT_API,
  layoutContract,
} from "../../packages/example-layout-api/index.mjs";
/** 提供者声明公开布局契约，与任何消费者都无实现依赖。 */
export const layoutManifest = {
  id: "example.layout", layer:2,
  name: "示例：布局 API 提供者",
  developmentOnly: true,
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {},
  providesApis: { [LAYOUT_API]: layoutContract },
};

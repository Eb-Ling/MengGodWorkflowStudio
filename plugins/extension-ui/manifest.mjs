import {
  extensionUiApi,
  extensionUiContract,
} from "../../packages/plugin-sdk/extension-ui.mjs";
export const extensionUiManifest = {
  id: "studio.extension-ui", layer:2,
  name: "隔离插件面板",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: { "studio.ui": "^1.0.0" },
  capabilities: ["ui.panels"],
  providesApis: { [extensionUiApi]: extensionUiContract },
};

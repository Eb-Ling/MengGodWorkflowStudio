import { extensionPlatformContract } from "../../packages/plugin-sdk/extension-platform.mjs";
const methods = [
  "snapshot",
  "authorized",
  "authorize",
  "registerAuthorized",
  "revokeAuthorization",
  "previewDisable",
  "openDirectory",
  "openWindow",
  "subscribe",
  "choose",
  "inspect",
  "install",
  "reload",
  "setEnabled",
  "remove",
  "downloadKit",
];
export const pluginServiceManifest = {
  id: "studio.plugin-service",
  layer: 2,
  name: "插件安装与管理能力",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "platform.extension-transport": "^1.0.0",
    "platform.plugin-host": "^1.0.0",
    "platform.browser": "^1.0.0",
    "platform.downloads": "^1.0.0",
  },
  capabilities: ["plugins.host", "platform.network", "downloads.write"],
  providesApis: {
    "platform.extension": extensionPlatformContract,
    "studio.plugins": {
      version: "1.0.0",
      transport: "local",
      scoped: true,
      methods: Object.fromEntries(
        methods.map((name) => [name, { capability: "plugins.manage" }]),
      ),
    },
  },
};

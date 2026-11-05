export const declarationsManifest = {
  id: "studio.declarations", layer:2,
  name: "无脚本声明式插件",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "studio.extension-ui": "^1.0.0",
    "workflow.editor": "^1.0.0",
  },
  // 显式声明提供者图，执行只使用调用者的代理，不借用提供者权限。
  capabilities: [],
  providesApis: {
    "studio.declarations": {
      version: "1.0.0",
      transport: "local",
      scoped: true,
      methods: { mount: { capability: "declarations.mount" } },
    },
  },
};

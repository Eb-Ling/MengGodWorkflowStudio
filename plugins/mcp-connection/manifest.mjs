export const mcpConnectionManifest = {
  id: "studio.mcp-connection",
  layer: 2,
  name: "MCP 连接与草稿会话",
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis: {
    "workflow.workspace": "^1.0.0",
    "workflow.preview": "^1.0.0",
    "studio.plugins": "^1.0.0",
    "studio.extension-ui": "^1.0.0",
    "platform.browser": "^1.0.0",
  },
  capabilities: [
    "workflow.read",
    "workflow.write",
    "preview.render",
    "plugins.manage",
    "extension.ui.inspect",
    "platform.network",
  ],
  providesApis: {
    "studio.mcp-connection": {
      version: "1.0.0",
      transport: "local",
      scoped: true,
      methods: { createSession: { capability: "mcp.connect" } },
    },
  },
};

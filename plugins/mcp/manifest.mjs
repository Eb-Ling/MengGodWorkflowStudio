export const manifest = Object.freeze({
  id: "studio.mcp",
  layer: 3,
  name: "MCP 工作流接入",
  version: "1.0.0",
  apiVersion: "1.0.0",
  capabilities: ["ui.panels", "mcp.connect"],
  requiredApis: { "studio.ui": "^1.0.0", "studio.mcp-connection": "^1.0.0" },
});
export const serverManifest = Object.freeze({
  ...manifest,
  layer: 2,
  capabilities: ["http.routes"],
  requiredApis: { "platform.http": "^1.0.0" },
});

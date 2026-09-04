const { contextBridge } = require('electron');
const path = require('node:path');

const root = process.resourcesPath;
contextBridge.exposeInMainWorld('workflowDesktop', {
  packaged: true,
  executablePath: process.execPath,
  mcpServerPath: path.join(root, 'ai-gateway', 'mcp-server.mjs')
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workflowDesktop', {
  packaged: true,
  testMcp: () => ipcRenderer.invoke('workflowDesktop:testMcp'),
  getMcpConfig: () => ipcRenderer.invoke('workflowDesktop:getMcpConfig')
});

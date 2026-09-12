const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

const root = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
const gateway = path.join(root, 'ai-gateway', 'server.mjs');
const mcpServer = path.join(root, 'ai-gateway', 'mcp-server.mjs');
const icon = path.join(root, 'assets', 'workflow-studio.ico');
let bridge;
let bridgePort = null;
let shuttingDown = false;

function reservePort(preferredPort = 4174) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    const listen = port => server.listen(port, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
    server.once('error', error => {
      if (error.code === 'EADDRINUSE' && preferredPort) {
        server.removeAllListeners('error');
        server.once('error', reject);
        listen(0);
        return;
      }
      reject(error);
    });
    listen(preferredPort);
  });
}

function waitForBridge(port, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`本地页面桥接未能在 ${timeoutMs / 1000} 秒内启动。`)), timeoutMs);
    const check = () => {
      const request = http.get(`http://127.0.0.1:${port}/health`, response => {
        response.resume();
        if (response.statusCode === 200) { clearTimeout(timeout); return resolve(); }
        setTimeout(check, 100);
      });
      request.on('error', () => setTimeout(check, 100));
      request.setTimeout(500, () => request.destroy());
    };
    check();
  });
}

async function createWindow() {
  const port = await reservePort();
  bridgePort = port;
  bridge = spawn(process.execPath, [gateway], {
    cwd: path.dirname(gateway),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', WORKFLOW_BRIDGE_PORT: String(port) },
    stdio: 'ignore',
    windowsHide: true
  });
  bridge.on('error', error => dialog.showErrorBox('启动失败', `本地桥接服务无法启动：${error.message}`));
  bridge.once('exit', code => { if (!shuttingDown && code !== 0) dialog.showErrorBox('页面桥接已停止', `本地页面桥接服务异常退出（代码 ${code}）。`); });
  await waitForBridge(port);
  const window = new BrowserWindow({ width: 1440, height: 920, minWidth: 980, minHeight: 680, title: 'MengGod Workflow Studio', icon, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  await window.loadURL(`http://127.0.0.1:${port}/?bridgePort=${port}`);
}

function testMcpServer() {
  return new Promise((resolve, reject) => {
    if (!bridgePort) return reject(new Error('页面桥接尚未启动。'));
    const child=spawn(process.execPath,[mcpServer],{cwd:path.dirname(mcpServer),env:{...process.env,ELECTRON_RUN_AS_NODE:'1',WORKFLOW_BRIDGE_URL:`http://127.0.0.1:${bridgePort}`},stdio:['pipe','pipe','pipe'],windowsHide:true});
    let buffer='',tools=null,settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timeout);if(!child.killed)child.kill();if(error)reject(error);else resolve(result);};
    const timeout=setTimeout(()=>finish(new Error('stdio MCP 自检超时。')),5000);
    child.once('error',error=>finish(error));
    child.stderr.on('data',chunk=>{const text=String(chunk).trim();if(text)console.warn('MCP self-test stderr:',text);});
    child.stdout.on('data',chunk=>{buffer+=String(chunk);let newline;while((newline=buffer.indexOf('\n'))>=0){const raw=buffer.slice(0,newline);buffer=buffer.slice(newline+1);try{const message=JSON.parse(raw);if(message.id===1&&message.error)throw new Error(message.error.message||'MCP initialize failed');if(message.id===1){const request={jsonrpc:'2.0',id:2,method:'tools/list',params:{}};child.stdin.write(`${JSON.stringify(request)}\n`);}if(message.id===2){tools=(message.result?.tools||[]).map(tool=>tool.name);finish(null,{bridgeUrl:`http://127.0.0.1:${bridgePort}`,stdioReady:true,toolCount:tools.length,requiredTools:['workflow_get_status','workflow_get_summary','workflow_submit_commands'],tools});}}catch(error){finish(error);}}});
    const initialize={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'MengGod Workflow Studio',version:'1.0.7'}}};
    child.stdin.write(`${JSON.stringify(initialize)}\n`);
  });
}

ipcMain.handle('workflowDesktop:testMcp', () => testMcpServer());
ipcMain.handle('workflowDesktop:getMcpConfig', () => ({
  executablePath: process.execPath,
  mcpServerPath: mcpServer
}));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { shuttingDown = true; if (bridge && !bridge.killed) bridge.kill(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { shuttingDown = true; if (bridge && !bridge.killed) bridge.kill(); });

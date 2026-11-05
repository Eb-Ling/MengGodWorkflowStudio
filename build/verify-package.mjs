import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {pluginDevkitBytes} from './package-plugin-devkit.mjs';

const root=path.resolve(import.meta.dirname,'..');
const {version}=JSON.parse(await fs.readFile(path.join(root,'desktop/package.json'),'utf8'));
const releaseFolder=process.env.WORKFLOW_RELEASE_FOLDER||`MengGod-Workflow-Studio-${version}-win-x64`;
if(path.basename(releaseFolder)!==releaseFolder||!releaseFolder.startsWith('MengGod-Workflow-Studio-'))throw Error('Invalid release folder');
const output=path.join(root,'release',releaseFolder);
await import("./verify-release-files.mjs");
assert.deepEqual(new Uint8Array(await fs.readFile(path.join(output,'resources/frontend/assets/developer/workflow-plugin-devkit-1.0.0.zip'))),await pluginDevkitBytes(),'Packaged SDK differs from source/docs');
const child=spawn(path.join(output,'MengGod Workflow Studio.exe'),[path.join(output,'resources/ai-gateway/mcp-client.mjs')],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true});
const lines=createInterface({input:child.stdout});
try{
  const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Packaged MCP did not answer')),10000);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    lines.on('line',line=>{
      try{
        const message=JSON.parse(line);if(message.error)throw new Error(message.error.message);
        if(message.id===1)child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})+'\n');
        if(message.id===2){clearTimeout(timer);resolve(message.result);}
      }catch(error){clearTimeout(timer);reject(error);}
    });
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'package-test',version:'1'}}})+'\n');
  });
  assert.ok(result.tools.some(tool=>tool.name==='workflow_set_stage'));
  const schema=result.tools.find(tool=>tool.name==='workflow_set_vertex_transform').inputSchema.properties.graph;
  assert.ok(schema.properties.links&&schema.properties.outputNodeId);
  console.log(`PASS: Electron stdio MCP exposes ${result.tools.length} tools and the shared-stage schema`);
}finally{lines.close();child.kill();}

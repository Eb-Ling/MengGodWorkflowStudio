import {createRequire} from 'node:module';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {buildRuntimeSources} from '../frontend/export/runtime-exporter.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),port=Number(process.env.TEST_PORT||4187),base=`http://127.0.0.1:${port}`,out=path.join(root,'build/verification');
const server=spawn(process.execPath,['ai-gateway/server.mjs'],{cwd:root,env:{...process.env,WORKFLOW_BRIDGE_PORT:String(port)},windowsHide:true});
let browser;const errors=[];
try{
  for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1500,height:950},acceptDownloads:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base+"/?bridgePort="+port);await page.waitForSelector('.workflow-node');
  await page.click('#workflow-manager');await page.click('#bridge-check');await page.waitForFunction(()=>document.querySelector('#bridge-status').textContent.includes('已激活'));await page.click('#close-workflow-dialog');
  const result=await promisify(execFile)('pwsh',['-NoProfile','-File','build/verify-workflow-export.ps1','-base',base],{cwd:root,windowsHide:true,timeout:120000,maxBuffer:2e6});console.log(result.stdout);
  await fs.mkdir(out,{recursive:true});const cases=JSON.parse((await fs.readFile(path.join(root,'build/workflow-export-verification-results.json'),'utf8')).replace(/^\uFEFF/,''));
  for(const c of cases){const C=c.Java.match(/public final class (\w+)/)[1];await fs.writeFile(path.join(out,C+'.java'),c.Java);await fs.writeFile(path.join(out,C+'.vert'),c.Vertex);await fs.writeFile(path.join(out,C+'.frag'),c.Fragment);}
  const action=async(type,payload)=>{const r=await fetch(base+'/v1/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actions:[{type,payload}]})});const j=await r.json();assert.ok(r.ok,j.error);return j;};
  const workflow={schemaVersion:1,project:{id:'instance-test',title:'实例回归',className:'VerifyInstancePlugin',shaderDir:'data/shaders/generated'},graph:{nodes:[{id:'color',typeId:'io.input',title:'实例颜色',canvasX:50,canvasY:50,properties:{uniform:'u_color',scope:'instance',valueType:'VEC4',defaultValue:'1,0,0,1'}},{id:'scale',typeId:'io.input',title:'实例缩放',canvasX:50,canvasY:270,properties:{uniform:'u_scale',scope:'instance',valueType:'FLOAT',defaultValue:'1'}},{id:'out',typeId:'io.output',title:'输出',canvasX:500,canvasY:50,properties:{}}],links:[{fromNode:'color',fromSocket:'value',toNode:'out',toSocket:'color'}],outputNodeId:'out'}};
  await action('IMPORT_WORKFLOW_DATA',{workflow});await action('SAVE_WORKFLOW',{});
  await page.locator('.workflow-node[data-id="color"] header').click();assert.equal(await page.getByLabel('参数作用域').inputValue(),'instance');
  await page.getByRole('link',{name:'顶点工作流'}).click();await page.waitForSelector('#vn-output');
  await page.locator('#sx').fill('0');await page.locator('#sx').press('Tab');
  await page.locator('#preview-count').fill('9');assert.equal(await page.locator('#vertex-preview polygon').count(),9);
  await page.locator('#sx').fill('1');await page.locator('#sx').press('Tab');
  await page.click('#vertex-wave');await page.locator('#preview-time').fill('1.57');await page.locator('#preview-time').press('Tab');
  assert.match(await page.locator('#vertex-code').textContent(),/sin/);
  // Replace amplitude constant with a typed instance parameter through actual controls.
  await page.click('[data-add="parameter"]');const param=page.locator('[data-parameter]').last();await param.selectOption('u_scale');const paramId=await param.getAttribute('data-parameter');
  await page.locator('[data-node="motion"][data-input="b"]').selectOption(paramId);
  await page.locator('#preview-selected').fill('2');await page.locator('[data-preview-param="u_scale"]').fill('90');await page.locator('[data-preview-param="u_scale"]').press('Tab');
  const previewY=await page.locator('#vertex-preview polygon').evaluateAll(nodes=>nodes.slice(0,2).map(n=>Number(n.getAttribute('points').split(' ')[0].split(',')[1])));assert.notEqual(previewY[0],previewY[1]);
  await page.click('#save-vertex');await page.click('#fit-vertex');await page.screenshot({path:path.join(out,'vertex-editor.png')});
  await page.getByRole('link',{name:'片段工作流',exact:true}).first().click();await page.waitForSelector('.workflow-node');
  await page.click('#workflow-manager');await page.click('#bridge-check');await page.waitForFunction(()=>document.querySelector('#bridge-status').textContent.includes('已激活'));await page.click('#close-workflow-dialog');
  const download=page.waitForEvent('download');await page.click('#export-runtime');await (await download).saveAs(path.join(out,'VerifyInstancePlugin.zip'));
  await page.waitForTimeout(300);const state=await (await fetch(base+'/v1/state')).json();assert.match(state.generatedSources.vertex.content,/wf_vertex_motion/);assert.match(state.generatedSources.fragment.content,/flat in vec4/);
  for(const kind of ['java','vertex','fragment']){const f=state.generatedSources[kind];await fs.writeFile(path.join(out,path.basename(f.filename)),f.content);}
  assert.equal(state.vertexTransform.graph.nodes.find(n=>n.id==='motion').inputs.b,paramId);
  // Reload saved workflow, proving vertex graphs are carried through library/import/export.
  await action('OPEN_WORKFLOW',{id:'instance-test'});const again=await(await fetch(base+'/v1/state')).json();assert.equal(again.vertexTransform.graph.nodes.find(n=>n.id==='motion').inputs.b,paramId);
  await page.click('#workflow-manager');await page.click('#open-instance-example');await page.waitForFunction(()=>document.querySelector('#workflow-name').textContent==='实例波动四边形');
  const exampleDownload=page.waitForEvent('download');await page.click('#export-runtime');await(await exampleDownload).saveAs(path.join(out,'InstancedWave.zip'));
  await page.waitForTimeout(300);const exampleState=await(await fetch(base+'/v1/state')).json();assert.match(exampleState.generatedSources.vertex.content,/wf_vertex_deformed/);
  for(const kind of ['java','vertex','fragment']){const f=exampleState.generatedSources[kind];await fs.writeFile(path.join(out,path.basename(f.filename)),f.content);}
  const abiInputs=['BOOL','INT','UINT','FLOAT','VEC2','VEC3','VEC4'].map((type,i)=>({name:'u_p'+i,type,scope:'instance'}));
  const abi=buildRuntimeSources({config:{className:'VerifyAbiPlugin',shaderDir:'data/shaders/test'},inputs:abiInputs,textures:[],transform:{},fragment:'#version 420\nin vec2 v_uv;\nout vec4 fragColor;\nuniform float u_time;\n'+abiInputs.map(p=>'uniform '+p.type.toLowerCase()+' '+p.name+';').join('\n')+'\nvoid main(){fragColor=u_p0?u_p6+vec4(u_p4,float(u_p1)+float(u_p2)+u_p3+u_p5.z,0):vec4(0);}'});
  for(const kind of ['java','vertex','fragment'])await fs.writeFile(path.join(out,path.basename(abi[kind].filename)),abi[kind].content);
  assert.deepEqual(errors,[]);console.log(`PASS: ${cases.length} legacy exports + instance shader / vertex UI / save-reload / ZIP, no page errors`);
}finally{await browser?.close();server.kill();}

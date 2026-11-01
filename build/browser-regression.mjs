import {createInterface} from 'node:readline';
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

  // Reuse every established fragment graph as a vertex graph: same node semantics,
  // only the downstream adapter changes (RGBA -> vec2 -> vertex.output).
  for(const c of cases){
    const g=structuredClone(c.Graph),color=g.links.find(l=>l.toNode===g.outputNodeId&&l.toSocket==='color');g.nodes=g.nodes.filter(n=>n.typeId!=='io.output');g.links=g.links.filter(l=>l.toNode!==g.outputNodeId);
    const node=(id,typeId,properties={})=>({id,typeId,title:id,canvasX:3000,canvasY:1200,properties});
    g.nodes.push(node('stage_split','vector.split',{valueType:'VEC4'}),node('stage_xy','vector.combine',{valueType:'VEC2'}),node('stage_uv','input.uv'),node('stage_out','vertex.output'));
    const link=(fromNode,fromSocket,toNode,toSocket)=>({fromNode,fromSocket,toNode,toSocket});g.links.push(link(color.fromNode,color.fromSocket,'stage_split','value'),link('stage_split','x','stage_xy','x'),link('stage_split','y','stage_xy','y'),link('stage_xy','value','stage_out','position'),link('stage_uv','uv','stage_out','uv'));g.outputNodeId='stage_out';
    const fragment={nodes:[node('white','math.constant',{valueType:'VEC4',value:'1,1,1,1'}),node('out','io.output')],links:[link('white','value','out','color')],outputNodeId:'out'};
    await action('IMPORT_WORKFLOW_DATA',{workflow:{schemaVersion:1,project:{id:'vertex-'+c.Name,title:c.Name,className:'Vertex_'+c.Name,shaderDir:'data/shaders/generated'},graph:fragment,vertexTransform:{graph:g}}});
    await action('EXPORT_RUNTIME',{});const state=await(await fetch(base+'/v1/state')).json();
    for(const kind of ['java','vertex','fragment']){const f=state.generatedSources[kind];await fs.writeFile(path.join(out,path.basename(f.filename)),f.content);}
  }
  const workflow={schemaVersion:1,project:{id:'instance-test',title:'实例回归',className:'VerifyInstancePlugin',shaderDir:'data/shaders/generated'},graph:{nodes:[{id:'color',typeId:'io.input',title:'实例颜色',canvasX:50,canvasY:50,properties:{uniform:'u_color',scope:'instance',valueType:'VEC4',defaultValue:'1,0,0,1'}},{id:'scale',typeId:'io.input',title:'实例缩放',canvasX:50,canvasY:270,properties:{uniform:'u_scale',scope:'instance',valueType:'FLOAT',defaultValue:'1'}},{id:'out',typeId:'io.output',title:'输出',canvasX:500,canvasY:50,properties:{}}],links:[{fromNode:'color',fromSocket:'value',toNode:'out',toSocket:'color'}],outputNodeId:'out'}};
  await action('IMPORT_WORKFLOW_DATA',{workflow});await action('SAVE_WORKFLOW',{});
  await page.locator('.workflow-node[data-id="color"] header').click();assert.equal(await page.getByLabel('参数作用域').inputValue(),'instance');

  await page.getByLabel('参数 ID',{exact:true}).fill('class');await page.getByLabel('参数 ID',{exact:true}).press('Tab');assert.equal(await page.getByLabel('参数 ID',{exact:true}).getAttribute('aria-invalid'),'true');
  await page.getByLabel('参数 ID',{exact:true}).fill('instanceTint');await page.getByLabel('参数 ID',{exact:true}).press('Tab');assert.equal(await page.locator('.workflow-node[data-id="color"] .node-id').textContent(),'instanceTint');
  const stateNow=async()=>{await page.waitForTimeout(350);return (await(await fetch(base+'/v1/state')).json());};
  const graphNow=()=>page.evaluate(()=>{const stage=document.body.dataset.stage;return JSON.parse(sessionStorage.getItem(stage==='vertex'?'workflow.vertexTransform':'workflow.graph'))[stage==='vertex'?'graph':'__unused']||JSON.parse(sessionStorage.getItem('workflow.graph'));});
  async function parity(stage,ids){
    await page.locator('a[data-stage="'+stage+'"]').click();await action('SET_VIEW',{x:0,y:0,zoom:1});
    assert.equal(await page.locator('body').getAttribute('data-stage'),stage);
    assert.equal(await page.locator('.catalog-node[data-type="'+(stage==='vertex'?'io.output':'vertex.output')+'"]').count(),0);
    const shell=await page.locator('#canvas-shell').boundingBox();
    await page.mouse.move(shell.x+shell.width-50,shell.y+shell.height-80);const before=await page.locator('#graph-transform').getAttribute('style');await page.mouse.wheel(0,-120);await page.waitForTimeout(150);assert.notEqual(await page.locator('#graph-transform').getAttribute('style'),before);
    await page.mouse.down({button:'middle'});await page.mouse.move(shell.x+shell.width-20,shell.y+shell.height-40);await page.mouse.up({button:'middle'});assert.notEqual(await page.locator('#graph-transform').getAttribute('style'),before);
    await action('SET_VIEW',{x:0,y:0,zoom:1});
    // Actual Shift-drag marquee, followed by one drag moving both selected nodes.
    const rects=await Promise.all(ids.map(id=>page.locator('.workflow-node[data-id="'+id+'"]').boundingBox()));
    const left=Math.min(...rects.map(r=>r.x))-10,top=Math.min(...rects.map(r=>r.y))-10,right=Math.max(...rects.map(r=>r.x+r.width))+10,bottom=Math.max(...rects.map(r=>r.y+r.height))+10;
    await page.keyboard.down('Shift');await page.mouse.move(left,top);await page.mouse.down();await page.mouse.move(right,bottom,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');assert.equal(await page.locator('.workflow-node.selected').count(),ids.length);
    const original=await graphNow(),h=await page.locator('.workflow-node[data-id="'+ids[0]+'"] header').boundingBox();await page.mouse.move(h.x+50,h.y+10);await page.mouse.down();await page.mouse.move(h.x+90,h.y+40,{steps:5});await page.mouse.up();
    const moved=await graphNow();ids.forEach(id=>assert.equal(moved.nodes.find(n=>n.id===id).canvasX-original.nodes.find(n=>n.id===id).canvasX,40));
    await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');assert.equal((await graphNow()).nodes.length,original.nodes.length+ids.length);
    await page.keyboard.press('Control+z');assert.equal((await graphNow()).nodes.length,original.nodes.length);
    await page.keyboard.press('Control+y');assert.equal((await graphNow()).nodes.length,original.nodes.length+ids.length);
    await action('SET_SELECTION',{nodeIds:(await graphNow()).nodes.filter(n=>!original.nodes.some(o=>o.id===n.id)).map(n=>n.id)});
    await page.keyboard.press('Delete');assert.equal((await graphNow()).nodes.length,original.nodes.length);
    await page.keyboard.press('Control+z');assert.equal((await graphNow()).nodes.length,original.nodes.length+ids.length);
    await page.keyboard.press('Control+y');assert.equal((await graphNow()).nodes.length,original.nodes.length);
    // Remove then reconnect a real wire through its ports.
    const g=await graphNow(),wire=g.links[0];
    const input=page.locator('.port.input[data-node-id="'+wire.toNode+'"][data-socket="'+wire.toSocket+'"]'),output=page.locator('.port.output[data-node-id="'+wire.fromNode+'"][data-socket="'+wire.fromSocket+'"]');
    const i=await input.boundingBox();await page.mouse.move(i.x+15,i.y+15);await page.mouse.down();await page.mouse.move(shell.x+shell.width-40,shell.y+shell.height-50,{steps:4});await page.mouse.up();assert.equal((await graphNow()).links.length,g.links.length-1);
    await output.dragTo(input);assert.equal((await graphNow()).links.length,g.links.length);
    const savedStyle=await page.locator('#graph-transform').getAttribute('style');await page.locator('a[data-stage="'+(stage==='vertex'?'fragment':'vertex')+'"]').click();await page.locator('a[data-stage="'+stage+'"]').click();assert.equal(await page.locator('#graph-transform').getAttribute('style'),savedStyle);
    await page.keyboard.press('Control+z');assert.equal((await graphNow()).links.length,g.links.length-1);await page.keyboard.press('Control+y');assert.equal((await graphNow()).links.length,g.links.length);
  }
  await parity('fragment',['color','scale']);await parity('vertex',['position','uv']);
  // Shared clipboard can move a normal input across stages without changing the fragment graph.
  await page.locator('a[data-stage="fragment"]').click();await action('SET_SELECTION',{nodeIds:['scale']});await page.keyboard.press('Control+c');await page.locator('a[data-stage="vertex"]').click();await page.keyboard.press('Control+v');assert.ok((await graphNow()).nodes.some(n=>n.typeId==='io.input'));await page.keyboard.press('Control+z');
  const vertex={nodes:[{id:'position',op:'position',x:20,y:20},{id:'uv',op:'uv',x:20,y:200},{id:'time',op:'time',x:20,y:350},{id:'sine',op:'sin',x:260,y:350,inputs:{value:'time'}},{id:'factor',op:'parameter',parameter:'u_scale',x:260,y:500},{id:'motion',op:'multiply',x:500,y:350,inputs:{a:'sine',b:'factor'}},{id:'zero',op:'constant',value:0,x:500,y:500},{id:'offset',op:'vec2',x:740,y:350,inputs:{x:'zero',y:'motion'}},{id:'deformed',op:'add',x:740,y:20,inputs:{a:'position',b:'offset'}},{id:'output',op:'output',x:980,y:20,inputs:{position:'deformed',uv:'uv'}}],output:'output'};
  await action('SET_VERTEX_TRANSFORM',{graph:vertex});await page.click('#vertex-settings');await page.locator('#geometry-sx').fill('0');await page.locator('#geometry-sx').press('Tab');assert.equal((await stateNow()).vertexTransform.sx,0);
  await page.locator('#geometry-sx').fill('1');await page.locator('#geometry-sx').press('Tab');await page.locator('#preview-time').fill('1.57');await page.locator('#preview-time').press('Tab');await page.locator('[data-preview-param="u_scale"]').fill('90');await page.locator('[data-preview-param="u_scale"]').press('Tab');assert.ok(!(await page.locator('.geometry-dialog output').textContent()).includes('失败'),await page.locator('.geometry-dialog output').textContent());await page.getByLabel('关闭几何设置').click();
  await action('SET_VIEW',{x:10,y:20,zoom:.7});await page.click('#save-workflow');await page.screenshot({path:path.join(out,'vertex-editor.png')});
  await page.click('#workflow-manager');assert.match(await page.locator('#constructor-contract').textContent(),/Vector4f instanceTint/);assert.match(await page.locator('#constructor-contract').textContent(),/InstanceParameters/);const badButtons=await page.locator('button:visible').evaluateAll(nodes=>nodes.filter(n=>{const s=getComputedStyle(n),rgb=s.backgroundColor.match(/\d+/g);return rgb&&rgb.slice(0,3).every(v=>Number(v)>220);}).map(n=>n.textContent));assert.deepEqual(badButtons,[]);await page.screenshot({path:path.join(out,'workflow-controls.png')});await page.click('#close-workflow-dialog');
  const download=page.waitForEvent('download');await page.click('#export-runtime');await(await download).saveAs(path.join(out,'VerifyInstancePlugin.zip'));
  const state=await stateNow();assert.equal(state.stage,'vertex');assert.match(state.generatedSources.vertex.content,/sin/);assert.match(state.generatedSources.fragment.content,/flat in vec4/);assert.match(state.generatedSources.java.content,/public final Vector4f instanceTint/);assert.match(state.generatedSources.java.content,/InstanceParameters\.\.\. instances/);assert.deepEqual(JSON.parse(state.generatedSources.layout.content).construction.instance,['instanceTint','scale']);
  for(const kind of ['java','vertex','fragment']){const f=state.generatedSources[kind];await fs.writeFile(path.join(out,path.basename(f.filename)),f.content);}
  assert.equal(state.vertexTransform.graph.links.find(l=>l.toNode==='motion'&&l.toSocket==='b').fromNode,'factor');
  // Reload saved workflow, proving vertex graphs are carried through library/import/export.
  await action('OPEN_WORKFLOW',{id:'instance-test'});const again=await(await fetch(base+'/v1/state')).json();assert.equal(again.fragmentGraph.nodes.find(n=>n.id==='color').properties.parameterId,'instanceTint');assert.equal(again.vertexTransform.graph.links.find(l=>l.toNode==='motion'&&l.toSocket==='b').fromNode,'factor');
  await page.reload();await page.waitForSelector('.workflow-node[data-id=motion]');assert.equal(await page.locator('body').getAttribute('data-stage'),'vertex');
  await page.locator('a[data-stage=fragment]').click();
  await page.click('#workflow-manager');await page.click('#open-instance-example');await page.waitForFunction(()=>document.querySelector('#workflow-name').textContent==='实例波动四边形');
  const exampleDownload=page.waitForEvent('download');await page.click('#export-runtime');await(await exampleDownload).saveAs(path.join(out,'InstancedWave.zip'));
  await page.waitForTimeout(300);const exampleState=await(await fetch(base+'/v1/state')).json();assert.match(exampleState.generatedSources.vertex.content,/sin/);
  for(const kind of ['java','vertex','fragment']){const f=exampleState.generatedSources[kind];await fs.writeFile(path.join(out,path.basename(f.filename)),f.content);}
  const abiInputs=['BOOL','INT','UINT','FLOAT','VEC2','VEC3','VEC4'].map((type,i)=>({name:'u_p'+i,type,scope:'instance'}));
  const abi=buildRuntimeSources({config:{className:'VerifyAbiPlugin',shaderDir:'data/shaders/test'},inputs:abiInputs,textures:[],transform:{},fragment:'#version 420\nin vec2 v_uv;\nout vec4 fragColor;\nuniform float u_time;\n'+abiInputs.map(p=>'uniform '+p.type.toLowerCase()+' '+p.name+';').join('\n')+'\nvoid main(){fragColor=u_p0?u_p6+vec4(u_p4,float(u_p1)+float(u_p2)+u_p3+u_p5.z,0):vec4(0);}'});
  for(const kind of ['java','vertex','fragment'])await fs.writeFile(path.join(out,path.basename(abi[kind].filename)),abi[kind].content);

  // Verify the public stdio MCP route against this isolated browser draft.
  const mcp=spawn(process.execPath,['ai-gateway/mcp-server.mjs'],{cwd:root,env:{...process.env,WORKFLOW_BRIDGE_URL:base},windowsHide:true}),pending=new Map();let sequence=0;
  const lines=createInterface({input:mcp.stdout});lines.on('line',line=>{const message=JSON.parse(line),handler=pending.get(message.id);if(handler){pending.delete(message.id);message.error?handler.reject(new Error(message.error.message)):handler.resolve(message.result);}});
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('MCP timeout'));},12000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
  try{await rpc('initialize');const listing=await rpc('tools/list');assert.ok(listing.tools.some(t=>t.name==='workflow_set_stage'));await rpc('tools/call',{name:'workflow_set_stage',arguments:{stage:'vertex'}});const summary=JSON.parse((await rpc('tools/call',{name:'workflow_get_summary'})).content[0].text);assert.equal(summary.stage,'vertex');assert.equal(summary.outputConnected,true);await rpc('tools/call',{name:'workflow_set_stage',arguments:{stage:'fragment'}});}finally{lines.close();mcp.kill();}
  await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);console.log(`PASS: ${cases.length} legacy exports + shared-stage interaction parity / geometry / button theme / save-reload / ZIP, no page errors`);
}finally{await browser?.close();server.kill();}

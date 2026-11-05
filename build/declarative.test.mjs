import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {defaultDeclaration,readDeclaration,declarationRequirements} from '../packages/plugin-sdk/declarative.mjs';
import {pluginManifestDraft,readPluginManifest} from '../packages/plugin-sdk/plugin-manifest.mjs';
import {validateRemoteCall} from '../packages/plugin-sdk/extension-protocol.mjs';
import { PluginRuntime } from '../packages/plugin-runtime/index.mjs';
import {createPluginRepository} from '../packages/native-host/plugin-repository.mjs';
import {createExtensionUiService} from '../plugins/extension-ui/service.mjs';
import {extensionUiContract} from '../packages/plugin-sdk/extension-ui.mjs';
import {createDeclarationSession} from '../plugins/declarations/session.mjs';
import {declarationsPlugin} from '../plugins/declarations/index.mjs';
import {declarativePlugin} from '../frontend/application/declarative-plugin.mjs';
import {planAction} from '../plugins/declarations/planner.mjs';
const declarationManifest=()=>pluginManifestDraft('declaration',undefined,'declarative');
function fixture(definition=defaultDeclaration(), execute) {
  let snapshot={project:{id:'p'},documentToken:'token',stage:'fragment',graph:{revision:0,nodes:[{id:'a',canvasX:10,canvasY:20},{id:'b',canvasX:30,canvasY:40}]},document:{revision:0},selection:[]},mounted,listener,scheduled;
  const writes=[],service=createExtensionUiService(p=>{mounted=p;return {dispose(){mounted=null;}};},x=>x);
  const ui=service.scoped('local.test',()=>{}),workflow={snapshot:()=>structuredClone(snapshot),subscribe:fn=>{listener=fn;return ()=>{listener=null;};},execute:async req=>{writes.push(req);return execute?execute(req):{ok:true};}};
  const session=createDeclarationSession('local.test',definition,{ui,workflow},fn=>{scheduled=fn;return ()=>{scheduled=null;};});
  return {session,writes,ui,workflow,service,get mounted(){return mounted;},get listening(){return !!listener;},get scheduled(){return !!scheduled;},event(id,type='click',value=null){mounted.send({controlId:id,type,value,revision:mounted.model.revision});},switchDocument(){snapshot.documentToken='next';listener?.();},snapshot};
}
test('纯声明只保存数据，权限由动作推导且脚本/未知动作/错误引用被拒绝',()=>{
  const m=declarationManifest();assert.equal(readPluginManifest(m).kind,'declarative');assert.ok(!('entry' in m));
  assert.throws(()=>readPluginManifest({...m,entry:'index.mjs'}),/脚本入口/);
  assert.throws(()=>readPluginManifest({...m,capabilities:m.capabilities.filter(c=>c!=='workflow.write')}),/权限/);
  for(const action of [{on:'move',kind:'eval',code:'x()'},{on:'move',kind:'move',target:'all',dx:{control:'missing'},dy:0},{on:'move',kind:'move',target:'all',dx:{control:'undo'},dy:0}]){
    const d=defaultDeclaration();d.actions=[action];assert.throws(()=>readDeclaration(d));
  }
  const readonly=defaultDeclaration();readonly.actions=[{on:'summary',kind:'summary'}];assert.ok(!declarationRequirements(readonly).capabilities.includes('workflow.write'));
  assert.throws(()=>validateRemoteCall({...m,kind:'extension'},{api:'studio.declarations',method:'mount',args:[]}),/未开放/);
});
test('设置页与工具窗口使用相同权限、事务和回收，不进入内核增加界面业务',async()=>{
  const base=defaultDeclaration(),caps=declarationRequirements(base);
  for (const placement of ['settings','dialog']) {
    const d=structuredClone(base);d.panel.placement=placement;delete d.panel.side;
    assert.deepEqual(declarationRequirements(d),caps);
    const f=fixture(d);assert.equal(f.mounted.placement,placement);
    f.event('move');await f.session.poll();assert.equal(f.writes.length,1);
    assert.equal(f.writes[0].commands.length,2);
    f.session.dispose();assert.equal(f.mounted,null);assert.equal(f.scheduled,false);
  }
  assert.throws(()=>readDeclaration({...base,panel:{...base.panel,placement:'browser-window'}}),/放置/);
});
test('按钮参数来自控件值，批量一次守卫事务，选区与无选区行为明确',async()=>{
  const f=fixture();f.event('dx','change',64);f.event('move');await f.session.poll();
  assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].commands.map(c=>c.payload.x),[74,94]);assert.equal(f.writes[0].documentToken,'token');assert.equal(f.writes[0].expectedDocumentRevision,0);
  f.snapshot.selection=['b'];f.event('move');await f.session.poll();assert.equal(f.writes[1].commands.length,1);assert.equal(f.writes[1].commands[0].payload.nodeId,'b');
  f.session.dispose();f.session.dispose();assert.equal(f.mounted,null);assert.equal(f.listening,false);assert.equal(f.scheduled,false);
});
test('切换文档清除旧事件，停用后的异步结果不恢复面板',async()=>{
  let complete;const f=fixture(undefined,()=>new Promise(r=>{complete=r;}));
  f.event('move');f.switchDocument();await f.session.poll();assert.equal(f.writes.length,0);
  f.event('move');const pending=f.session.poll();assert.equal(f.writes[0].documentToken,'next');f.session.dispose();complete({ok:true});await pending;assert.equal(f.mounted,null);
});
test('范围、非法输入、失败事务与事件丢失不给出成功状态',async()=>{
  const f=fixture(undefined,()=>({ok:false,error:'修订已过期'}));f.event('move');await f.session.poll();assert.match(f.mounted.model.tree.children[1].text,/修订已过期/);
  f.event('dx','change',Infinity);f.event('move');await f.session.poll();assert.equal(f.writes.length,1);
  for(let i=0;i<140;i++)f.event('move');await f.session.poll();assert.equal(f.writes.length,1);assert.match(f.mounted.model.tree.children[1].text,/事件过多/);
  f.session.dispose();
  const s={project:{id:'p'},documentToken:'t',stage:'vertex',graph:{revision:0,nodes:Array.from({length:513},(_,i)=>({id:String(i)}))},document:{revision:0},selection:[]};
  assert.throws(()=>planAction({kind:'move',target:'all',dx:1,dy:0},new Map(),s),/512/);
});
test('内核独立挂载声明提供者，消费者所有权隔离，三轮停用回收且没有脚本进程',async()=>{
  const host=new PluginRuntime(),panels=new Map(),service=createExtensionUiService(p=>{panels.set(p.id,p);return {dispose:()=>panels.delete(p.id)};},x=>x),listeners=new Set();
  host.provide('studio.extension-ui','1.0.0',service.scoped,true,extensionUiContract);
  host.provide('workflow.editor','1.0.0',{snapshot:()=>({project:{id:'p'},documentToken:'t',stage:'fragment',graph:{revision:0,nodes:[]},document:{revision:0},selection:[]}),subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},execute:()=>({ok:true})},false,{methods:{snapshot:{capability:'workflow.read'},subscribe:{capability:'workflow.read'},execute:{capability:'workflow.write'}}});
  host.register(declarationsPlugin,{allowLocalApis:true});
  for(const id of ['local.a','local.b'])host.register(declarativePlugin({manifest:{...declarationManifest(),id}}));
  for(let i=0;i<3;i++){
    await host.setEnabled('local.b',true);await host.setEnabled('local.a',true);assert.equal(panels.size,2);assert.equal(listeners.size,2);
    await host.setEnabled('local.a',false);assert.equal(panels.size,1);assert.equal(listeners.size,1);
    await host.setEnabled('studio.declarations',false);assert.equal(panels.size,0);assert.equal(listeners.size,0);
  }
  await host.dispose();service.dispose();
});
test('目录安装仅提交一个 JSON，重启恢复，新增写动作必须重新审阅，失败保留原文',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'workflow-declarative-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const folder=path.join(dir,'plugin');await fs.mkdir(folder);
  const repo=createPluginRepository({indexFile:path.join(dir,'index.json')}),m=declarationManifest();m.declaration.actions=[{on:'summary',kind:'summary'}];Object.assign(m,declarationRequirements(m.declaration));
  const draft=await repo.inspect(1,folder);
  await assert.rejects(repo.prepare(1,{token:draft.token,manifest:m}),/确认/);
  const p=await repo.prepare(1,{token:draft.token,manifest:m,approvePermissions:true});await repo.commit(1,p.generation);assert.deepEqual(await fs.readdir(folder),['studio-plugin.json']);assert.ok((await repo.restore(2))[0].generation);
  const original=await fs.readFile(path.join(folder,'studio-plugin.json'),'utf8');
  const edit=await repo.inspectRegistered(1,m.id),changed={...m,declaration:defaultDeclaration(),...declarationRequirements(defaultDeclaration())};
  await assert.rejects(repo.prepare(1,{token:edit.token,manifest:changed}),/确认/);assert.equal(await fs.readFile(path.join(folder,'studio-plugin.json'),'utf8'),original);
  const approved=await repo.prepare(1,{token:edit.token,manifest:changed,approvePermissions:true});await repo.commit(1,approved.generation);await repo.remove(m.id);assert.ok(await fs.stat(path.join(folder,'studio-plugin.json')));
});

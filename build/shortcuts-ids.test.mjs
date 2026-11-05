import test from 'node:test';
import assert from 'node:assert/strict';
import {createShortcutRegistry} from '../plugins/shortcuts/registry.mjs';
import {shortcutFromEvent, isShortcutEditing} from '../packages/plugin-sdk/shortcuts.mjs';
import {GraphStore} from '../packages/kernel/index.mjs';
import {pipelineHarness} from './compiler-pipeline-support.mjs';
import {createPluginSettings} from '../frontend/application/plugin-settings.mjs';
import {createProfileStorage} from '../desktop/profile-storage.cjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const event=(key, extra={})=>({key,...extra});
const memory=()=>{const map=new Map();return {get:k=>map.get(k),set:(k,v)=>map.set(k,v)};};
const definition=(id,scope,defaults)=>({id,title:id,scope,defaults});
test('插件持久配置通过真实桌面存储，所有者隔离且跨实例重启保留',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'hotkeys-'));
  try {
    const file=path.join(directory,'profile.json');
    createPluginSettings(createProfileStorage(file),'test.a-b').set('bindings','saved');
    const restarted=createProfileStorage(file);
    assert.equal(createPluginSettings(restarted,'test.a-b').get('bindings'),'saved');
    assert.equal(createPluginSettings(restarted,'test.a_b').get('bindings'),null);
    assert.throws(()=>createPluginSettings(restarted,'test').set('../escape','x'),/无效/);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
test('热键冲突原子拒绝、作用域隔离、持久化、取消绑定及恢复',()=>{
  const storage=memory(), r=createShortcutRegistry(storage), api=r.scoped('test');
  const defs=[definition('test.delete','graph',['Delete','Backspace']),definition('test.undo','graph',['Mod+Z']),definition('test.preview','preview',['Delete'])];
  api.register(defs);
  assert.equal(api.resolve(event('Backspace'),'graph'),'test.delete');
  assert.equal(api.resolve(event('Delete'),'preview'),'test.preview');
  assert.equal(api.resolve(event('z',{metaKey:true}),'graph'),'test.undo');
  assert.throws(()=>api.configure('test.delete',['Mod+Z']),/冲突/);
  assert.deepEqual(api.list()[0].bindings,['Delete','Backspace']);
  api.configure('test.delete',['Mod+Backspace']);r.dispose();
  const restored=createShortcutRegistry(storage).scoped('test');restored.register(defs);
  assert.equal(restored.resolve(event('Backspace'),'graph'),null);
  assert.equal(restored.resolve(event('Backspace',{ctrlKey:true}),'graph'),'test.delete');
  restored.configure('test.delete',[]);assert.equal(restored.resolve(event('Backspace',{ctrlKey:true}),'graph'),null);
  restored.reset();assert.equal(restored.resolve(event('Backspace'),'graph'),'test.delete');
});
test('热键缺席/重复注册/三轮清理、旧句柄和迟到冲突不会执行其他插件命令',()=>{
  const r=createShortcutRegistry(memory());
  for(let round=0;round<3;round++){
    const owned=[], a=r.scoped('a',c=>owned.push(c)), b=r.scoped('b');
    a.register([definition('a.action','graph',['X'])]);
    assert.equal(b.resolve(event('x'),'graph'),null);
    assert.throws(()=>a.register([definition('b.action','graph',['Y'])]),/无效/);
    const h=b.register([definition('b.action','workspace',['X'])]);
    assert.equal(a.resolve(event('x'),'graph'),null);assert.equal(b.resolve(event('x'),'workspace'),null);
    h.dispose();assert.equal(a.resolve(event('x'),'graph'),'a.action');
    owned.reverse().forEach(c=>c());assert.throws(()=>a.list(),/撤销/);assert.equal(r.list().length,0);
  }
});
test('输入法、AltGr、重复键、文本编辑与精确修饰键保护',()=>{
  assert.equal(shortcutFromEvent(event('Backspace',{isComposing:true})),null);
  assert.equal(shortcutFromEvent(event('q',{getModifierState:()=>true,ctrlKey:true,altKey:true})),null);
  assert.equal(isShortcutEditing({closest:()=>({})}),true);
  const api=createShortcutRegistry(memory()).scoped('test');api.register([definition('test.delete','graph',['Backspace'])]);
  for(const extra of [{repeat:true},{defaultPrevented:true},{shiftKey:true},{altKey:true}])assert.equal(api.resolve(event('Backspace',extra),'graph'),null);
});
function graphStore() {
  const h=pipelineHarness();
  const graph={nodes:[{id:'color',typeId:'studio.math.constant',canvasX:0,canvasY:0,properties:{valueType:'VEC4',value:'1,0,0,1'}},{id:'out',typeId:'io.output',canvasX:250,canvasY:0,properties:{}}],links:[{fromNode:'color',fromSocket:'value',toNode:'out',toSocket:'color'}],outputNodeId:'out'};
  return {h,store:new GraphStore(graph,{outputType:()=> 'io.output',nodeTitle:n=>n.typeId,resolveTypes:h.semantics.resolveTypes,pruneInvalidLinks:h.semantics.pruneInvalidLinks,connectionError:()=>null,validateCommand:h.semantics.validateCommand})};
}
test('节点 ID 原子更新所有引用与输出、拒绝非法/重复、失败保留历史',()=>{
  const {store}=graphStore();
  assert.ok(store.command('RENAME_NODE_ID',{nodeId:'color',id:'waveColor'}).ok);
  assert.equal(store.snapshot().links[0].fromNode,'waveColor');
  assert.ok(store.command('RENAME_NODE_ID',{nodeId:'out',id:'finalColor'}).ok);
  assert.equal(store.snapshot().outputNodeId,'finalColor');assert.equal(store.snapshot().links[0].toNode,'finalColor');
  const before=store.snapshot();
  for(const id of ['waveColor','1bad','a-b','中文','a__b','constructor'])assert.equal(store.command('RENAME_NODE_ID',{nodeId:'finalColor',id}).ok,false);
  assert.deepEqual(store.snapshot(),before);
  store.undo();store.undo();assert.equal(store.snapshot().links[0].fromNode,'color');assert.equal(store.snapshot().outputNodeId,'out');
  store.redo();assert.ok(store.node('waveColor'));
});
test('GLSL 使用节点 ID 与端口名，重命名后数值保持、来源跟随、相似名字不碰撞',()=>{
  const {store,h}=graphStore();
  const old=h.lower(store.snapshot());store.command('RENAME_NODE_ID',{nodeId:'color',id:'waveColor'});
  const renamed=h.lower(store.snapshot());
  assert.equal(renamed.body[0].name,'wf_waveColor_value');assert.equal(renamed.body[0].origin.nodeId,'waveColor');
  assert.deepEqual(renamed.body[0].value,old.body[0].value);
  assert.match(h.fragmentSource(store.snapshot()),/vec4 wf_waveColor_value/);
  const graph=store.snapshot();graph.nodes.push({...graph.nodes[0],id:'wave-Color'});graph.nodes[0].id='wave_Color';graph.links[0].fromNode='wave_Color';
  graph.nodes.push({id:'sum',typeId:'studio.math.add',canvasX:200,canvasY:100,properties:{valueType:'VEC4'}});
  graph.links=[{fromNode:'wave_Color',fromSocket:'value',toNode:'sum',toSocket:'a'},{fromNode:'wave-Color',fromSocket:'value',toNode:'sum',toSocket:'b'}];graph.outputNodeId='sum';
  const body=h.lower(graph).body;assert.equal(new Set(body.map(s=>s.name)).size,body.length);
});

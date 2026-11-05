import test from 'node:test';
import assert from 'node:assert/strict';
import {readUiTree} from '../packages/plugin-sdk/extension-ui.mjs';
import {defaultDeclaration,readDeclaration,declarationRequirements} from '../packages/plugin-sdk/declarative.mjs';
import {layoutRows,moveControl,removeControl,renameControl} from '../plugins/plugin-manager/declaration-layout.mjs';
import {createExtensionUiService} from '../plugins/extension-ui/service.mjs';
import {createDeclarationSession} from '../plugins/declarations/session.mjs';
const nested=()=>{
  const d=defaultDeclaration();
  d.tree.children.push({id:'group',type:'disclosure',label:'参数',defaultExpanded:false,children:[
    {id:'notes',type:'textarea',label:'名称',value:'第一行\n第二行',rows:4},
    {id:'rename',type:'button',label:'改名'},
  ]});
  d.actions.push({on:'rename',kind:'rename',target:'all',title:{control:'notes'}});return d;
};
test('隔离控件支持折叠和多行文本，严格拒绝脚本字段、非法范围和超限树',()=>{
  const d=nested();assert.equal(readDeclaration(d).tree.children[5].children[0].value,'第一行\n第二行');
  assert.deepEqual(declarationRequirements(d),declarationRequirements(defaultDeclaration()));
  const text={id:'notes',type:'textarea',value:'value'};
  for(const rows of [1,21,3.5,'4'])assert.throws(()=>readUiTree({...text,rows}),/rows/);
  for(const field of [{value:false},{value:'x'.repeat(4001)},{html:'<b>hi</b>'}])assert.throws(()=>readUiTree({...text,...field}));
  assert.throws(()=>readUiTree({id:'group',type:'disclosure',defaultExpanded:'true',children:[]}),/布尔/);
  let deep={...text};for(let n=0;n<9;n++)deep={id:'g'+n,type:'disclosure',children:[deep]};assert.throws(()=>readUiTree(deep),/8 层/);
});
test('跨分组移动完整子树不改绑定，不能形成环或突破深度，失败保留输入',()=>{
  const d=nested(),original=structuredClone(d);
  const moved=moveControl(d,[0],[5]);assert.deepEqual(d,original);
  assert.equal(moved.tree.children[4].children.at(-1).id,'dx');assert.equal(moved.actions[0].dx.control,'dx');
  const back=moveControl(moved,[4,2],[]);assert.equal(back.tree.children.at(-1).id,'dx');
  assert.throws(()=>moveControl(d,[5],[5]),/自己/);assert.throws(()=>moveControl(d,[5],[5,0]),/后代/);
  assert.throws(()=>moveControl(d,[0],[1]),/容器/);
  let group={id:'deepest',type:'column',children:[]};for(let i=0;i<5;i++)group={id:'depth'+i,type:'column',children:[group]};
  const deep=defaultDeclaration();deep.tree.children.push(group,{id:'subtree',type:'panel',children:[{id:'leaf',type:'text',text:'x'}]});
  readDeclaration(deep);assert.throws(()=>moveControl(deep,[6],[5,0,0,0,0,0]),/8 层/);
  assert.deepEqual(d,original);
});
test('删除子树清理内部按钮，被外部按钮引用的字段不能误删，改 ID 保留跨层引用',()=>{
  const d=nested(),renamed=renameControl(d,[5,0],'labelText');
  assert.equal(renamed.actions.at(-1).title.control,'labelText');assert.equal(d.tree.children[5].children[0].id,'notes');
  const removed=removeControl(d,[5]);assert.equal(removed.actions.length,3);readDeclaration(removed);
  const external=moveControl(d,[0],[5]);assert.throws(()=>removeControl(external,[4]),/外部按钮/);
  assert.equal(layoutRows(external.tree).filter(r=>r.node.id==='dx').length,1);
});
test('嵌套多行输入驱动真实声明事务，旧树事件和停用后的事件失效',async()=>{
  let mounted,clean=0;const writes=[];
  const service=createExtensionUiService(p=>{mounted=p;return{dispose(){clean++;}};},x=>x);
  const d=nested(),ui=service.scoped('local.layout',()=>{});
  const workflow={snapshot:()=>({project:{id:'p'},documentToken:'t',stage:'fragment',graph:{revision:0,nodes:[{id:'a',canvasX:0,canvasY:0}]},document:{revision:0},selection:[]}),subscribe:()=>()=>{},execute:async r=>{writes.push(r);return{ok:true};}};
  const session=createDeclarationSession('local.layout',d,{ui,workflow},()=>()=>{});
  const old=mounted.model.revision;
  mounted.send({controlId:'notes',type:'change',value:'自定义\n名称',revision:old});
  mounted.send({controlId:'rename',type:'click',value:null,revision:old});await session.poll();
  assert.equal(writes[0].commands[0].payload.title,'自定义\n名称');
  mounted.send({controlId:'rename',type:'click',value:null,revision:old});await session.poll();assert.equal(writes.length,1);
  session.dispose();mounted.send({controlId:'rename',type:'click',value:null,revision:mounted.model.revision});await session.poll();assert.equal(writes.length,1);assert.equal(clean,1);
  service.dispose();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ContributionRegistry } from '../packages/kernel/index.mjs';
import { PluginRuntime } from '../packages/plugin-runtime/index.mjs';
import {resolveNodePorts} from '../packages/plugin-sdk/ports.mjs';
import {validateExpression,ir} from '../packages/plugin-sdk/ir.mjs';
import {mathPlugin} from '../plugins/math/index.mjs';
import {sdfPlugin} from '../plugins/sdf/index.mjs';
import {mathContribution} from '../plugins/math/contribution.mjs';
import {sdfContribution} from '../plugins/sdf/contribution.mjs';

function context(definition,valueType){
  const properties={...definition.properties,...(valueType?{valueType}: {})};
  if(properties.valueType==='AUTO')properties.valueType=definition.typeId.includes('.vector.')?'VEC2':'FLOAT';
  const resolved=resolveNodePorts(definition,properties);
  return {node:{id:'test',typeId:definition.typeId,properties},socket:resolved.outputs[0].name,outputType:resolved.outputs[0].type,inputs:Object.fromEntries(resolved.inputs.map(p=>[p.name,p.type]))};
}
test('Math and SDF independently register all 51 nodes for both targets without other plugins',()=>{
  let total=0;
  for(const [owner,batch] of [['studio.math',mathContribution()],['studio.sdf',sdfContribution()]]){
    const registry=new ContributionRegistry();registry.register(owner,'1.0.0',batch);total+=batch.nodes.length;
    for(const def of batch.nodes)for(const target of def.targets){const c=context(def);assert.doesNotThrow(()=>registry.compile(def.typeId,target,c),def.typeId);}
  }
  assert.equal(total,51);
});
test('public plugin lifecycle independently releases and restores Math and SDF three times',async()=>{
  const host=new PluginRuntime(),registry=new ContributionRegistry();
  host.provide('workflow.nodes','1.0.0',(owner,own)=>({register(batch){const h=registry.register(owner,'1.0.0',batch);own(()=>h.dispose());return h;}}),true,{methods:{register:{capability:'nodes.register'}}});
  host.register(mathPlugin);host.register(sdfPlugin);
  for(let i=0;i<3;i++){
    await host.setEnabled('studio.math',true);await host.setEnabled('studio.sdf',true);assert.equal(registry.list().length,51);
    await host.setEnabled('studio.math',false);assert.equal(registry.list().length,sdfContribution().nodes.length);
    await host.setEnabled('studio.sdf',false);assert.equal(registry.list().length,0);
  }
  await host.dispose();
});
test('dynamic ports are independently resolved and forged context cannot bypass IR validation',()=>{
  const registry=new ContributionRegistry(),batch=mathContribution();registry.register('studio.math','1.0.0',batch);
  const def=batch.nodes.find(n=>n.typeId==='studio.math.add');
  for(const type of ['FLOAT','VEC2','VEC3','VEC4','INT','UINT'])assert.equal(registry.compile(def.typeId,'glsl-430',context(def,type)).type,type);
  const forged=context(def,'VEC2');forged.outputType='FLOAT';forged.inputs={a:'FLOAT',b:'FLOAT'};
  assert.throws(()=>registry.compile(def.typeId,'glsl-430',forged),/类型不匹配/);
  const resolved=resolveNodePorts(def,{valueType:'VEC3'});resolved.inputs[0].type='BOOL';assert.equal(def.inputs[0].type,'FLOAT');
  assert.throws(()=>registry.compile(def.typeId,'glsl-430',context(def,'SAMPLER2D')),/类型不匹配/);
});
test('mod reads x, clamp and remap have actual rules, constants retain boolean and matrix values',()=>{
  const registry=new ContributionRegistry(),batch=mathContribution();registry.register('studio.math','1.0.0',batch);
  const compile=(name,edit={})=>{const d=batch.nodes.find(n=>n.typeId==='studio.math.'+name),c=context(d);Object.assign(c,edit);return registry.compile(d.typeId,'glsl-430',c);};
  assert.equal(compile('mod').args[0].name,'x');assert.equal(compile('clamp').name,'clamp');assert.equal(compile('remap').kind,'binary');
  const d=batch.nodes.find(n=>n.typeId==='studio.math.constant');
  for(const [type,value] of [['BVEC3','true,false,true'],['MAT2','1,2,3,4']]){const c=context(d,type);c.node.properties.value=value;assert.equal(registry.compile(d.typeId,'glsl-430',c).args.length,type==='MAT2'?4:3);}
  const c=context(d,'VEC2');c.node.properties.value='1,2,3';assert.throws(()=>registry.compile(d.typeId,'glsl-430',c),/分量数/);
});
test('additional GLSL operations validate exact signatures; scalar mix factor remains supported',()=>{
  const v=ir.call('VEC3','vec3',[ir.literal('FLOAT',1)]),f=ir.literal('FLOAT',.5);
  assert.doesNotThrow(()=>validateExpression(ir.call('VEC3','mix',[v,v,f])));
  assert.throws(()=>validateExpression(ir.call('VEC3','cross',[v,f])),/类型不匹配/);
  assert.throws(()=>validateExpression(ir.call('FLOAT','atan',[v,f])),/类型不匹配/);
});

// 只通过公开 MCP 验证视图与 AI 共用的目标配置能力，不读取或修改磁盘。
import assert from 'node:assert/strict';
import {acceptanceSession} from './final-mcp-acceptance.mjs';
export async function configurationAcceptance(client) {
  const s = acceptanceSession(client);
  await s.fresh('Configuration');
  const before = await s.summary();
  const describe = (options={},reject=false) => s.mutate('workflow_get_export_configuration',options,reject);
  const initial = await describe();
  assert.equal(initial.fields.length,13);
  assert.equal(initial.runtime.path,before.project.runtimePath);
  // 空片段图也能配置，不依赖编译成功。
  await s.replace([]);
  const empty = await s.summary();
  const edited = await describe({runtimePath:'data.custom.effects',edit:{field:'v0x',value:-250}});
  assert.equal(edited.geometry.vertices[0][0],-250);
  assert.equal(edited.fields.find(f=>f.key==='v0x').value,-250);
  assert.equal(edited.runtime.path,'data/custom/effects');
  assert.equal(edited.runtime.sourcePath,'data/custom/effects/WorkflowRuntime.java');
  assert.equal(edited.runtime.importName,'data.custom.effects.WorkflowRuntime');
  assert.deepEqual(await s.summary(),empty,'试算不得提交文档或改变修订/路径');
  for (const id of ['position','positions','layer','class','bad-name'])
    assert.match(await describe({edit:{field:'tx',enabled:true,id}},true),/ID|标识|保留/);
  assert.match(await describe({runtimePath:'../../escape'},true),/路径|包/);
  assert.match(await describe({edit:{field:'unknown',value:1}},true),/未知几何字段/);
  const proposed = await describe({geometry:edited.geometry,edit:{field:'tx',enabled:true,id:' centerX '}});
  assert.equal(proposed.fields.find(f=>f.key==='tx').id,'centerX');
  assert.match(await describe({geometry:proposed.geometry,edit:{field:'ty',enabled:true,id:'centerX'}},true),/重复/);
  assert.deepEqual(await s.summary(),empty);
  await s.mutate('workflow_set_vertex_transform',proposed.geometry);
  assert.equal((await s.summary()).vertexTransform.instanceInputs.tx.id,'centerX');
  await s.replace(s.colorGraph());
  const dependency = await s.mutate('workflow_export_runtime_dependency',{runtimePath:edited.runtime.path});
  assert.equal(dependency.filename,edited.runtime.sourcePath);
  assert.match(dependency.content,/package data.custom.effects;/);
  const files = await s.exportEffect();
  assert.match(files.java.content,/import data.custom.effects.WorkflowRuntime;/);
  assert.match(files.java.content,/float centerX/);
  assert.match(files.java.content,/float\[\] centerX/);
  assert.match(files.java.content,/Vector2f position/);
  await s.frame({width:128,height:128});
  return {...s.report(),configuration:'13字段、顶点值映射、空图可配置、只读试算、路径归一、保留/重复ID拒绝、明确提交、三文件单点/批量入口'};
}

// 发布版用户路径：只调用公开 MCP，预览和原始导出均在内存核验。
import assert from 'node:assert/strict';
import {acceptanceSession} from './final-mcp-acceptance.mjs';
export async function workflowServiceAcceptance(client){
  const s=acceptanceSession(client);
  await s.fresh('Service');await s.replace([]);
  const edit=(input,reject=false)=>s.mutate('workflow_edit',input,reject);
  const property=(nodeId,key,value,reject=false)=>s.mutate('workflow_set_node_property',{nodeId,key,value},reject);
  let result=await edit({add:[{typeId:'io.input',id:'tint',properties:{valueType:'VEC4',defaultValue:'0.2,0.5,0.9,1'}},{typeId:'io.output',id:'fragmentOut'}],connect:[{fromNode:'tint',fromSocket:'value',toNode:'fragmentOut',toSocket:'color'}],output:'fragmentOut'});
  assert.deepEqual(result.added,['tint','fragmentOut']);
  let snapshot=await s.summary();const tint=snapshot.graph.nodes.find(n=>n.id==='tint');
  assert.equal(tint.properties.parameterId,'tint');assert.equal(tint.properties.uniform,'u_tint');
  const model=await s.mutate('workflow_inspect');assert.ok(model.nodes.find(n=>n.node.id==='tint').fields.some(f=>f.key==='$scope'));
  assert.deepEqual(await s.summary(),snapshot,'查询不得修改草稿');
  await s.frame({width:128,height:128},[51,128,230,255]);
  // ID 与默认值由 L2 统一分配，重复、错误连线整批回滚。
  result=await edit({add:[{typeId:'input.time'},{typeId:'input.time'}]});assert.deepEqual(result.added,['time','time_2']);
  snapshot=await s.summary();
  assert.match(await edit({add:[{typeId:'input.time',id:'time'}]},true),/占用|ID/);
  await edit({add:[{typeId:'input.time',id:'badBatch'}],connect:[{fromNode:'badBatch',fromSocket:'value',toNode:'missing',toSocket:'x'}]},true);
  assert.deepEqual((await s.summary()).graph,snapshot.graph);
  // Inspector 同一入口处理类型、名称、作用域和验证。
  await property('tint','$title','自定义颜色');
  await property('tint','parameterId','effectColor');
  await property('tint','$scope','instance');
  snapshot=await s.summary();
  assert.equal(snapshot.vertexTransform.parameterModes.u_tint,'instance');
  await property('tint','parameterId','invalid-name',true);
  assert.deepEqual((await s.summary()).graph,snapshot.graph);
  await edit({add:[{typeId:'studio.math.constant',id:'scalar',properties:{value:'0.25',valueType:'FLOAT'}}]});
  await property('scalar','valueType','VEC2');
  const fields=(await s.mutate('workflow_inspect')).nodes.find(n=>n.node.id==='scalar').fields;
  assert.ok(fields.some(f=>f.key==='value'&&String(f.value).includes(',')));
  // 绑定旧快照的调用必须拒绝，不自动重试到新草稿。
  const stale=await s.summary();await property('tint','$title','新名称');
  await s.call('workflow_edit',{...s.guard(stale),remove:['time']},true);
  await edit({remove:['time','time_2','scalar']});await s.mutate('workflow_undo');
  assert.ok((await s.summary()).graph.nodes.some(n=>n.id==='time_2'));await s.mutate('workflow_redo');
  await s.mutate('workflow_set_stage',{targetStage:'vertex'});
  result=await edit({add:[{typeId:'input.time'}]});assert.deepEqual(result.added,['time']);
  await edit({add:[{typeId:'io.input',id:'tint'}]},true); // 两阶段共用 ID 空间。
  await s.frame({width:64,height:64});
  await s.mutate('workflow_set_stage',{targetStage:'fragment'});
  await s.mutate('workflow_export_runtime_dependency',{runtimePath:'data/service/runtime'});
  const files=await s.exportEffect();assert.match(files.java.content,/Vector4f\[\] effectColor/);assert.match(files.java.content,/Vector2f position/);assert.match(files.java.content,/data.service.runtime.WorkflowRuntime/);
  await s.frame({longEdge:2048});
  return {...s.report(),service:'默认值与可读ID、整批回滚、检查器字段、作用域、跨阶段ID、旧守卫拒绝、撤销重做、三文件与高清预览'};
}

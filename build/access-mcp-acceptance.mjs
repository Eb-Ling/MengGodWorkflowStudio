// 用户验收只使用传入的公开 MCP 客户端，不读写文件、不操作 DOM、不访问私有传输。
import assert from 'node:assert/strict';
import {pngPixels} from './final-mcp-acceptance.mjs';

export async function deniedAccessAcceptance(client) {
  const results=[];
  for(const name of ['workflow_get_summary','workflow_get_current','workflow_get_generated_sources','workflow_list_resources']){
    const r=await client.request('tools/call',{name,arguments:{}});assert.equal(r.isError,true);assert.match(r.content[0].text,/凭据/);results.push(name);
  }
  await assert.rejects(client.request('resources/read',{uri:'workflow://active/summary'}),/凭据/);
  const status=await client.request('tools/call',{name:'workflow_get_status',arguments:{}}),value=JSON.parse(status.content[0].text);
  assert.equal(value.editorConnected,false);assert.match(value.error,/凭据/);
  return {calls:6,denied:results,resourceDenied:true};
}

export async function readOnlyAccessAcceptance(client) {
  let calls=0;const frames=[],rejected=[];
  async function call(name,args={},deny=false){
    calls++;const r=await client.request('tools/call',{name,arguments:args});
    if(deny){assert.equal(r.isError,true,name);assert.match(r.content[0].text,/session.write/);rejected.push(name);return;}
    if(r.isError)throw Error(name+': '+r.content[0].text);
    return {value:JSON.parse(r.content.find(c=>c.type==='text').text),image:r.content.find(c=>c.type==='image')};
  }
  const before=(await call('workflow_get_summary')).value;
  const guard={documentId:before.project.id,documentToken:before.documentToken,stage:before.stage,expectedRevision:before.graph.revision,expectedDocumentRevision:before.documentRevision};
  await call('workflow_inspect',guard);await call('workflow_get_export_configuration',guard);await call('workflow_get_generated_sources');
  await call('workflow_project_file',{...guard,operation:'status'});await call('workflow_get_preview_status',guard);
  for(const longEdge of [128,2048]){
    const {value,image}=await call('workflow_render_preview',{...guard,nodeId:'color',socket:'value',longEdge});assert.ok(image?.data);
    const pixels=pngPixels(image.data);assert.equal(Math.max(pixels.width,pixels.height),longEdge);assert.equal(value.width,pixels.width);[51,127,229,255].forEach((v,i)=>assert.ok(Math.abs(pixels.center[i]-v)<=1));frames.push(pixels);
  }
  for(const [name,args]of [
    ['workflow_submit_commands',{commands:[{type:'RENAME_NODE',payload:{nodeId:before.graph.nodes[0].id,title:'不应生效'}}]}],
    ['workflow_edit',{add:[{id:'blockedNode',typeId:'io.input'}]}],
    ['workflow_save',{}],['workflow_export_runtime',{}],['workflow_export_runtime_dependency',{runtimePath:'data/blocked'}],
    ['workflow_project_file',{operation:'save'}],['workflow_open_preview',{}],['workflow_close_preview',{}],
  ])await call(name,{...guard,...args},true);
  const after=(await call('workflow_get_summary')).value;
  assert.deepEqual(after,before,'只读操作与被拒绝请求不改变草稿、选区、历史和修订');
  return {calls,frames,rejected,unchanged:true};
}

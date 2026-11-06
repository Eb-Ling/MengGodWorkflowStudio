// 最终验收只消费已连接的公开 MCP 客户端。无文件、浏览器、私有桥接或生成器访问。
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';

export function pngPixels(base64) {
  const png=Buffer.from(base64,'base64'),width=png.readUInt32BE(16),height=png.readUInt32BE(20),type=png[25],bpp=type===6?4:3;
  assert.equal(png[24],8);assert.ok([2,6].includes(type));
  const chunks=[];
  for(let at=8;at<png.length;){const n=png.readUInt32BE(at);if(png.toString('ascii',at+4,at+8)==='IDAT')chunks.push(png.subarray(at+8,at+8+n));at+=n+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*bpp,data=Buffer.alloc(stride*height);let at=0;
  for(let y=0;y<height;y++){const filter=raw[at++];assert.ok(filter<=4);for(let x=0;x<stride;x++){
    const i=y*stride+x,a=x>=bpp?data[i-bpp]:0,b=y?data[i-stride]:0,c=y&&x>=bpp?data[i-stride-bpp]:0,p=a+b-c;
    const pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
    const predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;
    data[i]=(raw[at++]+predictor)&255;
  }}
  const offset=(Math.floor(height/2)*width+Math.floor(width/2))*bpp;
  return {width,height,center:[...data.subarray(offset,offset+bpp)],hash:createHash('sha256').update(data).digest('hex')};
}

export function acceptanceSession(client) {
  const calls=[],checks=[],exports=[],frames=[];
  async function call(name,args={},reject=false) {
    const response=await client.request('tools/call',{name,arguments:args});
    calls.push({name,rejected:!!response.isError});
    if(reject){assert.equal(response.isError,true,`${name} should reject`);return response.content[0].text;}
    if(response.isError)throw Error(`${name}: ${response.content[0].text}`);
    const value=JSON.parse(response.content.find(c=>c.type==='text').text);
    const image=response.content.find(c=>c.type==='image');
    if(image)Object.defineProperty(value,'image',{value:image,enumerable:false});
    return value;
  }
  const summary=()=>call('workflow_get_summary');
  const guard=s=>({documentId:s.project.id,documentToken:s.documentToken,stage:s.stage,expectedRevision:s.graph.revision});
  const mutate=async(name,args={},reject=false)=>call(name,{...guard(await summary()),...args},reject);
  const file=async(operation,args={},reject=false)=>{const s=await summary();return call('workflow_project_file',{...guard(s),expectedDocumentRevision:s.documentRevision,operation,...args},reject);};
  const add=(id,typeId,properties={},x=40,y=60)=>({type:'ADD_NODE',payload:{node:{id,typeId,title:id,canvasX:x,canvasY:y,properties}}});
  const link=(a,s,b,t)=>({type:'CONNECT',payload:{link:{fromNode:a,fromSocket:s,toNode:b,toSocket:t}}});
  const command=commands=>mutate('workflow_submit_commands',{commands});
  async function fresh(id) {await mutate('workflow_create',{id:'final_'+id,title:'MCP '+id,className:'Final'+id,previewWidth:256,previewHeight:256});await mutate('workflow_set_stage',{targetStage:'fragment'});}
  async function replace(commands) {await command([...(await summary()).graph.nodes.map(n=>({type:'REMOVE_NODE',payload:{nodeId:n.id}})),...commands]);}
  const colorGraph=()=>[add('color','io.input',{uniform:'u_color',valueType:'VEC4',scope:'shared',defaultValue:'0.2,0.5,0.9,1'}),add('output','io.output',{},480,60),link('color','value','output','color'),{type:'SET_OUTPUT',payload:{nodeId:'output'}}];
  async function frame(args={},expected) {
    const value=await mutate('workflow_render_preview',args);
    const image=value.image;
    const base64=image?.data||value.dataUrl?.split(',')[1];assert.ok(base64,'MCP must return actual PNG bytes');
    const read=pngPixels(base64);assert.equal(read.width,value.width);assert.equal(read.height,value.height);
    if(expected)expected.forEach((v,i)=>assert.ok(Math.abs(v-read.center[i])<=1,JSON.stringify(read.center)));
    frames.push({...read,stage:value.stage,format:image?'image':'data'});return value;
  }
  async function exportEffect() {
    const files=await mutate('workflow_export_runtime');assert.deepEqual(Object.keys(files).sort(),['fragment','java','vertex']);
    assert.match(files.java.content,/extends WorkflowRuntime/);assert.match(files.java.content,/Vector2f/);
    assert.match(files.vertex.content,/#version 430/);assert.match(files.fragment.content,/#version 430/);
    assert.deepEqual(await call('workflow_get_generated_sources'),files);
    exports.push({name:(await summary()).project.className,files:Object.values(files).map(f=>({filename:f.filename,sha256:createHash('sha256').update(f.content).digest('hex'),punctuationHash:createHash('sha256').update(f.content.replaceAll('；','，')).digest('hex')}))});return files;
  }
  async function basic({ dependencyReady = false } = {}) {
    assert.equal((await call('workflow_get_status')).editorConnected,true);await call('workflow_agent_instructions');
    const tools=(await client.request('tools/list')).tools;assert.ok(tools.length>=41);
    assert.equal(tools.find(t=>t.name==='workflow_submit_commands').inputSchema.properties.commands.items.anyOf.length,9);
    await fresh('Single');await replace(colorGraph());
    if (dependencyReady) await exportEffect();
    else assert.match(await mutate('workflow_export_runtime',{},true),/依赖/);
    const before=await summary();
    assert.match(await mutate('workflow_export_runtime_dependency',{runtimePath:'../../outside'},true),/包|路径|标识/);
    assert.deepEqual((await summary()).project,before.project);
    const dependency=await mutate('workflow_export_runtime_dependency',{runtimePath:'data/effects/runtime'});
    assert.match(dependency.content,/package data.effects.runtime;/);
    assert.match(dependency.content,/implements CombatLayeredRenderingPlugin/);
    assert.doesNotMatch(dependency.content,/extends BaseCombatLayeredRenderingPlugin/);
    assert.ok(dependency.filename.endsWith('WorkflowRuntime.java'));
    const files=await exportEffect();assert.match(files.java.content,/import data.effects.runtime.WorkflowRuntime;/);
    checks.push('首次纯 MCP 导出公共依赖及三文件特效，非法依赖路径不改变配置');
    await frame({nodeId:'color',width:64,height:64},[51,128,230,255]);
    await frame({nodeId:'color',width:96,height:64,format:'data'},[51,128,230,255]);
    const dimensions=(await summary()).project;
    for(const longEdge of [1024,2048,4096]){const f=await frame({nodeId:'color',longEdge},[51,128,230,255]);assert.equal(f.width,longEdge);assert.equal(f.height,longEdge);}
    assert.deepEqual((await summary()).project,dimensions);
    assert.equal(JSON.stringify(await call('workflow_get_current')).includes('data:image'),false);
    await mutate('workflow_render_preview',{nodeId:'missing',width:64,height:64},true);
    await mutate('workflow_render_preview',{longEdge:2048,width:64},true);
    await mutate('workflow_render_preview',{longEdge:4097},true);
    checks.push('普通图、数据图、1024/2048/4096 高清 MCP 图片与真实 PNG 像素，不修改画布');
    const stable=await summary();
    await command([{type:'RENAME_NODE_ID',payload:{nodeId:'color',id:'custom_tint'}}]);
    await call('workflow_submit_commands',{...guard(stable),commands:[{type:'REMOVE_NODE',payload:{nodeId:'output'}}]},true);
    const rename=await summary();assert.ok(rename.graph.links.some(l=>l.fromNode==='custom_tint'));
    const snapshot=JSON.stringify(rename.graph);
    await mutate('workflow_submit_commands',{commands:[{type:'REMOVE_NODE',payload:{nodeId:'custom_tint'}},link('unknown','value','output','color')]},true);
    assert.equal(JSON.stringify((await summary()).graph),snapshot);
    await mutate('workflow_undo');assert.ok((await summary()).graph.nodes.some(n=>n.id==='color'));await mutate('workflow_redo');
    const renamedExport=await exportEffect();assert.match(renamedExport.fragment.content,/custom_tint/);
    checks.push('节点自定义 ID 重连与 GLSL 命名，过期修订拒绝、失败批次原子回滚、撤销重做');
    await mutate('workflow_set_canvas',{x:123,y:-45,zoom:1.5});assert.deepEqual((await summary()).view,{x:123,y:-45,zoom:1.5});
    const links=(await summary()).graph.links;await mutate('workflow_auto_layout',{direction:'LR'});assert.deepEqual((await summary()).graph.links,links);await mutate('workflow_undo');
    await mutate('workflow_select',{nodeIds:['custom_tint']});await mutate('workflow_modify_selection',{operation:'SAVE_AS_WORKFLOW_NODE',title:'MCP 可复用颜色'});
    const template=(await call('workflow_list_resources')).workflowNodes.find(n=>n.title==='MCP 可复用颜色');assert.ok(template);
    const oldCount=(await summary()).graph.nodes.length;await mutate('workflow_expand_workflow_node',{workflowNodeId:template.id,canvasX:100,canvasY:200});assert.equal((await summary()).graph.nodes.length,oldCount+1);await mutate('workflow_undo');await mutate('workflow_delete_workflow_node',{id:template.id});
    checks.push('画布缩放/布局、选择、可复用节点创建/展开/删除');
    await mutate('workflow_save');await mutate('workflow_set_project',{title:'未保存的修改'});await file('reload');assert.equal((await summary()).project.title,'MCP Single');
    await mutate('workflow_set_project',{title:'保存后的名称'});await mutate('workflow_save');await file('backup');assert.equal((await summary()).project.title,'MCP Single');await file('reload');
    const dirty=await summary();await mutate('workflow_set_project',{title:'恢复草稿目标'});await file('status');
    await new Promise(r=>setTimeout(r,450));const status=(await file('status')).result;assert.ok(status.recoveries.length);
    const recovery=status.recoveries.find(r=>r.title==='恢复草稿目标');assert.ok(recovery);await file('reload');await file('recover',{recoveryId:recovery.id});assert.equal((await summary()).project.title,'恢复草稿目标');
    await file('open',{fileId:'not-authorized'},true);await file('open',{},true);
    await mutate('workflow_open',{id:dirty.project.id});
    await mutate('workflow_delete',{id:'final_Single'});await fresh('Single');
    assert.match(await file('backup',{},true),/没有.*备份/);
    checks.push('保存、重读、备份、草稿恢复、未授权文件拒绝，删除后复用 ID 不残留备份');
    return report();
  }
  async function advanced() {
    await fresh('Batch');await replace(colorGraph());
    await mutate('workflow_set_vertex_transform',{vertices:[[-128,-128],[128,-128],[-128,128],[128,128]],instanceInputs:{sx:{enabled:true,id:'scale'},rotation:{enabled:true,id:'spin'}},parameterModes:{u_color:'instance'}});
    const before=await summary();await mutate('workflow_set_vertex_transform',{vertices:[[0,0]]},true);assert.deepEqual((await summary()).vertexTransform,before.vertexTransform);
    const batch=await exportEffect();assert.match(batch.java.content,/List<Vector2f>/);assert.match(batch.java.content,/Vector4f\[\]/);assert.match(batch.java.content,/float\[\]/);assert.match(batch.vertex.content,/std430/);
    await mutate('workflow_set_stage',{targetStage:'vertex'});const vc=(await call('workflow_list_node_types')).catalog;assert.ok(vc.some(n=>n.typeId==='vertex.output'));
    await command([{type:'RENAME_NODE_ID',payload:{nodeId:'position',id:'custom_position'}}]);
    await frame({nodeId:'uv',width:64,height:32});await frame({width:256,height:256});
    await mutate('workflow_set_stage',{targetStage:'fragment'});const s=await summary();
    const tx={commands:[{...add('fragment_note','studio.math.constant',{valueType:'FLOAT',value:'1'}),stage:'fragment'},{...add('vertex_note','studio.math.constant',{valueType:'FLOAT',value:'2'}),stage:'vertex'}],label:'双阶段 MCP 事务'};
    await call('workflow_document_transaction',{...guard(s),expectedDocumentRevision:s.documentRevision,transaction:tx});
    const changed=await summary();assert.ok(changed.graph.nodes.some(n=>n.id==='fragment_note'));assert.ok(changed.vertexTransform.graph.nodes.some(n=>n.id==='vertex_note'));
    await mutate('workflow_undo');const undone=await summary();assert.ok(!undone.graph.nodes.some(n=>n.id==='fragment_note'));assert.ok(!undone.vertexTransform.graph.nodes.some(n=>n.id==='vertex_note'));await mutate('workflow_redo');
    const stable=await summary();await call('workflow_document_transaction',{...guard(stable),expectedDocumentRevision:stable.documentRevision,transaction:{commands:[{...add('must_not_remain','studio.math.constant',{valueType:'FLOAT',value:'3'}),stage:'vertex'},{type:'REMOVE_NODE',stage:'fragment',payload:{nodeId:'missing'}}]}},true);
    assert.equal(JSON.stringify((await summary()).vertexTransform.graph),JSON.stringify(stable.vertexTransform.graph));
    const opened=await mutate('workflow_open_preview',{nodeId:'color',longEdge:2048});assert.equal(opened.result.opened,true);await mutate('workflow_set_stage',{targetStage:'vertex'});await mutate('workflow_set_stage',{targetStage:'fragment'});
    await mutate('workflow_set_project',{previewWidth:256,previewHeight:128});const wide=await frame({nodeId:'color',longEdge:1024});assert.equal(wide.width,1024);assert.equal(wide.height,512);
    checks.push('批量坐标/颜色/几何参数三文件导出，顶点预览，双阶段事务、联合撤销和失败回滚，高清宽高比与视框');
    for(const mode of ['Loop','IfTrue','IfFalse']) {
      await fresh(mode);
      const typeId='custom.glsl.final'+mode;
      const definition={typeId,title:'MCP '+mode,properties:{
        parameters:mode==='Loop'?[{name:'value',type:'FLOAT',qualifier:'inout'},{name:'color',type:'VEC4',qualifier:'out'}]:[{name:'a',type:'FLOAT',qualifier:'in'},{name:'b',type:'FLOAT',qualifier:'in'},{name:'color',type:'VEC4',qualifier:'out'}],
        code:mode==='Loop'?'value = unitScale(value); color = vec4(value,0.0,0.0,1.0);':'color = vec4(a,b,0.0,1.0);',
        helperSource:mode==='Loop'?'float unitScale(float x) { return x / 6.0; }':'',sourceTargets:['glsl-es-300','glsl-430'],
      }};
      await mutate('workflow_upsert_custom_node',{definition});
      const constant=(id,type,value,x,y)=>add(id,'studio.math.constant',{valueType:type,value},x,y);
      const commands=mode==='Loop'?[constant('count','FLOAT','4',0,0),add('for','logic.for',{},100,100),add('acc','logic.variable',{valueType:'FLOAT',initialValue:'0'},130,200),add('add','studio.math.add',{valueType:'FLOAT'},330,200),link('count','value','for','count'),link('acc','value','add','a'),link('for','i','add','b'),link('add','value','acc','value')]:[
        constant('condition','BOOL',mode==='IfTrue'?'true':'false',0,0),constant('one','FLOAT','1',0,600),add('if','logic.if',{},100,100),add('a','logic.variable',{valueType:'FLOAT',initialValue:'0'},150,180),add('b','logic.variable',{valueType:'FLOAT',initialValue:'0'},650,180),link('condition','value','if','condition'),link('one','value','a','value'),link('one','value','b','value'),
      ];
      commands.push(add('custom',typeId,{},950,550),add('output','io.output',{},1200,550),link('custom','color','output','color'),{type:'SET_OUTPUT',payload:{nodeId:'output'}});
      if(mode==='Loop')commands.push(link('acc','value','custom','value'));else commands.push(link('a','value','custom','a'),link('b','value','custom','b'));
      await replace(commands);
      const files=await exportEffect();assert.match(files.fragment.content,mode==='Loop'?/for \(int/:/if \(/);
      await frame({width:64,height:64},mode==='IfFalse'?[0,255,0,255]:[255,0,0,255]);
      const exportable=await summary();
      const current=await call('workflow_get_current');
      const {graph:vertex,...geometry}=current.vertexTransform;
      const requiredPlugins=Object.fromEntries([...current.graph.nodes,...vertex.nodes].filter(n=>n.plugin).map(n=>[n.plugin.id,n.plugin.version]));
      await mutate('workflow_import',{workflow:{kind:'studio.document',schemaVersion:1,documentVersion:'1.0.0',revision:0,project:{...current.project,id:'import_'+mode,title:'导入 '+mode},graphs:{fragment:current.graph,vertex},geometry,requiredPlugins}});
      const imported=await summary();assert.equal(imported.graph.nodes.length,exportable.graph.nodes.length);assert.ok(imported.graph.nodes.every(n=>/^[A-Za-z_]\w*$/.test(n.id)));
      assert.ok(imported.graph.links.every(l=>imported.graph.nodes.some(n=>n.id===l.fromNode)&&imported.graph.nodes.some(n=>n.id===l.toNode)));
      await frame({width:32,height:32},mode==='IfFalse'?[0,255,0,255]:[255,0,0,255]);
      await mutate('workflow_delete_custom_node',{typeId});await mutate('workflow_export_runtime',{},true);
      await mutate('workflow_upsert_custom_node',{definition});await exportEffect();
    }
    checks.push('For 累加、If 真/假、自定义 inout 函数双目标导出与真实像素，完整导入 ID 重建、缺失定义诊断及恢复');
    await mutate('workflow_load_example');await mutate('workflow_export_runtime_dependency');await exportEffect();await frame({width:128,height:128,time:1});
    await mutate('workflow_reset');await mutate('workflow_add_demo');const demo=await summary();assert.ok(demo.graph.nodes.length>=3);
    await mutate('workflow_select',{nodeIds:demo.graph.nodes.map(n=>n.id)});await mutate('workflow_modify_selection',{operation:'DELETE'});assert.equal((await summary()).graph.nodes.length,0);await mutate('workflow_undo');assert.equal((await summary()).graph.nodes.length,demo.graph.nodes.length);
    checks.push('教学示例、重置、批量选择删除及撤销全部经 MCP');
    return report();
  }
  async function catalog(stage,start=0,count=12) {
    await fresh('Catalog'+stage);await replace(colorGraph());await mutate('workflow_set_stage',{targetStage:stage});
    const definitions=(await call('workflow_list_node_types')).catalog;
    const results=[];
    const texture=await frame({width:8,height:8});
    for(const d of definitions.slice(start,start+count)){
      if(!d.outputs.length||['input.texture','logic.for','logic.variable'].includes(d.typeId)||d.typeId.startsWith('custom.glsl.final'))continue;
      const properties={...d.properties};if(d.typeId==='io.input')Object.assign(properties,{uniform:'u_probe',valueType:'FLOAT'});if(d.typeId==='studio.math.vector.combine')properties.valueType='VEC4';
      try{
        const setup=[add('catalog_probe',d.typeId,properties)];
        for(const [index,port] of d.inputs.entries()){
          const id='catalog_input_'+index;
          if(port.type==='SAMPLER2D')setup.push(add(id,'input.texture',{uniform:'u_texture',textureId:'texture',previewDataUrl:'data:image/png;base64,'+texture.image.data}));
          else{const type=port.type==='ANY'?(d.typeId==='studio.math.vector.split'?'VEC4':d.typeId==='studio.math.vector.scale'&&index===0?'VEC2':'FLOAT'):port.type;setup.push(add(id,'studio.math.constant',{valueType:type,value:type==='BOOL'?'true':type==='INT'?'2':type.startsWith('VEC')?Array.from({length:Number(type.at(-1))},(_,i)=>String((i+1)/5)).join(','):'0.5'}));}
          setup.push(link(id,port.type==='SAMPLER2D'?'texture':'value','catalog_probe',port.name));
        }
        await command(setup);
        for(const socket of d.outputs)await frame({nodeId:'catalog_probe',socket:socket.name,width:32,height:32,time:1});
        results.push({typeId:d.typeId,ok:true});
      }catch(e){results.push({typeId:d.typeId,ok:false,message:e.message});}
      const probes=(await summary()).graph.nodes.filter(n=>n.id==='catalog_probe'||n.id.startsWith('catalog_input_'));if(probes.length)await command(probes.map(n=>({type:'REMOVE_NODE',payload:{nodeId:n.id}})));
    }
    checks.push(`${stage} 节点目录：${results.filter(r=>r.ok).length}/${results.length}，逐输出端口返回真实 PNG`);
    return {results,report:report()};
  }
  function report(){return {route:'仅公开 stdio MCP，图片和导出仅在内存检查，无直接文件操作',calls:calls.length,rejections:calls.filter(c=>c.rejected).length,toolsUsed:[...new Set(calls.map(c=>c.name))].sort(),checks:[...checks],exports:[...exports],frames:[...frames]};}
  return {call,summary,guard,mutate,file,add,link,command,fresh,replace,colorGraph,frame,exportEffect,basic,advanced,catalog,report,checks};
}

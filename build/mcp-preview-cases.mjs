import fs from 'node:fs/promises';
import path from 'node:path';
import {inflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
// 读取真实 PNG 像素，不调用 Studio 渲染器，不重建期望图。
function pixels(png){
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20),type=png[25],bpp=type===6?4:3;assert.equal(png[24],8);assert.ok([2,6].includes(type));
 const chunks=[];for(let at=8;at<png.length;){const n=png.readUInt32BE(at),type=png.toString('ascii',at+4,at+8);if(type==='IDAT')chunks.push(png.subarray(at+8,at+8+n));at+=n+12;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*bpp,data=Buffer.alloc(stride*height);let at=0;
 for(let y=0;y<height;y++){const filter=raw[at++];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=bpp?data[i-bpp]:0,b=y?data[i-stride]:0,c=y&&x>=bpp?data[i-stride-bpp]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c),predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;assert.ok(filter<=4);data[i]=(raw[at++]+predictor)&255;}}
 return {width,height,center:[...data.subarray((Math.floor(height/2)*width+Math.floor(width/2))*bpp,(Math.floor(height/2)*width+Math.floor(width/2))*bpp+bpp)]};
}
export async function previewCases({tool,mutate,guards,out}){
 await mutate('workflow_set_stage',{targetStage:'fragment'});
 const before=await tool('workflow_get_summary');
 await mutate('workflow_auto_layout',{direction:'LR',gapX:90,gapY:70});const arranged=await tool('workflow_get_summary');
 assert.equal(arranged.graph.revision,before.graph.revision+1);assert.notDeepEqual(arranged.graph.nodes.map(n=>[n.canvasX,n.canvasY]),before.graph.nodes.map(n=>[n.canvasX,n.canvasY]));assert.deepEqual(arranged.graph.links,before.graph.links);
 await mutate('workflow_undo');assert.deepEqual((await tool('workflow_get_summary')).graph.nodes,before.graph.nodes);
 await mutate('workflow_select',{nodeIds:['color']});await mutate('workflow_modify_selection',{operation:'SAVE_AS_WORKFLOW_NODE',title:'MCP 复用模板'});
 const item=(await tool('workflow_list_resources')).workflowNodes.find(i=>i.title==='MCP 复用模板');assert.ok(item);
 await mutate('workflow_expand_workflow_node',{workflowNodeId:item.id,canvasX:0,canvasY:0});assert.equal((await tool('workflow_get_summary')).graph.nodes.length,before.graph.nodes.length+1);
 await mutate('workflow_undo');await mutate('workflow_delete_workflow_node',{id:item.id});assert.ok(!(await tool('workflow_list_resources')).workflowNodes.some(i=>i.id===item.id));
 const frames=[];
 for(const [width,height] of [[256,128],[128,256]]){
  const frame=await mutate('workflow_render_preview',{format:'data',nodeId:'color',width,height});assert.equal(frame.width,width);assert.equal(frame.height,height);const data=Buffer.from(frame.dataUrl.split(',')[1],'base64'),read=pixels(data);assert.equal(read.width,width);assert.equal(read.height,height);[51,128,230,255].slice(0,read.center.length).forEach((v,i)=>assert.ok(Math.abs(v-read.center[i])<=1,JSON.stringify(read)));await fs.writeFile(path.join(out,`preview-${width}-${height}.png`),data);frames.push(read);
 }
 const unchanged=await tool('workflow_get_summary');assert.equal(unchanged.project.previewWidth,before.project.previewWidth);assert.equal(unchanged.project.previewHeight,before.project.previewHeight);assert.equal(JSON.stringify(await tool('workflow_get_current')).includes('data:image/png'),false);
 await mutate('workflow_submit_commands',{commands:[{type:'SET_PROPERTY',payload:{nodeId:'color',key:'defaultValue',value:'1,0,0,1'}}]});
 const red=await mutate('workflow_render_preview',{format:'data',nodeId:'color',width:64,height:64});assert.deepEqual(pixels(Buffer.from(red.dataUrl.split(',')[1],'base64')).center,[255,0,0,255]);await mutate('workflow_undo');
 await tool('workflow_render_preview',{format:'data',...guards(await tool('workflow_get_summary')),nodeId:'missing',width:64,height:64},true);
 await tool('workflow_render_preview',{format:'data',...guards(await tool('workflow_get_summary')),nodeId:'color',width:0,height:64},true);
 const opened=await mutate('workflow_open_preview',{nodeId:'color',longEdge:2048});assert.equal(opened.result.opened,true);assert.equal(opened.result.width,2048);
 // 公共切换阶段关闭旧文档视框，MCP 阶段不使用桌面操作补充。
 await mutate('workflow_set_stage',{targetStage:'vertex'});
 const vertex=await tool('workflow_get_summary'),uv=vertex.graph.nodes.find(n=>n.typeId==='input.uv');
 const v=await mutate('workflow_render_preview',{format:'data',nodeId:uv.id,width:256,height:128});assert.equal(v.stage,'vertex');assert.equal(v.width,256);
 const geometry=await mutate('workflow_render_preview',{format:'data',width:512,height:256});await fs.writeFile(path.join(out,'geometry-preview.png'),Buffer.from(geometry.dataUrl.split(',')[1],'base64'));
 return {frames,checks:['layout/undo','save/expand/delete template','PNG dimensions and GPU color pixels','parameter update rerenders','frame excluded from normal snapshots','invalid node/size rejected','open HD viewer via MCP','vertex and geometry GPU']};
}

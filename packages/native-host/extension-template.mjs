/** 用户可选择生成的独立逻辑/UI 插件，只调用公开异步 API，不需要修改 Studio 源码。 */
export const extensionTemplate = `export const plugin={async activate(context){
  const ui=context.api('studio.extension-ui'), workflow=context.api('workflow.editor');
  const id=context.pluginId+'.panel';let step=32,status='选择节点后点击右移，未选择时移动全部节点。',after=0,busy=false,stopped=false;
  const tree=()=>({id:'root',type:'column',children:[
    {id:'step',type:'number',label:'右移步长',value:step,min:1,max:1000,step:1},
    {id:'move',type:'button',label:'右移节点'},
    {id:'status',type:'text',text:status}
  ]});
  await ui.create({id,title:'本地插件面板',side:'bottom',tree:tree()});
  const timer=setInterval(async()=>{
    if(stopped||busy)return;busy=true;
    try{
      const result=await ui.events({after});after=result.cursor;if(result.truncated)throw Error('操作过于密集，请重试');
      for(const e of result.events){
        if(e.panelId!==id)continue;
        if(e.controlId==='step'&&e.type==='change')step=e.value;
        if(e.controlId==='move'&&e.type==='click'){
          const s=await workflow.snapshot(),ids=new Set(s.selection);
          const nodes=s.graph.nodes.filter(n=>!ids.size||ids.has(n.id));
          const result=await workflow.execute({documentId:s.project.id,documentToken:s.documentToken,stage:s.stage,expectedRevision:s.graph.revision,expectedDocumentRevision:s.document.revision,commands:nodes.map(n=>({type:'MOVE_NODE',payload:{nodeId:n.id,x:n.canvasX+step,y:n.canvasY}}))});
          if(!result.ok)throw Error(result.error);status='已移动 '+nodes.length+' 个节点，可一次撤销。';
        }
      }
      if(result.events.length&&!stopped)await ui.update({id,tree:tree()});
    }catch(e){status=String(e.message||e);if(!stopped)await ui.update({id,tree:tree()}).catch(()=>{});}
    finally{busy=false;}
  },150);
  context.onDispose(()=>{stopped=true;clearInterval(timer);});
}};
`;

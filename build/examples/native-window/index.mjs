/** 完整教学插件：只接收公开 API，此 DOM 属于插件自己的 renderer。 */
export const plugin = { async activate(context) {
  const platform = context.api('platform.extension'), workflow = context.api('workflow.editor');
  const style = document.createElement('style');
  style.textContent = `:root{color-scheme:dark;font:16px system-ui;color:#d9e2ef;background:#181c23}body{margin:24px}h1{font-size:25px;margin:0 0 12px}p{line-height:1.6}button,textarea{font:inherit;border:1px solid #485469;border-radius:6px;background:#242b36;color:inherit;padding:10px}button{cursor:pointer}button:focus-visible,textarea:focus-visible{outline:2px solid #8daff0}nav{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}textarea{box-sizing:border-box;width:100%;height:80px}canvas{border:1px solid #485469;max-width:100%;height:auto}output{display:block;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:12px}`;
  document.head.append(style);
  const heading = document.createElement('h1'); heading.textContent = '独立插件工作台';
  const intro = document.createElement('p'); intro.textContent = '这个窗口由插件自行绘制。关闭后可以重新打开，停用插件时销毁。';
  const input = document.createElement('textarea'); input.setAttribute('aria-label','插件备注'); input.value = '{"color":"#6d9fe8"}';
  const nav = document.createElement('nav'), output = document.createElement('output'); output.setAttribute('aria-live','polite');
  const canvas = document.createElement('canvas'); canvas.width=320;canvas.height=100;canvas.setAttribute('aria-label','独立 WebGL 预览');
  const gl = canvas.getContext('webgl2');
  if(gl){gl.clearColor(.2,.45,.8,1);gl.clear(gl.COLOR_BUFFER_BIT);} else output.textContent='当前设备不支持 WebGL2';
  document.body.replaceChildren(heading,intro,input,nav,canvas,output);
  let saved, live = true;
  function button(label, action) {
    const b=document.createElement('button');b.textContent=label;nav.append(b);
    b.onclick=async()=>{b.disabled=true;try{const result=await action();if(live)output.textContent=typeof result==='string'?result:JSON.stringify(result);}catch(e){if(live)output.textContent=String(e.message||e);}finally{b.disabled=false;}};
  }
  button('保存备注',async()=>{await platform.writeText('notes.json',input.value);return '已保存到插件自己的数据目录';});
  button('读取备注',async()=>{input.value=await platform.readText('notes.json')||'';return '已读取备注';});
  button('计算摘要',()=>platform.runTask('sha256',input.value));
  button('校验 JSON',()=>platform.runTask('validate-json',input.value));
  button('读取允许的网站',async()=>{const value=await platform.fetchText('https://example.com');return 'HTTP '+value.status+'，已接收 '+value.text.length+' 个字符';});
  button('读取当前草稿',async()=>{saved=await workflow.snapshot();return '草稿 '+saved.project.id+' / '+saved.stage+' / '+saved.graph.nodes.length+' 个节点';});
  button('右移快照中的节点',async()=>{
    if(!saved)throw Error('请先读取当前草稿');
    const result=await workflow.execute({documentId:saved.project.id,documentToken:saved.documentToken,stage:saved.stage,expectedRevision:saved.graph.revision,
      commands:saved.graph.nodes.map(n=>({type:'MOVE_NODE',payload:{nodeId:n.id,x:n.canvasX+32,y:n.canvasY}}))});
    if(!result.ok)throw Error(result.error);saved=null;return '已右移，可在主窗口一次撤销';
  });
  context.onDispose(()=>{live=false;gl?.getExtension('WEBGL_lose_context')?.loseContext();canvas.width=canvas.height=1;style.remove();document.body.replaceChildren();});
}};

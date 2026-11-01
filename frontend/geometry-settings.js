// Geometry is a vertex-stage inspector; graph editing stays in the shared canvas.
export function installGeometrySettings({getTransform,setTransform,getParameters,draw}) {
  const dialog=document.createElement('dialog');dialog.className='geometry-dialog';
  dialog.innerHTML='<header><strong>顶点几何与实例预览</strong><button class="dialog-close" aria-label="关闭几何设置">×</button></header><div class="geometry-fields"></div><canvas width="840" height="300"></canvas><output></output>';
  document.body.append(dialog);const fields=dialog.querySelector('.geometry-fields'),status=dialog.querySelector('output');
  let count=9,selected=1,time=0,overrides={};
  const render=()=>{try{draw(dialog.querySelector('canvas'),{count,selected,time,overrides});status.textContent='同一顶点与片段图的 WebGL2 几何预览；实例参数在浏览器逐个提交，游戏运行时使用 SSBO。';}catch(error){status.textContent='预览失败：'+error.message;}};
  const field=(name,label,value,onchange)=>{
    const wrapper=document.createElement('label');wrapper.textContent=label;
    const input=document.createElement('input');input.type='number';input.step='any';input.value=value;input.id=name;input.setAttribute('aria-label',label);
    input.addEventListener('change',()=>{if(input.value===''||!Number.isFinite(input.valueAsNumber)){status.textContent=label+'必须为有限数';return;}try{onchange(input.valueAsNumber);render();}catch(error){status.textContent=error.message;}});
    wrapper.append(input);fields.append(wrapper);return input;
  };
  document.querySelector('#vertex-settings').onclick=()=>{
    fields.replaceChildren();const t=getTransform();
    for(const [key,label] of Object.entries({tx:'平移 X',ty:'平移 Y',sx:'缩放 X',sy:'缩放 Y',rotation:'旋转（度）'}))field('geometry-'+key,label,t[key],value=>setTransform({...getTransform(),[key]:value}));
    for(let i=0;i<4;i++)for(let axis=0;axis<2;axis++)field(`geometry-v${i}-${axis}`,`顶点 ${i} ${axis?'Y':'X'}`,t.vertices[i][axis],value=>{const next=getTransform();next.vertices[i][axis]=value;setTransform(next);});
    field('preview-count','预览实例数',count,value=>{count=Math.max(1,Math.min(64,Math.trunc(value)));});
    field('preview-selected','参数作用的实例',selected,value=>{selected=Math.max(1,Math.min(count,Math.trunc(value)));});
    field('preview-time','预览时间',time,value=>{time=value;});
    for(const p of getParameters().filter(p=>p.scope==='instance')){
      const wrapper=document.createElement('label');wrapper.textContent=p.name+'（选中实例）';const input=document.createElement('input');input.dataset.previewParam=p.name;input.value=overrides[p.name]??String(p.defaultValue);
      input.onchange=()=>{overrides[p.name]=input.value;render();};wrapper.append(input);fields.append(wrapper);
    }
    dialog.showModal();render();
  };
  dialog.querySelector('button').onclick=()=>dialog.close();
}

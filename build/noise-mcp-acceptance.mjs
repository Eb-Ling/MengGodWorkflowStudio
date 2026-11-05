// 只消费公开 MCP。参考计算不导入生产算法，图片及导出均在内存核对。
import assert from 'node:assert/strict';
import {acceptanceSession,pngPixels} from './final-mcp-acceptance.mjs';

// 独立标量参考：先确定三角形，再用方向表逐角求和。
export function simplexReference(x,y) {
  const skew=(x+y)*(Math.sqrt(3)-1)/2,i=Math.floor(x+skew),j=Math.floor(y+skew);
  const g=(3-Math.sqrt(3))/6,origin=[i-(i+j)*g,j-(i+j)*g];
  const corners=[[i,j],x-origin[0]>=y-origin[1]?[i+1,j]:[i,j+1],[i+1,j+1]];
  const q=Math.SQRT1_2,directions=[[1,0],[q,q],[0,1],[-q,q],[-1,0],[-q,-q],[0,-1],[q,-q]];
  const mod=(n,m)=>(n%m+m)%m,perm=n=>mod((34*n+1)*n,289);
  let sum=0;
  for(const [a,b] of corners){
    const dx=x-(a-(a+b)*g),dy=y-(b-(a+b)*g),weight=Math.max(0,.5-dx*dx-dy*dy);
    const direction=directions[perm(mod(a,289)+perm(mod(b,289)))%8];
    sum+=weight**4*(direction[0]*dx+direction[1]*dy);
  }
  return 70*sum;
}
export function noiseMcpSession(client) {
  const s=acceptanceSession(client),results=[];
  const property=(nodeId,key,value)=>s.command([{type:'SET_PROPERTY',payload:{nodeId,key,value}}]);
  async function setup(typeId,properties={},stage='fragment') {
    await s.fresh('Noise');
    if(stage==='vertex'){
      await s.replace(s.colorGraph());
      await s.mutate('workflow_set_stage',{targetStage:stage});
    }
    const graph=[s.add('point','io.input',{uniform:'u_point',valueType:'VEC2',defaultValue:'0.13,0.27',scope:'shared'}),
      s.add('noise',typeId,properties),s.add('half','studio.math.constant',{valueType:'FLOAT',value:'0.5'}),
      s.add('scaled','studio.math.multiply',{valueType:'FLOAT'}),s.add('mapped','studio.math.add',{valueType:'FLOAT'}),
      s.link('point','value','noise','uv'),s.link('noise','value','scaled','a'),s.link('half','value','scaled','b'),
      s.link('scaled','value','mapped','a'),s.link('half','value','mapped','b')];
    if(stage==='fragment')graph.push(s.add('rgba','studio.math.vector.combine',{valueType:'VEC4'}),s.add('one','studio.math.constant',{valueType:'FLOAT',value:'1'}),
      ...['x','y','z'].map(p=>s.link('mapped','value','rgba',p)),s.link('one','value','rgba','w'),s.add('output','io.output'),s.link('rgba','value','output','color'),{type:'SET_OUTPUT',payload:{nodeId:'output'}});
    else graph.push(s.add('position','input.position'),s.add('uv','input.uv'),s.add('displace','studio.math.vector.scale',{valueType:'VEC2'}),s.add('output','vertex.output'),
      s.link('position','value','displace','value'),s.link('mapped','value','displace','scale'),s.link('displace','value','output','position'),s.link('uv','uv','output','uv'),{type:'SET_OUTPUT',payload:{nodeId:'output'}});
    await s.replace(graph);
  }
  async function sample(point,nodeId='mapped',expected) {
    if(point)await property('point','defaultValue',point.join(','));
    const frame=await s.frame({nodeId,width:8,height:8});
    const value=pngPixels(frame.image.data).center[0]/255;
    if(expected!==undefined)assert.ok(Math.abs(value-expected)<=2/255,`${nodeId} ${point}: ${value} != ${expected}`);
    return value;
  }
  async function simplex(stage='fragment') {
    for(const typeId of ['studio.noise.simplex','studio.noise.fbmSimplex']){
      await setup(typeId,{},stage);
      for(const p of [[0,0],[.13,.27],[-.41,.9],[1.25,-2.2],[10.1,4.25],[.2,.20001],[.2,.19999]]){
        const expected=typeId.endsWith('.simplex')?simplexReference(...p):Array.from({length:5},(_,i)=>.5**(i+1)*simplexReference(p[0]*2**i,p[1]*2**i)).reduce((a,b)=>a+b,0);
        await sample(p,'mapped',.5+.5*expected);
      }
      await s.mutate('workflow_export_runtime_dependency');const files=await s.exportEffect();
      const code=stage==='vertex'?files.vertex.content:files.fragment.content;
      assert.match(code,/cos\(/);assert.match(code,/289/);assert.match(code,/wf_noise/);
      results.push({typeId,stage,samples:7,export:true});
    }
    return report();
  }
  async function fbmReference() {
    await setup('studio.noise.value');const point=[.17,.29],values=[];
    for(let i=0;i<9;i++)values.push(await sample(point.map(v=>v*2**i),'noise'));
    return {point,values};
  }
  async function fbmFixed(reference) {
    await setup('studio.noise.fbm',{scale:'1'});
    const expected=(count,offset=0)=>reference.values.slice(offset,offset+count).reduce((a,v,i)=>a+v*.5**(i+1),0);
    await sample(reference.point,'noise',expected(5));
    for(const count of [0,1,2,5,8]){await property('noise','octaves',String(count));await sample(reference.point,'noise',expected(count));}
    await property('noise','scale','2');await property('noise','octaves','5');await sample(reference.point,'noise',expected(5,1));
    await property('noise','scale','0');await sample(reference.point,'noise',0);
    results.push({typeId:'studio.noise.fbm',fixed:'默认5层/0/1/2/5/8层，scale 1/2/0'});return report();
  }
  async function fbmDynamic(reference,stage='fragment') {
    await setup('studio.noise.fbm',{scale:'1',octaves:'7'},stage);
    await s.command([s.add('layers','io.input',{uniform:'u_layers',valueType:'FLOAT',defaultValue:'0',scope:'shared'}),s.link('layers','value','noise','octaves')]);
    for(const count of [-2,0,1,2.8,5,8,30]){
      await property('layers','defaultValue',String(count));const n=Math.max(0,Math.min(8,Math.floor(count)));
      await sample(reference.point,'noise',reference.values.slice(0,n).reduce((a,v,i)=>a+v*.5**(i+1),0));
    }
    const files=await s.exportEffect(),code=files[stage].content;assert.match(code,/u_layers/);assert.match(code,/floor\(/);assert.ok(code.length<200000);
    await property('noise','scale','1e1000');await s.mutate('workflow_render_preview',{nodeId:'noise',width:8,height:8},true);await property('noise','scale','1');
    results.push({typeId:'studio.noise.fbm',stage,dynamic:'连接输入优先、向下取整、0–8截断、GLSL有界、非法scale诊断'});return report();
  }
  function report(){return {results:[...results],...s.report()};}
  return {simplex,fbmReference,fbmFixed,fbmDynamic,report,s};
}

// Pure, typed vertex DAG. No browser storage, GL objects or game entities.
export const vertexCatalog = {
  position: {title:'局部顶点', type:'vec2', inputs:{}},
  uv: {title:'原始 UV', type:'vec2', inputs:{}},
  time: {title:'时间', type:'float', inputs:{}},
  parameter: {title:'参数', type:'float', inputs:{}},
  constant: {title:'常量', type:'float', inputs:{}},
  vec2: {title:'组合 vec2', type:'vec2', inputs:{x:'float',y:'float'}},
  x: {title:'取 X', type:'float', inputs:{value:'vec2'}},
  y: {title:'取 Y', type:'float', inputs:{value:'vec2'}},
  add: {title:'向量相加', type:'vec2', inputs:{a:'vec2',b:'vec2'}},
  scale: {title:'向量缩放', type:'vec2', inputs:{value:'vec2',factor:'float'}},
  multiply: {title:'数值相乘', type:'float', inputs:{a:'float',b:'float'}},
  sum: {title:'数值相加', type:'float', inputs:{a:'float',b:'float'}},
  sin: {title:'正弦', type:'float', inputs:{value:'float'}},
  rotate: {title:'旋转（弧度）', type:'vec2', inputs:{value:'vec2',angle:'float'}},
  output: {title:'顶点输出', type:null, inputs:{position:'vec2',uv:'vec2'}}
};
export function defaultVertexGraph() {
  return {nodes:[{id:'position',op:'position',x:30,y:40},{id:'uv',op:'uv',x:30,y:220},
    {id:'output',op:'output',x:700,y:100,inputs:{position:'position',uv:'uv'}}],output:'output'};
}
export function normalizeTransform(value={}) {
  const number=(key,fallback)=>{const v=Number(value[key]??fallback);if(!Number.isFinite(v))throw new Error(`顶点 ${key} 必须为有限数`);return v;};
  const vertices=value.vertices??[[-180,-90],[180,-90],[-180,90],[180,90]];
  if(vertices.length!==4||vertices.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(Number(v)))))throw new Error('需要四个有效的二维顶点');
  const graph=value.graph??defaultVertexGraph();
  if(!Array.isArray(graph.nodes)||graph.nodes.length>256)throw new Error('无效顶点图');
  if(Array.isArray(graph.links)){
    const ids=new Set();for(const n of graph.nodes){if(typeof n.id!=='string'||!n.id||ids.has(n.id)||typeof n.typeId!=='string')throw new Error('无效或重复顶点节点');ids.add(n.id);}
    return {vertices:vertices.map(p=>p.map(Number)),tx:number('tx',0),ty:number('ty',0),sx:number('sx',1),sy:number('sy',1),rotation:number('rotation',0),graph:structuredClone(graph)};
  }
  const ids=new Set();for(const n of graph.nodes){
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.id)||ids.has(n.id)||!vertexCatalog[n.op])throw new Error('无效或重复顶点节点');ids.add(n.id);
    for(const [key,id] of Object.entries(n.inputs||{}))if(!(key in vertexCatalog[n.op].inputs)||typeof id!=='string'||(id&&!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)))throw new Error('无效顶点端口');
  }
  return {vertices:vertices.map(p=>p.map(Number)),tx:number('tx',0),ty:number('ty',0),sx:number('sx',1),sy:number('sy',1),rotation:number('rotation',0),graph};
}
export function compileVertexGraph(graph=defaultVertexGraph(), parameters=[]) {
  if(!Array.isArray(graph.nodes)||graph.nodes.length>256)throw new Error('顶点图需要 nodes，最多 256 个节点');
  const nodes=new Map(),refs=new Map(),visiting=new Set(),lines=[],usedParameters=new Set();
  for(const node of graph.nodes){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(node.id)||nodes.has(node.id)||!vertexCatalog[node.op])throw new Error(`无效或重复的顶点节点：${node.id}`);nodes.set(node.id,node);}
  const visit=id=>{
    if(refs.has(id))return refs.get(id);
    if(visiting.has(id))throw new Error(`顶点图存在循环：${id}`);
    const n=nodes.get(id);if(!n)throw new Error(`顶点连接缺少节点：${id}`);
    visiting.add(id);const spec=vertexCatalog[n.op];
    const arg=k=>{const a=visit(n.inputs?.[k]);if(a.type!==spec.inputs[k])throw new Error(`${n.id}.${k} 需要 ${spec.inputs[k]}，实际为 ${a.type}`);return a.code;};
    let code,type=spec.type;
    switch(n.op){
      case 'position':code='a_position';break;
      case 'uv':code='a_uv';break;
      case 'time':code='u_time';break;
      case 'parameter': {const p=parameters.find(p=>p.name===n.parameter);if(!p)throw new Error(`顶点参数未声明：${n.parameter}`);type=p.type.toLowerCase();if(!['float','vec2'].includes(type))throw new Error('顶点参数节点支持 float / vec2');code=p.name;usedParameters.add(p.name);break;}
      case 'constant': {const v=Number(n.value??0);if(!Number.isFinite(v))throw new Error('顶点常量必须为有限数');code=glslNumber(v);break;}
      case 'vec2':code=`vec2(${arg('x')}, ${arg('y')})`;break;
      case 'x':case 'y':code=`${arg('value')}.${n.op}`;break;
      case 'add':case 'sum':code=`(${arg('a')} + ${arg('b')})`;break;
      case 'multiply':code=`(${arg('a')} * ${arg('b')})`;break;
      case 'scale':code=`(${arg('value')} * ${arg('factor')})`;break;
      case 'sin':code=`sin(${arg('value')})`;break;
      case 'rotate':code=`wf_rotate(${arg('angle')}) * ${arg('value')}`;break;
      case 'output':code={position:arg('position'),uv:arg('uv')};break;
    }
    visiting.delete(id);
    if(n.op!=='output'){const name=`wf_vertex_${n.id}`;lines.push(`    ${type} ${name} = ${code};`);code=name;}
    const result={code,type};refs.set(id,result);return result;
  };
  if(nodes.get(graph.output)?.op!=='output')throw new Error('请选择顶点输出节点');
  const result=visit(graph.output);
  return {lines:lines.join('\n'),position:result.code.position,uv:result.code.uv,usedParameters:[...usedParameters]};
}
export function glslNumber(n){const s=String(Number(n));return /[.eE]/.test(s)?s:`${s}.0`;}
// Same graph, evaluated on CPU for the geometry editor. This is not an SSBO performance preview.
export function evaluateVertexGraph(graph, position, uv, time=0, parameters={}) {
  const nodes=new Map(graph.nodes.map(n=>[n.id,n])),memo=new Map();
  const visit=id=>{if(memo.has(id))return memo.get(id);const n=nodes.get(id),a=k=>visit(n.inputs[k]);let v;
    switch(n.op){case 'position':v=position;break;case 'uv':v=uv;break;case 'time':v=time;break;case 'parameter':v=parameters[n.parameter]??0;break;case 'constant':v=Number(n.value??0);break;
      case 'vec2':v=[a('x'),a('y')];break;case 'x':v=a('value')[0];break;case 'y':v=a('value')[1];break;
      case 'add':v=a('a').map((x,i)=>x+a('b')[i]);break;case 'sum':v=a('a')+a('b');break;case 'multiply':v=a('a')*a('b');break;
      case 'scale':v=a('value').map(x=>x*a('factor'));break;case 'sin':v=Math.sin(a('value'));break;
      case 'rotate':{const [x,y]=a('value'),r=a('angle');v=[x*Math.cos(r)-y*Math.sin(r),x*Math.sin(r)+y*Math.cos(r)];break;}
      case 'output':v={position:a('position'),uv:a('uv')};break;
    }memo.set(id,v);return v;};return visit(graph.output);
}

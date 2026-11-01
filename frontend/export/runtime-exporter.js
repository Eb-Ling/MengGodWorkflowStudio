import {validateParameterIds} from './parameter-contract.js';
import {materialJava,constructionGuide} from './java-material.js';
import {normalizeTransform,compileVertexGraph,glslNumber} from '../compiler/vertex-graph.js';

const types={BOOL:['boolean','bool'],INT:['int','int'],UINT:['int','uint'],FLOAT:['float','float'],VEC2:['Vector2f','vec2'],VEC3:['Vector3f','vec3'],VEC4:['Vector4f','vec4']};
export function parameterLayout(inputs) {
  const seen=new Set();let slot=0;
  return inputs.map(p=>{
    const type=String(p.type).toUpperCase();
    if(!types[type]||!/^u_[A-Za-z0-9_]+$/.test(p.name)||['u_time','u_viewportAlpha','u_instanceOffset'].includes(p.name)||seen.has(p.name))throw new Error(`无效、重复或保留参数：${p.name}`);
    if(p.scope&&!['shared','instance'].includes(p.scope))throw new Error(`未知参数作用域：${p.scope}`);
    seen.add(p.name);const scope=p.scope??'shared';return {...p,id:p.id??p.name.replace(/^u_/,''),type,scope,slot:scope==='instance'?slot++:null};
  });
}
function readSlot(p){const a=`wf_parameters[gl_InstanceID * WF_PARAMETER_SLOTS + ${p.slot}]`;return p.type==='BOOL'?`${a}.x != 0u`:p.type==='INT'?`int(${a}.x)`:p.type==='UINT'?`${a}.x`:p.type==='FLOAT'?`uintBitsToFloat(${a}.x)`:`uintBitsToFloat(${a}).${'xyzw'.slice(0,Number(p.type.slice(-1)))}`;}
export function buildRuntimeSources({config,graph,transform,inputs,textures,fragment,vertexProgram,runtimeFiles=[]}) {
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.className)||!/^data\/[A-Za-z0-9_/-]+$/.test(config.shaderDir)||config.shaderDir.split('/').includes('..'))throw new Error('类名或 shader 路径无效');
  const t=normalizeTransform(transform),layout=parameterLayout(inputs),instance=layout.filter(p=>p.scope==='instance'),shared=layout.filter(p=>p.scope==='shared'),slots=Math.max(1,instance.length),vertex=vertexProgram||(Array.isArray(t.graph.links)?(()=>{throw new Error('共享顶点图需要工作流编译器');})():compileVertexGraph(t.graph,layout));
  textures=textures.map(p=>({...p,id:p.id??p.name.replace(/^u_/,''),type:'SAMPLER2D',scope:'shared'}));
  validateParameterIds([...layout,...textures]);
  const C=config.className,java=materialJava({config,transform:t,layout,textures});
  const vs=`#version 430
layout(location=0) in vec2 a_position;
layout(std140) uniform BUtilGlobalData {mat4 gameViewport;vec4 gameScreenBorder;};
// BoxUtil 1.6 Fixed2D layout; Workflow owns the batch buffer; no global pool mutation.
struct Fixed2D {vec4 alpha_Facing_Location;vec2 scale;uvec2 colorBits;};
layout(std430,binding=5) readonly buffer BUtilInstanceData_Fixed2D {Fixed2D wf_transforms[];};
layout(std430,binding=0) readonly buffer WorkflowParameters {uvec4 wf_parameters[];};
const int WF_PARAMETER_SLOTS=${slots};
uniform int u_instanceOffset;
uniform float u_time;
${shared.map(p=>`uniform ${types[p.type][1]} ${p.name};`).join('\n')}
${instance.map(p=>`flat out ${types[p.type][1]==='bool'?'int':types[p.type][1]} wf_v_${p.name};`).join('\n')}
out vec2 v_uv;
${vertex.helpers||''}
mat2 wf_rotate(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
void main(){
    vec2 a_uv=vec2((gl_VertexID & 1)!=0?1.0:0.0,gl_VertexID>=2?1.0:0.0);
    v_uv=a_uv;
${instance.map(p=>`    ${types[p.type][1]} ${p.name}=${readSlot(p)};\n    wf_v_${p.name}=${p.type==='BOOL'?`${p.name}?1:0`:p.name};`).join('\n')}
${vertex.lines}
    v_uv=${vertex.uv};
    vec2 local=wf_rotate(${glslNumber(t.rotation*Math.PI/180)}) * (${vertex.position} * vec2(${glslNumber(t.sx)},${glslNumber(t.sy)})) + vec2(${glslNumber(t.tx)},${glslNumber(t.ty)});
    Fixed2D instance=wf_transforms[u_instanceOffset+gl_InstanceID];
    vec2 world=wf_rotate(radians(instance.alpha_Facing_Location.y)) * (local * instance.scale) + instance.alpha_Facing_Location.zw;
    gl_Position=gameViewport*vec4(world,0.0,1.0);
}
`;
  let fs=fragment.replace('#version 420','#version 430');
  for(const p of instance){fs=fs.replace(`uniform ${types[p.type][1]} ${p.name};`,`flat in ${p.type==='BOOL'?'int':types[p.type][1]} wf_v_${p.name};\n#define ${p.name} ${p.type==='BOOL'?`(wf_v_${p.name} != 0)`:`wf_v_${p.name}`}`);}
  fs=fs.replace('uniform float u_time;','uniform float u_time;\nuniform float u_viewportAlpha;');
  fs=fs.replace(/}\s*$/, '    fragColor.a *= u_viewportAlpha;\n}\n');
  const files={java:{filename:`src/data/scripts/${C}.java`,content:java},vertex:{filename:`${config.shaderDir}/${C}.vert`,content:vs},fragment:{filename:`${config.shaderDir}/${C}.frag`,content:fs}};
  for(const f of runtimeFiles)files[f.filename]=f;
  files.layout={filename:'parameter-layout.json',content:JSON.stringify({version:2,stride:slots*16,parameters:layout,textures,construction:{shared:[...shared,...textures].map(p=>p.id),instance:instance.map(p=>p.id)},instanceBindings:{parameters:0,fixed2D:5}},null,2)};
  files.usage={filename:'USAGE.txt',content:constructionGuide(config,layout,textures)};
  return files;
}

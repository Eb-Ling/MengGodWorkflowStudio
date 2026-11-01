import {normalizeTransform,compileVertexGraph,glslNumber} from '../compiler/vertex-graph.js';

const types={BOOL:['boolean','bool'],INT:['int','int'],UINT:['int','uint'],FLOAT:['float','float'],VEC2:['Vector2f','vec2'],VEC3:['Vector3f','vec3'],VEC4:['Vector4f','vec4']};
const javaNumber=n=>`${glslNumber(n)}f`;
export function parameterLayout(inputs) {
  const seen=new Set();let slot=0;
  return inputs.map(p=>{
    const type=String(p.type).toUpperCase();
    if(!types[type]||!/^u_[A-Za-z0-9_]+$/.test(p.name)||['u_time','u_viewportAlpha','u_instanceOffset'].includes(p.name)||seen.has(p.name))throw new Error(`无效、重复或保留参数：${p.name}`);
    if(p.scope&&!['shared','instance'].includes(p.scope))throw new Error(`未知参数作用域：${p.scope}`);
    seen.add(p.name);const scope=p.scope??'shared';return {...p,type,scope,slot:scope==='instance'?slot++:null};
  });
}
function readSlot(p){const a=`wf_parameters[gl_InstanceID * WF_PARAMETER_SLOTS + ${p.slot}]`;return p.type==='BOOL'?`${a}.x != 0u`:p.type==='INT'?`int(${a}.x)`:p.type==='UINT'?`${a}.x`:p.type==='FLOAT'?`uintBitsToFloat(${a}.x)`:`uintBitsToFloat(${a}).${'xyzw'.slice(0,Number(p.type.slice(-1)))}`;}
export function buildRuntimeSources({config,graph,transform,inputs,textures,fragment,vertexProgram,runtimeFiles=[]}) {
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.className)||!/^data\/[A-Za-z0-9_/-]+$/.test(config.shaderDir)||config.shaderDir.split('/').includes('..'))throw new Error('类名或 shader 路径无效');
  const t=normalizeTransform(transform),layout=parameterLayout(inputs),instance=layout.filter(p=>p.scope==='instance'),shared=layout.filter(p=>p.scope==='shared'),slots=Math.max(1,instance.length),vertex=vertexProgram||(Array.isArray(t.graph.links)?(()=>{throw new Error('共享顶点图需要工作流编译器');})():compileVertexGraph(t.graph,layout));
  const C=config.className,fields=[...shared.map(p=>`    private ${types[p.type][0]} shared_${p.name};`),...textures.map(p=>`    private final SpriteAPI texture_${p.parameter};`)].join('\n');
  const args=[...layout.map(p=>`${types[p.type][0]} p_${p.name}`),...textures.map(p=>`SpriteAPI p_${p.parameter}`)];
  const argumentSuffix=args.length?', '+args.join(', '):'',callSuffix=args.length?', '+[...layout.map(p=>'p_'+p.name),...textures.map(p=>'p_'+p.parameter)].join(', '):'';
  const assignments=[...shared.map(p=>`        set_${p.name}(p_${p.name});`),...instance.map(p=>`        set_${p.name}(defaultInstance(),p_${p.name});`),...textures.map(p=>`        texture_${p.parameter}=java.util.Objects.requireNonNull(p_${p.parameter},"${p.name}");`)].join('\n');
  const setters=layout.map(p=>{
    const type=types[p.type][0],count=p.type.startsWith('VEC')?Number(p.type.slice(-1)):1;
    if(p.scope==='shared')return `    public void set_${p.name}(${type} value){shared_${p.name}=${count>1?`new ${type}(java.util.Objects.requireNonNull(value))`:'value'};}`;
    const writes=Array.from({length:count},(_,i)=>{const value=count>1?`value.${'xyzw'[i]}`:p.type==='BOOL'?'value ? 1 : 0':'value';return `${['BOOL','INT','UINT'].includes(p.type)?'putInt':'putFloat'}(instance,${p.slot*16+i*4},${value});`;}).join('');
    return `    public void set_${p.name}(Instance instance,${type} value){${count>1?'java.util.Objects.requireNonNull(value);':''}${writes}}`;
  }).join('\n');
  const uploads=shared.map(p=>{const loc=`uniform("${p.name}")`,v=`shared_${p.name}`;if(p.type==='BOOL')return `GL20.glUniform1i(${loc},${v}?1:0);`;if(p.type==='INT')return `GL20.glUniform1i(${loc},${v});`;if(p.type==='UINT')return `GL30.glUniform1ui(${loc},${v});`;if(p.type==='FLOAT')return `GL20.glUniform1f(${loc},${v});`;return `GL20.glUniform${p.type.slice(-1)}f(${loc},${[...'xyzw'.slice(0,Number(p.type.slice(-1)))].map(c=>`${v}.${c}`).join(',')});`;});
  const java=`package data.scripts;
import com.fs.starfarer.api.combat.CombatEngineLayers;
import com.fs.starfarer.api.graphics.SpriteAPI;
import data.scripts.workflow.WorkflowBatch;
import org.lwjgl.opengl.GL20;
import org.lwjgl.opengl.GL30;
import org.lwjgl.util.vector.*;

/** Generated material. One instance is created for compatibility; use clearInstances() for an empty batch. */
public final class ${C} extends WorkflowBatch {
${fields}
    public ${C}(CombatEngineLayers layer${argumentSuffix}){this(${t.vertices.flat().map(javaNumber).join(',')},layer${callSuffix});}
    public ${C}(float x0,float y0,float x1,float y1,float x2,float y2,float x3,float y3,CombatEngineLayers layer${argumentSuffix}){
        super(layer,"${config.shaderDir}/${C}.vert","${config.shaderDir}/${C}.frag",new float[]{x0,y0,x1,y1,x2,y2,x3,y3},${slots*16},${textures.length},${config.blendMode==='additive'});
${assignments}
    }
${setters}
    @Override protected void bindSharedParameters(){
        ${uploads.join('\n        ')}
        ${textures.map((p,i)=>`bindTexture("${p.name}",${i},texture_${p.parameter});`).join('\n        ')}
    }
}
`;
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
  files.layout={filename:'parameter-layout.json',content:JSON.stringify({version:1,stride:slots*16,parameters:layout,instanceBindings:{parameters:0,fixed2D:5}},null,2)};
  files.usage={filename:'USAGE.txt',content:`Requires Starsector 0.98a + BoxUtil 1.6.3 + OpenGL 4.3.\nCopy src/ into your mod source tree and data/ into the mod root. Compile all Java files.\nConstruct ${C} with a CombatEngineLayers value and these arguments: ${args.join(', ')||'(none)'}.\nRegister once: engine.addLayeredRenderingPlugin(effect);\nOne default instance already exists: effect.setPosition(x,y); effect.setAngle(degrees);\nFor a batch: effect.clearInstances(); WorkflowBatch.Instance i = effect.createInstance();\ni.setPosition(x,y).setAngle(degrees).setScale(sx,sy);\n${instance.map(p=>`effect.set_${p.name}(i, value);`).join('\n')}\ni.remove() removes this instance. effect.markExpired() ends the batch; cleanup is idempotent.\nNew instances have zero custom parameter values; set every required instance parameter explicitly.\nOne batch uses one material, texture set and layer. Keep batch submission and instance insertion order for alpha blending.\nCPU updates must run on the combat/render thread. Geometry is exact triangle-strip order; no bounding-rectangle replacement.\nViewport alpha is applied automatically. Arbitrary vertex displacement disables CPU radius culling.\n`};
  return files;
}

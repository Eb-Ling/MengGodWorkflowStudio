import {glslNumber} from '../compiler/vertex-graph.js';
export const javaTypes={BOOL:'boolean',INT:'int',UINT:'int',FLOAT:'float',VEC2:'Vector2f',VEC3:'Vector3f',VEC4:'Vector4f',SAMPLER2D:'SpriteAPI'};
const components=p=>Number(p.type.match(/^VEC([234])$/)?.[1]||0);
const copy=p=>components(p)?`new ${javaTypes[p.type]}(java.util.Objects.requireNonNull(${p.id},"${p.id}"))`:p.type==='SAMPLER2D'?`java.util.Objects.requireNonNull(${p.id},"${p.id}")`:p.id;
const validate=p=>p.type==='FLOAT'?`requireFinite(this.${p.id});`:components(p)?[...'xyzw'.slice(0,components(p))].map(c=>`requireFinite(this.${p.id}.${c});`).join(''):'';
const argumentsFor=ps=>ps.map(p=>`${javaTypes[p.type]} ${p.id}`).join(', ');
function parameterClass(name,ps,transform=false){
  return `    public static final class ${name} {
${transform?'        public final Transform transform;':''}
${ps.map(p=>`        /** Parameter ID ${p.id}; shader input ${p.name}. */\n        public final ${javaTypes[p.type]} ${p.id};`).join('\n')}
        public ${name}(${[transform?'Transform transform':'',argumentsFor(ps)].filter(Boolean).join(', ')}) {
${transform?'            this.transform=java.util.Objects.requireNonNull(transform,"transform");':''}
${ps.map(p=>`            this.${p.id}=${copy(p)};${validate(p)}`).join('\n')}
        }
    }`;
}
export function materialJava({config,transform:t,layout,textures}){
  const C=config.className,instance=layout.filter(p=>p.scope==='instance'),shared=layout.filter(p=>p.scope==='shared'),common=[...shared,...textures.map(p=>({...p,type:'SAMPLER2D'}))],slots=Math.max(1,instance.length);
  if(['Transform','SharedParameters','InstanceParameters','WorkflowBatch','GL20','GL30','Float','CombatEngineLayers','java',...Object.values(javaTypes)].includes(C))throw new Error('Java 类名与生成的配置类或运行时冲突：'+C);
  if(instance.length>250||common.length>250)throw new Error('单个参数配置类最多支持 250 个输入');
  const fields=[...shared.map(p=>`    private ${javaTypes[p.type]} shared_${p.id};`),...textures.map(p=>`    private final SpriteAPI texture_${p.id};`)];
  const setters=layout.map(p=>{
    const checks=p.type==='FLOAT'?`requireFinite(${p.id});`:components(p)?`java.util.Objects.requireNonNull(${p.id},"${p.id}");`+[...'xyzw'.slice(0,components(p))].map(c=>`requireFinite(${p.id}.${c});`).join(''):'';
    if(p.scope==='shared')return `    public void set_${p.id}(${javaTypes[p.type]} ${p.id}) { ${checks}shared_${p.id}=${copy(p)}; }`;
    const handle=p.id==='wf_instance'?'wf_instance_':'wf_instance';
    const writes=Array.from({length:components(p)||1},(_,i)=>{const value=components(p)?`${p.id}.${'xyzw'[i]}`:p.type==='BOOL'?`${p.id}?1:0`:p.id;return `${['BOOL','INT','UINT'].includes(p.type)?'putInt':'putFloat'}(instance,${p.slot*16+i*4},${value});`;}).join('');
    // Prefix the handle to avoid collisions with a user parameter named instance.
    return `    public void set_${p.id}(Instance ${handle},${javaTypes[p.type]} ${p.id}) { ${components(p)?`java.util.Objects.requireNonNull(${p.id},"${p.id}");`:''}${writes.replaceAll('(instance,','('+handle+',')} }`;
  }).join('\n');
  const uploads=shared.map(p=>{const loc=`uniform("${p.name}")`,v=`shared_${p.id}`;return p.type==='BOOL'?`GL20.glUniform1i(${loc},${v}?1:0);`:p.type==='INT'?`GL20.glUniform1i(${loc},${v});`:p.type==='UINT'?`GL30.glUniform1ui(${loc},${v});`:p.type==='FLOAT'?`GL20.glUniform1f(${loc},${v});`:`GL20.glUniform${components(p)}f(${loc},${[...'xyzw'.slice(0,components(p))].map(c=>`${v}.${c}`).join(',')});`;});
  return `package data.scripts;

import com.fs.starfarer.api.combat.CombatEngineLayers;
import com.fs.starfarer.api.graphics.SpriteAPI;
import data.scripts.workflow.WorkflowBatch;
import org.lwjgl.opengl.GL20;
import org.lwjgl.opengl.GL30;
import org.lwjgl.util.vector.*;

/** Generated from workflow inputs. Construct with all parameters, then register once. */
public final class ${C} extends WorkflowBatch {
${fields.join('\n')}
    private final Instance[] configuredInstances;
    private static void requireFinite(float value) { if(!Float.isFinite(value))throw new IllegalArgumentException("Expected finite value"); }

    public static final class Transform {
        public final float x,y,angle,scaleX,scaleY;
        public Transform(float x,float y) { this(x,y,0f,1f,1f); }
        public Transform(float x,float y,float angle,float scaleX,float scaleY) {
            requireFinite(x);requireFinite(y);requireFinite(angle);requireFinite(scaleX);requireFinite(scaleY);
            this.x=x;this.y=y;this.angle=angle;this.scaleX=scaleX;this.scaleY=scaleY;
        }
    }
${common.length?parameterClass('SharedParameters',common):''}
${parameterClass('InstanceParameters',instance,true)}

    public ${C}(CombatEngineLayers layer,${common.length?'SharedParameters shared,':''}InstanceParameters... instances) {
        super(layer,"${config.shaderDir}/${C}.vert","${config.shaderDir}/${C}.frag",new float[]{${t.vertices.flat().map(n=>glslNumber(n)+'f').join(',')}},${slots*16},${textures.length},${config.blendMode==='additive'});
        clearInstances();
        java.util.Objects.requireNonNull(instances,"instances");
${common.length?'        java.util.Objects.requireNonNull(shared,"shared");':''}
${shared.map(p=>`        set_${p.id}(shared.${p.id});`).join('\n')}
${textures.map(p=>`        texture_${p.id}=shared.${p.id};`).join('\n')}
        configuredInstances=new Instance[instances.length];
        for(int n=0;n<instances.length;n++)configuredInstances[n]=addInstance(java.util.Objects.requireNonNull(instances[n],"instances["+n+"]"));
    }
    public Instance addInstance(InstanceParameters parameters) {
        java.util.Objects.requireNonNull(parameters,"parameters");
${instance.map(p=>validate(p).replaceAll('this.','parameters.')).join('\n')}
        Instance instance=createInstance();
        Transform t=parameters.transform;
        instance.setPosition(t.x,t.y).setAngle(t.angle).setScale(t.scaleX,t.scaleY);
${instance.map(p=>`        set_${p.id}(instance,parameters.${p.id});`).join('\n')}
        return instance;
    }
    /** Stable handle to a constructor-supplied instance. */
    public Instance instance(int index) { return configuredInstances[index]; }
${setters}
    @Override protected void bindSharedParameters() {
        ${uploads.join('\n        ')}
        ${textures.map((p,i)=>`bindTexture("${p.name}",${i},texture_${p.id});`).join('\n        ')}
    }
}
`;
}
export function constructionGuide(config,layout,textures){
  const C=config.className,instance=layout.filter(p=>p.scope==='instance'),shared=[...layout.filter(p=>p.scope==='shared'),...textures.map(p=>({...p,type:'SAMPLER2D'}))];
  return `需要 Starsector 0.98a、BoxUtil 1.6.3、OpenGL 4.3。\n将 src/ 编译进 Mod 的 JAR，将 data/ 合并到 Mod 根目录。\n\n入口构造接口：\nnew ${C}(CombatEngineLayers layer, ${shared.length?C+'.SharedParameters shared, ':''}${C}.InstanceParameters... instances)\n${shared.length?'new '+C+'.SharedParameters('+argumentsFor(shared)+')\n':''}new ${C}.InstanceParameters(${C}.Transform transform${instance.length?', '+argumentsFor(instance):''})\nnew ${C}.Transform(float x, float y)\nnew ${C}.Transform(float x, float y, float angle, float scaleX, float scaleY)\n\n传入 8 个 InstanceParameters 即创建 8 个实例；可直接传数组。空数组创建空批次。\n每个节点参数均为必填，名称就是节点检查器中的“参数 ID”，顺序与 parameter-layout.json 一致。\n实例参数对象包含世界坐标、角度（度）、缩放，以及全部每实例输入；共享对象包含全部共享输入和纹理。\n创建完成后只需登记一次：engine.addLayeredRenderingPlugin(effect);\n不需要创建循环、clearInstances() 或逐项初始化 setter。节点默认值只用于编辑器预览。\n\n后续更新（可选）：effect.instance(0).setPosition(x,y);\n${instance.map(p=>`effect.set_${p.id}(effect.instance(0), value);`).join('\n')}\n${layout.filter(p=>p.scope==='shared').map(p=>`effect.set_${p.id}(value);`).join('\n')}\neffect.instance(0).remove(); 移除一个实例；effect.markExpired(); 结束整批。\n构造配置以快照传入，修改原始向量不会自动修改正在渲染的实例。\n一批实例共用材质、纹理、图层和混合方式。坐标更新在战斗／渲染线程执行。\n`;
}

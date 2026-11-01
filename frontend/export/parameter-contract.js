// Public Java names are the parameter IDs shown on input nodes. Graph IDs and
// GLSL uniform names remain stable when a public parameter is renamed.
const reserved=new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null _ record sealed permits yield var java'.split(' '));
export function parameterId(node){return node.properties.parameterId??String(node.properties.uniform||'u_value').replace(/^u_/,'');}
export function validParameterId(id){return /^[A-Za-z_][A-Za-z0-9_]*$/.test(id)&&!reserved.has(id);}
export function validateParameterIds(parameters){
  const ids=new Map(),uniforms=new Map();
  for(const p of parameters){
    if(!validParameterId(p.id))throw new Error(`参数 ID 无效：${p.id}。请使用非 Java 关键字的字母、数字或下划线名称。`);
    if(p.scope==='instance'&&p.id==='transform')throw new Error('参数 ID transform 为实例变换配置保留');
    const previous=ids.get(p.id),uniform=uniforms.get(p.name);
    if(previous&&previous.name!==p.name)throw new Error(`参数 ID 重复：${p.id} 对应多个 uniform`);
    if(uniform&&(uniform.id!==p.id||uniform.type!==p.type||uniform.scope!==p.scope))throw new Error(`跨节点参数声明冲突：${p.name} 的 ID、类型和作用域必须一致`);
    ids.set(p.id,p);uniforms.set(p.name,p);
  }
}

/** Starsector 的 Java 入口契约，通用编辑与预览不消费此规则。 */
const reserved = new Set(
  "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null _ record sealed permits yield var java".split(
    " ",
  ),
);
export function validJavaIdentifier(id) {
  return typeof id === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(id) && !reserved.has(id);
}
export function validateParameterIds(parameters) {
  const ids = new Map(),
    uniforms = new Map();
  for (const p of parameters) {
    if (!validJavaIdentifier(p.id))
      throw new Error(
        `参数 ID 无效：${p.id}。请使用非 Java 关键字的字母、数字或下划线名称。`,
      );
    if (["layer", "position", "positions"].includes(p.id))
      throw new Error(`参数 ID ${p.id} 为构造器入口保留`);
    const previous = ids.get(p.id),
      uniform = uniforms.get(p.name);
    if (previous && previous.name !== p.name)
      throw new Error(`参数 ID 重复：${p.id} 对应多个 uniform`);
    if (
      uniform &&
      (uniform.id !== p.id ||
        uniform.type !== p.type ||
        uniform.scope !== p.scope)
    )
      throw new Error(
        `跨节点参数声明冲突：${p.name} 的 ID、类型和作用域必须一致`,
      );
    ids.set(p.id, p);
    uniforms.set(p.name, p);
  }
}

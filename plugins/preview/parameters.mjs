/** 预览自己的 uniform 契约，与任何游戏目标导出插件无依赖。 */
export function validatePreviewParameters(inputs, textures, aspectName) {
  for (const p of inputs)
    if (
      !["BOOL", "INT", "UINT", "FLOAT", "VEC2", "VEC3", "VEC4"].includes(p.type)
    )
      throw Error("当前 WebGL 预览参数不支持：" + p.name + " / " + p.type);
  const seen = new Map();
  for (const p of [
    ...inputs,
    ...textures.flatMap((p) => [
      { ...p, type: "SAMPLER2D", scope: "shared" },
      { name: aspectName(p.name), type: "VEC2", scope: "shared" },
    ]),
  ]) {
    if (["u_time", "wf_preview_extent"].includes(p.name))
      throw Error("预览保留的 uniform 名称：" + p.name);
    const old = seen.get(p.name);
    if (old && (old.type !== p.type || old.scope !== p.scope))
      throw Error("预览 uniform 声明冲突：" + p.name);
    seen.set(p.name, p);
  }
}

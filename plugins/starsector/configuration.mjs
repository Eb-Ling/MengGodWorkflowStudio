import {geometryFields, geometryValue, geometryParameters, normalizeTransform} from '../../packages/workflow-tools/geometry.mjs';
import {validateParameterIds} from '../../packages/starsector-contract/parameters.mjs';
import {runtimePackage, runtimeSourcePath, runtimeDependency} from '../../packages/starsector-contract/runtime.mjs';

/** 目标插件负责路径、字段映射和修改校验，不编译图、不读写文档、不持有 UI 状态。 */
export function exportConfiguration({geometry = {}, runtimePath, edit} = {}) {
  const next = normalizeTransform(geometry);
  if (edit) {
    const field = geometryFields.find(f => f.key === edit.field);
    if (!field) throw Error('未知几何字段：' + edit.field);
    if (edit.value !== undefined) {
      if (!Number.isFinite(edit.value)) throw Error(field.label + '必须为有限数');
      if (field.vertex === undefined) next[field.key] = edit.value;
      else next.vertices[field.vertex][field.axis] = edit.value;
    }
    if (edit.id !== undefined || edit.enabled !== undefined) {
      const old = next.instanceInputs[field.key];
      const id = (edit.id ?? old?.id ?? field.id).trim();
      // 停用的字段也检查本次名称，保留名与重复名称沿用最终导出的同一规则。
      validateParameterIds([{id, name:'u_wf_geometry_' + field.key}]);
      next.instanceInputs[field.key] = {id, enabled: edit.enabled ?? old?.enabled ?? false};
    }
    validateParameterIds(geometryParameters(next));
  }
  const packageName = runtimePackage(runtimePath);
  return {
    geometry: next,
    fields: geometryFields.map(f => ({key:f.key, label:f.label, value:geometryValue(next,f),
      id:next.instanceInputs[f.key]?.id || f.id, enabled:!!next.instanceInputs[f.key]?.enabled})),
    runtime: {path:packageName.replaceAll('.', '/'), packageName, sourcePath:runtimeSourcePath(packageName),
      importName:packageName + '.' + runtimeDependency.className},
  };
}

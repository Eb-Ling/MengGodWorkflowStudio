/** Starsector 目标公共标识。消费者只依赖契约，不导入导出插件实现。 */
export const starsectorOperations = Object.freeze({
  export: "studio.starsector.export",
  guide: "studio.starsector.guide",
  dependency: "studio.starsector.dependency",
  configuration: "studio.starsector.configuration",
});
/** 只计算配置，不提交文档。edit 是用户意图，结果 geometry 可交给现有编辑 API 提交。 */
export const configurationRequest = {
  type: "object", additionalProperties: false,
  properties: {
    geometry: {type: "object"}, runtimePath: {type: "string"},
    edit: {
      type: "object", required: ["field"], additionalProperties: false,
      properties: {field: {type: "string"}, value: {type: "number"}, enabled: {type: "boolean"}, id: {type: "string"}},
    },
  },
};
/** JSON 视图模型，校验与字段规则由目标插件拥有，消费者不解释 Java 规则。 */
export const configurationResponse = {
  type: "object", required: ["geometry", "fields", "runtime"], additionalProperties: false,
  properties: {
    geometry: {type: "object"},
    fields: {type: "array", items: {
      type: "object", required: ["key", "label", "id", "value", "enabled"], additionalProperties: false,
      properties: {key: {type: "string"}, label: {type: "string"}, id: {type: "string"}, value: {type: "number"}, enabled: {type: "boolean"}},
    }},
    runtime: {type: "object", required: ["path", "packageName", "sourcePath", "importName"], additionalProperties: false,
      properties: {path: {type: "string"}, packageName: {type: "string"}, sourcePath: {type: "string"}, importName: {type: "string"}}},
  },
};

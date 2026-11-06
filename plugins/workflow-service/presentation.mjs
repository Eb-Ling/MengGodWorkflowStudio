import {
  parameterId,
  validParameterId,
} from "../../packages/workflow-tools/parameters.mjs";
/** 只读投影与编辑意图校验。没有 DOM、Vue 或渲染器引用，不持有图的可写副本。 */
export function createPresentationApi({
  snapshot,
  semantics,
  parameters,
  describeNode,
  report,
  activity,
  typeOptions = () => semantics.GLSL_TYPE_OPTIONS,
}) {
  const {
    nodeDef,
    typeLabel,
    typedPropertyType,
    typedValueProperty,
    normalizedConstantValue,
    validateNodeProperty,
    variableBranchOwner,
  } = semantics;
  const option = (value) => ({ value, label: value });
  function inspect(node, graph) {
    const d = nodeDef(node),
      fields = [
        {
          key: "$title",
          id: "node-title",
          label: "节点名称",
          kind: "text",
          value: node.title || d.title,
        },
        { key: "$typeId", label: "类型", kind: "readonly", value: node.typeId },
      ];
    if (d.missing)
      return {
        node,
        definition: d,
        description: describeNode(d),
        fields,
        missing: true,
      };
    if (d.dynamicKind) {
      const split = node.typeId === "studio.math.vector.split",
        combine = node.typeId === "studio.math.vector.combine";
      fields.push({
        key: "valueType",
        label: "类型变量",
        kind: "select",
        value: node.properties.valueType || "AUTO",
        options: (combine
          ? ["VEC2", "VEC3", "VEC4"]
          : split
            ? ["AUTO", "VEC2", "VEC3", "VEC4"]
            : ["AUTO", "BOOL", "INT", "UINT", "FLOAT", "VEC2", "VEC3", "VEC4"]
        ).map(option),
        hint: split
          ? "连接输入向量后自动确定类型。"
          : combine
            ? "类型决定 Float 输入数量。"
            : "AUTO 从已连接的端口推导，切换具体类型会移除不兼容连线。",
      });
    }
    if (["io.input", "input.texture"].includes(node.typeId))
      fields.push({
        key: "parameterId",
        label: "参数 ID（生成代码中的名称）",
        ariaLabel: "参数 ID",
        kind: "text",
        value: parameterId(node),
        hint: "导出参数使用此 ID，目标语言的关键字与保留名在导出时检查。中文说明填在节点名称中。",
      });
    if (node.typeId === "io.input")
      fields.push({
        key: "$scope",
        label: "参数作用域",
        kind: "select",
        value: parameters.effectiveScope(node),
        options: [
          { value: "shared", label: "整批共享：传单值" },
          { value: "instance", label: "每实例变化：传数组" },
        ],
        hint: "每实例参数的数量和顺序与实例列表一致，与几何设置同步。",
      });
    if (node.typeId === "logic.variable") {
      const owner = variableBranchOwner(graph, node);
      fields.push({
        key: "$branch",
        label: "控制流来源",
        kind: "readonly",
        value: owner
          ? owner.branch === "loop"
            ? "FOR 循环体（由 value 输入来源自动推断）"
            : owner.branch.toUpperCase() + " 分支（由 value 输入来源自动推断）"
          : "未连接到 If 或 For 内的节点",
        hint: "init 在控制块前初始化，value 的输入决定在哪个分支或循环体内写入。",
      });
    }
    if (node.typeId === "input.texture")
      fields.push({
        key: "previewDataUrl",
        label: "预览纹理",
        kind: "file",
        value: node.properties.previewDataUrl || "",
        hint: "仅用于工作流预览，导出构造器传入 SpriteAPI。",
      });
    if (d.outputs.length)
      fields.push({
        key: "previewEnabled",
        label: "输出预览",
        kind: "toggle",
        value: !!node.properties.previewEnabled,
      });
    for (const [key, value] of Object.entries(node.properties)) {
      if (
        [
          "previewEnabled",
          "valueType",
          "previewDataUrl",
          "scope",
          "parameterId",
        ].includes(key)
      )
        continue;
      const type = typedPropertyType(node, d, key),
        bool = type === "BOOL" || typeof value === "boolean",
        validation = validateNodeProperty(node, d, key, value);
      fields.push({
        key,
        label: node.typeId === "input.time" && key === "defaultValue" ? "预览时间（秒）"
          : node.typeId === "input.time" && key === "autoAdvance" ? "自动播放预览时间" : key,
        kind: bool ? "select" : "text",
        value: bool
          ? String(value).toLowerCase() === "true"
            ? "true"
            : "false"
          : value && typeof value === "object"
            ? JSON.stringify(value)
            : String(value),
        ...(bool ? { options: ["false", "true"].map(option) } : {}),
        hint: bool
          ? "布尔值使用选择框。"
          : /^VEC[234]$/.test(type)
            ? `必须输入 ${type.slice(-1)} 个逗号分隔的分量。`
            : "",
        error: validation.valid ? "" : validation.message,
      });
    }
    return {
      node,
      definition: d,
      description: describeNode(d),
      fields,
      missing: false,
    };
  }
  return {
    snapshot() {
      const s = snapshot();
      return structuredClone({
        nodes: s.graph.nodes.map((node) => inspect(node, s.graph)),
        catalog: s.catalog,
        types: typeOptions().map((type) => ({
          value: semantics.typeKey(type),
          label: type,
        })),
        parameters: parameters.list(),
      });
    },
    /** 返回要提交的命令，而不是绕过修订守卫写入，消费者使用同一快照提交。 */
    edit({ nodeId, key, value }) {
      const s = snapshot(),
        node = s.graph.nodes.find((n) => n.id === nodeId);
      if (!node) throw Error("节点不存在");
      const d = nodeDef(node);
      if (d.missing) throw Error("节点插件未启用");
      if (key === "$title")
        return {
          commands: [
            { type: "RENAME_NODE", payload: { nodeId, title: String(value) } },
          ],
        };
      if (key === "$scope") {
        if (!["shared", "instance"].includes(value))
          throw Error("参数作用域无效");
        return {
          actions: [
            {
              type: "SET_VERTEX_TRANSFORM",
              payload: {
                ...s.vertexTransform,
                parameterModes: {
                  ...s.vertexTransform.parameterModes,
                  [parameters.name(node)]: value,
                },
              },
            },
          ],
        };
      }
      if (key === "parameterId") {
        value = String(value).trim();
        if (!validParameterId(value))
          throw Error("参数 ID 应以字母或下划线开头，后续使用字母、数字或下划线");
      }
      if (key === "valueType") {
        const commands = [
            { type: "SET_PROPERTY", payload: { nodeId, key, value } },
          ],
          typedKey = typedValueProperty(node);
        if (typedKey && value !== "AUTO")
          commands.push({
            type: "SET_PROPERTY",
            payload: {
              nodeId,
              key: typedKey,
              value: normalizedConstantValue(node.properties[typedKey], value),
            },
          });
        return { commands };
      }
      if (!["parameterId", "previewEnabled", "previewDataUrl"].includes(key)) {
        const result = validateNodeProperty(node, d, key, value);
        if (!result.valid) throw Error(result.message);
        value = result.value;
      }
      return {
        commands: [{ type: "SET_PROPERTY", payload: { nodeId, key, value } }],
      };
    },
    report({ message }) {
      report(String(message));
    },
    activity,
  };
}

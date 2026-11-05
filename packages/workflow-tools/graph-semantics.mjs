import {
  branchOwner,
  branchSide,
  variableBranchOwner,
} from "./regions.mjs";
import { resolveNodePorts } from "../plugin-sdk/ports.mjs";
import { validateValue } from "../plugin-sdk/schema.mjs";
import { supportsStage } from "./stages.mjs";
import { validParameterId } from "./parameters.mjs";

// Shader-specific policies stay outside the platform-neutral kernel.
export function createGraphSemantics(getCatalog, getStage) {
  const def = (typeId) => getCatalog().find((d) => d.typeId === typeId);
  /** 来源和端口不匹配时保留旧节点，禁止将其静默绑定到新提供者。 */
  function dependencyIssue(node, stage = null) {
    const current = def(node.typeId), expected = node.plugin;
    const actual = current ? { id: current.owner || "studio.builtin", version: current.version || "1.0.0" } : null;
    const issue = (code, message) => ({ code, message, nodeId: node.id, typeId: node.typeId, stage, expected: expected || null, actual });
    if (!current) return issue("PLUGIN_MISSING", "缺少节点插件或插件未启用：" + (expected?.id || node.typeId));
    if (expected && expected.id !== actual.id)
      return issue("PLUGIN_PROVIDER_CONFLICT", `节点来源冲突：需要 ${expected.id}，当前为 ${actual.id}`);
    if (expected && expected.version !== actual.version)
      return issue("PLUGIN_VERSION_CONFLICT", `节点版本冲突：需要 ${expected.version}，当前为 ${actual.version}`);
    if (stage && (!supportsStage(node.typeId, stage) || (current.stages && !current.stages.includes(stage))))
      return issue("PLUGIN_STAGE_CONFLICT", "节点提供者不支持当前阶段");
    if (expected && node.portSnapshot) {
      const shape = (ports) => JSON.stringify(["inputs", "outputs"].map((key) => ports[key].map(({name, type}) => [name, type]).sort(([a], [b]) => a.localeCompare(b))));
      if (shape(node.portSnapshot) !== shape(resolveNodePorts(current, node.properties)))
        return issue("PLUGIN_PORT_CONFLICT", "节点端口与保存的契约不同，请恢复匹配插件或明确替换节点");
    }
    return null;
  }
  const nodeDef = (node) => {
    const ports = node.portSnapshot;
    const issue = dependencyIssue(node);
    const base =
      (!issue && def(node.typeId)) ||
      (ports
        ? {
            typeId: node.typeId,
            title: issue?.message || `缺少插件：${node.typeId}`,
            category: "缺失插件",
            inputs: ports.inputs,
            outputs: ports.outputs,
            properties: {},
            missing: true,
            diagnostic: issue,
          }
        : null);
    return base ? resolveNodePorts(base, node.properties) : base;
  };
  // Types use stable keys; every user-facing label is
  // the exact GLSL spelling, which also makes custom-node signatures directly transferable to GLSL.
  const GLSL_TYPE_OPTIONS = [
    "bool",
    "int",
    "uint",
    "float",
    "vec2",
    "vec3",
    "vec4",
    "ivec2",
    "ivec3",
    "ivec4",
    "uvec2",
    "uvec3",
    "uvec4",
    "bvec2",
    "bvec3",
    "bvec4",
    "mat2",
    "mat3",
    "mat4",
    "sampler2D",
    "samplerCube",
  ];
  const TYPE_KEY_BY_GLSL = Object.fromEntries(
    GLSL_TYPE_OPTIONS.map((type) => [
      type.toLowerCase(),
      type === "sampler2D"
        ? "SAMPLER2D"
        : type === "samplerCube"
          ? "SAMPLER_CUBE"
          : type.toUpperCase(),
    ]),
  );
  function typeKey(type) {
    return (
      TYPE_KEY_BY_GLSL[String(type || "float").toLowerCase()] ||
      String(type || "FLOAT").toUpperCase()
    );
  }
  function typeLabel(type) {
    const key = typeKey(type);
    return (
      {
        BOOL: "bool",
        INT: "int",
        UINT: "uint",
        FLOAT: "float",
        VEC2: "vec2",
        VEC3: "vec3",
        VEC4: "vec4",
        IVEC2: "ivec2",
        IVEC3: "ivec3",
        IVEC4: "ivec4",
        UVEC2: "uvec2",
        UVEC3: "uvec3",
        UVEC4: "uvec4",
        BVEC2: "bvec2",
        BVEC3: "bvec3",
        BVEC4: "bvec4",
        MAT2: "mat2",
        MAT3: "mat3",
        MAT4: "mat4",
        SAMPLER2D: "sampler2D",
        SAMPLER_CUBE: "samplerCube",
      }[key] || "float"
    );
  }
  function isSupportedType(type) {
    return Object.values(TYPE_KEY_BY_GLSL).includes(typeKey(type));
  }
  const numericTypes = [
    "BOOL",
    "INT",
    "UINT",
    "FLOAT",
    "VEC2",
    "VEC3",
    "VEC4",
    "IVEC2",
    "IVEC3",
    "IVEC4",
    "UVEC2",
    "UVEC3",
    "UVEC4",
    "BVEC2",
    "BVEC3",
    "BVEC4",
  ];
  const portType = (graph, nodeId, socket, direction) =>
    nodeDef(graph.nodes.find((node) => node.id === nodeId))?.[
      direction === "output" ? "outputs" : "inputs"
    ].find((port) => port.name === socket)?.type;
  const compatible = (from, to) =>
    typeKey(from) === "ANY" ||
    typeKey(to) === "ANY" ||
    typeKey(from) === typeKey(to);
  function resolveTypes(graph) {
    const live = new Set(graph.nodes.filter((node) => !dependencyIssue(node)));
    const setType = (node, type) => {
      if (!live.has(node)) return;
      node.properties.valueType = type;
      if (node.plugin) {
        const resolved = resolveNodePorts(def(node.typeId), node.properties);
        node.portSnapshot = { inputs: resolved.inputs, outputs: resolved.outputs };
      }
    };
    for (let pass = 0; pass < graph.nodes.length; pass++)
      graph.links.forEach((link) => {
        const fromType = portType(
            graph,
            link.fromNode,
            link.fromSocket,
            "output",
          ),
          toType = portType(graph, link.toNode, link.toSocket, "input"),
          fromKey = typeKey(fromType),
          toKey = typeKey(toType);
        if (fromKey === "ANY" && numericTypes.includes(toKey))
          setType(graph.nodes.find((node) => node.id === link.fromNode), toKey);
        if (toKey === "ANY" && numericTypes.includes(fromKey))
          setType(graph.nodes.find((node) => node.id === link.toNode), fromKey);
      });
  }
  function pruneInvalidLinks(graph) {
    graph.links = graph.links.filter(
      (link) =>
        compatible(
          portType(graph, link.fromNode, link.fromSocket, "output"),
          portType(graph, link.toNode, link.toSocket, "input"),
        ) && !isInvalidBranchConnection(graph, link),
    );
  }
  function isInvalidBranchConnection(graph, link) {
    const source = graph.nodes.find((node) => node.id === link.fromNode),
      target = graph.nodes.find((node) => node.id === link.toNode);
    if (!source || !target) return false;
    if (source.typeId === "logic.for" && link.fromSocket === "i") {
      const targetOwner = branchOwner(graph, target);
      return !targetOwner || targetOwner.id !== source.id;
    }
    if (source.typeId === "logic.variable" && link.fromSocket === "value")
      return false;
    const sourceOwner = branchOwner(graph, source);
    if (!sourceOwner) return false;
    if (target.typeId === "logic.variable") return link.toSocket !== "value";
    const targetOwner = branchOwner(graph, target);
    return (
      !targetOwner ||
      targetOwner.id !== sourceOwner.id ||
      branchSide(sourceOwner, source) !== branchSide(targetOwner, target)
    );
  }
  function validateConstantValue(value, type) {
    const raw = String(value ?? "").trim(),
      key = typeKey(type),
      label = typeLabel(key),
      count = Number((key.match(/[234]$/) || [])[0] || 0),
      bool = key === "BOOL" || key.startsWith("BVEC"),
      uint = key === "UINT" || key.startsWith("UVEC"),
      integer = uint || key === "INT" || key.startsWith("IVEC");
    const validatePart = (part) => {
      if (bool) return /^(true|false)$/i.test(part);
      if (!Number.isFinite(Number(part))) return false;
      if (uint) return Number.isInteger(Number(part)) && Number(part) >= 0;
      if (integer) return Number.isInteger(Number(part));
      return true;
    };
    if (!count) {
      if (bool)
        return /^(true|false)$/i.test(raw)
          ? { valid: true, value: raw.toLowerCase() }
          : { valid: false, message: "bool 常量只能选择 true 或 false。" };
      return raw !== "" && validatePart(raw)
        ? { valid: true, value: String(Number(raw)) }
        : {
            valid: false,
            message: `${label} 常量必须是${integer ? (uint ? "非负整数" : "整数") : "有效数字"}。`,
          };
    }
    const parts = raw.split(",").map((item) => item.trim());
    if (
      parts.length !== count ||
      parts.some((part) => part === "" || !validatePart(part))
    )
      return {
        valid: false,
        message: `${label} 常量必须输入 ${count} 个逗号分隔的${bool ? " true/false" : "分量"}。`,
      };
    return {
      valid: true,
      value: parts
        .map((part) => (bool ? part.toLowerCase() : String(Number(part))))
        .join(", "),
    };
  }
  function normalizedConstantValue(value, type) {
    const current = validateConstantValue(value, type);
    if (current.valid) return current.value;
    const key = typeKey(type);
    if (key === "BOOL") return "false";
    const count = Number((key.match(/[234]$/) || [])[0] || 0);
    if (key.startsWith("BVEC")) return Array(count).fill("false").join(", ");
    const scalar = Number(value);
    if (count && Number.isFinite(scalar))
      return Array(count).fill(scalar).join(", ");
    return count ? Array(count).fill(0).join(", ") : "0";
  }
  function validateGraphProperties(graph) {
    graph.nodes.forEach((node) => {
      const definition = nodeDef(node);
      Object.entries(node.properties || {}).forEach(([key, value]) => {
        const result = validateNodeProperty(node, definition, key, value);
        if (!result.valid)
          throw new Error(
            `节点“${node.title}”的 ${key} 格式无效：${result.message}`,
          );
      });
    });
  }
  function typedPropertyType(node, definition, key) {
    if (node.typeId === "studio.math.constant" && key === "value")
      return definition.outputs[0]?.type === "ANY"
        ? "FLOAT"
        : definition.outputs[0]?.type || "FLOAT";
    if (node.typeId === "io.input" && key === "defaultValue")
      return definition.outputs[0]?.type === "ANY"
        ? "FLOAT"
        : definition.outputs[0]?.type || "FLOAT";
    if (node.typeId === "input.time" && key === "defaultValue") return "FLOAT";
    if (node.typeId === "logic.variable" && key === "initialValue")
      return definition.outputs[0]?.type === "ANY"
        ? "FLOAT"
        : definition.outputs[0]?.type || "FLOAT";
    return null;
  }
  function typedValueProperty(node) {
    if (node.typeId === "studio.math.constant") return "value";
    if (node.typeId === "io.input" || node.typeId === "input.time")
      return "defaultValue";
    if (node.typeId === "logic.variable") return "initialValue";
    return null;
  }
  function validateNodeProperty(node, definition, key, value) {
    const typed = typedPropertyType(node, definition, key);
    if (typed) return validateConstantValue(value, typed);
    if (typeof node.properties[key] === "boolean")
      return String(value) === "true"
        ? { valid: true, value: true }
        : { valid: true, value: false };
    if (key === "parameterId")
      return validParameterId(String(value))
        ? { valid: true, value: String(value) }
        : {
            valid: false,
            message: "参数 ID 应以字母或下划线开头，后续使用字母、数字或下划线。",
          };
    if (key === "uniform")
      return /^u_[A-Za-z][A-Za-z0-9_]*$/.test(String(value))
        ? { valid: true, value: String(value) }
        : {
            valid: false,
            message:
              "Uniform 名称必须以 u_ 开头，并且后续只能使用字母、数字或下划线。",
          };
    if (
      [
        "trueWidth",
        "trueHeight",
        "falseWidth",
        "falseHeight",
        "width",
        "height",
      ].includes(key)
    )
      return Number.isFinite(Number(value)) && Number(value) > 0
        ? { valid: true, value: String(Number(value)) }
        : { valid: false, message: "分支区域尺寸必须是大于 0 的数字。" };
    // 通用插件字段按声明的 JSON 类型转换，文本控件不能把 number 写成 string。
    const schema = definition.propertySchema?.properties?.[key];
    const kind =
      schema?.type ||
      (Array.isArray(node.properties[key])
        ? "array"
        : typeof node.properties[key]);
    try {
      if (kind === "number" || kind === "integer") {
        if (typeof value === "string" && !value.trim())
          throw Error("数值不能为空");
        value = Number(value);
        validateValue(value, schema || { type: "number" }, key);
      } else if (kind === "array" || kind === "object") {
        value =
          typeof value === "string"
            ? JSON.parse(value)
            : structuredClone(value);
        validateValue(value, schema || { type: kind }, key);
      } else {
        value = String(value);
        if (schema) validateValue(value, schema, key);
      }
      return { valid: true, value };
    } catch (error) {
      return { valid: false, message: error.message };
    }
  }
  function validateStageGraph(graph, stage) {
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.links))
      throw new Error("工作流必须包含 nodes 与 links");
    const ids = new Set(),
      types = new Set(
        getCatalog()
          .filter(
            (n) =>
              supportsStage(n.typeId, stage) &&
              (!n.stages || n.stages.includes(stage)),
          )
          .map((node) => node.typeId),
      );
    graph.nodes.forEach((node) => {
      if (!node.id || ids.has(node.id))
        throw new Error(`节点 ID 重复或为空：${node.id || "<empty>"}`);
      if (!types.has(node.typeId) && !(node.plugin && node.portSnapshot))
        throw new Error(`未知节点类型：${node.typeId}`);
      if (
        !Number.isFinite(Number(node.canvasX)) ||
        !Number.isFinite(Number(node.canvasY))
      )
        throw new Error(`节点坐标无效：${node.id}`);
      node.properties ||= {};
      const definition = def(node.typeId);
      const issue = dependencyIssue(node, stage);
      if (
        !issue && definition &&
        definition.owner !== "studio.builtin" &&
        definition.owner
      ) {
        node.plugin = { id: definition.owner, version: definition.version };
        const resolved = nodeDef(node);
        node.portSnapshot = {
          inputs: structuredClone(resolved.inputs),
          outputs: structuredClone(resolved.outputs),
        };
      }
      if (!issue && definition?.propertySchema)
        validateValue(node.properties, definition.propertySchema, "节点属性");
      ids.add(node.id);
    });
    const destinations = new Set();
    graph.links.forEach((link) => {
      const destination = JSON.stringify([link.toNode, link.toSocket]);
      if (destinations.has(destination))
        throw new Error("同一输入端口存在重复连线");
      destinations.add(destination);
      const from = graph.nodes.find((node) => node.id === link.fromNode),
        to = graph.nodes.find((node) => node.id === link.toNode);
      if (!from || !to || !link.fromSocket || !link.toSocket)
        throw new Error("存在指向未知节点或端口不完整的连线");
      const fromPort = nodeDef(from)?.outputs.find(
          (port) => port.name === link.fromSocket,
        ),
        toPort = nodeDef(to)?.inputs.find(
          (port) => port.name === link.toSocket,
        );
      if (!fromPort || !toPort)
        throw new Error(
          `连线引用了不存在的端口：${link.fromNode}.${link.fromSocket} -> ${link.toNode}.${link.toSocket}`,
        );
      if (!compatible(fromPort.type, toPort.type))
        throw new Error(
          `连线类型不匹配：${typeLabel(fromPort.type)} 不能连接到 ${typeLabel(toPort.type)}`,
        );
      if (isInvalidBranchConnection(graph, link))
        throw new Error(
          "分支内部的输出只能连接同一分支节点，或通过变量节点带出。",
        );
    });
    return graph;
  }
  function validateCommand(graph, type, payload) {
    if (type === "SET_PROPERTY") {
      const node = graph.nodes.find((n) => n.id === payload.nodeId);
      if (node?.plugin && !dependencyIssue(node)) {
        const resolved = resolveNodePorts(def(node.typeId), { ...node.properties, [payload.key]: payload.value });
        node.portSnapshot = { inputs: resolved.inputs, outputs: resolved.outputs };
      }
    }
    if (
      type === "RENAME_NODE_ID" &&
      (!/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(payload.id) ||
        payload.id.includes("__") ||
        ["__proto__", "prototype", "constructor"].includes(payload.id))
    )
      throw Error(
        "节点 ID 使用 1–80 位英文字母、数字或下划线，不能数字开头或包含连续下划线",
      );
    if (type === "ADD_NODE") {
      const node = payload.node;
      if (
        !node ||
        !def(node.typeId) ||
        !supportsStage(node.typeId, getStage()) ||
        (def(node.typeId).stages &&
          !def(node.typeId).stages.includes(getStage()))
      )
        throw new Error("未知节点类型或不支持当前阶段");
      const definition = def(node.typeId);
      if (node.plugin && (node.plugin.id !== (definition.owner || "studio.builtin") || node.plugin.version !== (definition.version || "1.0.0")))
        throw Error("新增节点的插件来源与当前提供者不一致");
      if (definition.owner && definition.owner !== "studio.builtin")
        node.plugin = { id: definition.owner, version: definition.version };
      node.portSnapshot = {
        inputs: structuredClone(nodeDef(node).inputs),
        outputs: structuredClone(nodeDef(node).outputs),
      };
      if (!Number.isFinite(node.canvasX) || !Number.isFinite(node.canvasY))
        throw new Error("节点坐标必须是有限数字");
      if (
        !node.properties ||
        typeof node.properties !== "object" ||
        Array.isArray(node.properties)
      )
        throw new Error("节点属性必须是对象");
    }
    if (type === "CONNECT") {
      const link = payload.link,
        source = graph.nodes.find((node) => node.id === link?.fromNode),
        target = graph.nodes.find((node) => node.id === link?.toNode);
      const from =
          source &&
          nodeDef(source)?.outputs.find(
            (port) => port.name === link.fromSocket,
          ),
        to =
          target &&
          nodeDef(target)?.inputs.find((port) => port.name === link.toSocket);
      if (!from || !to) throw new Error("连线引用不存在的端口");
      if (!compatible(from.type, to.type)) throw new Error("连线类型不匹配");
    }
    if (
      type === "SET_PROPERTY" &&
      payload.key === "valueType" &&
      payload.value !== "AUTO" &&
      !isSupportedType(payload.value)
    )
      throw new Error("不支持的 GLSL 类型");
  }

  return {
    dependencyIssue,
    def,
    nodeDef,
    GLSL_TYPE_OPTIONS,
    typeKey,
    typeLabel,
    isSupportedType,
    portType,
    compatible,
    resolveTypes,
    pruneInvalidLinks,
    branchOwner,
    branchSide,
    isInvalidBranchConnection,
    variableBranchOwner,
    validateConstantValue,
    normalizedConstantValue,
    validateGraphProperties,
    typedPropertyType,
    typedValueProperty,
    validateNodeProperty,
    validateStageGraph,
    validateCommand,
  };
}

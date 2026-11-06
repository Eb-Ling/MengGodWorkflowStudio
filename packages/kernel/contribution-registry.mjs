import {
  copyJson,
  validateValue,
  validateSchema,
} from "../plugin-sdk/schema.mjs";
import { defineGlslNode } from "../plugin-sdk/glsl-node.mjs";
import { registration } from "../plugin-sdk/registration.mjs";
import { validateExpression, EXPRESSION_TYPES } from "../plugin-sdk/ir.mjs";
import { resolveNodePorts, DYNAMIC_KINDS } from "../plugin-sdk/ports.mjs";

/** 节点定义和编译规则的原子注册表，按所有者释放，不接受跨插件实现引用。 */
export class ContributionRegistry {
  #nodes = new Map();
  #rules = new Map();
  #listeners = new Set();
  #generation = 0;
  #invalidation = 0;
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  /** 外部异步编译结果就绪时通知消费者，不改动文档或历史。 */
  invalidate(owner) {
    if (owner) {
      for (const entry of this.#nodes.values())
        if (entry.owner === owner)
          entry.invalidation = (entry.invalidation || 0) + 1;
    } else this.#invalidation++;
    this.#emit();
  }
  /** 只读编译身份，普通登记只影响所属类型，无法定向的异步失效使用独立修订。 */
  identity(typeIds) {
    return [...new Set(typeIds)].sort().map((typeId) => {
      const entry = this.#nodes.get(typeId);
      return [
        typeId,
        entry?.owner ?? null,
        entry?.version ?? null,
        entry?.fingerprint ?? null,
        entry?.generation ?? null,
        entry?.invalidation || 0,
        this.#invalidation,
      ];
    });
  }
  #emit() {
    for (const fn of this.#listeners) {
      try {
        fn();
      } catch {}
    }
  }
  list() {
    return [...this.#nodes.values()].map((entry) => ({
      ...copyJson(entry.definition),
      owner: entry.owner,
      version: entry.version,
    }));
  }
  get(typeId) {
    const entry = this.#nodes.get(typeId);
    return entry ? copyJson(entry.definition) : null;
  }
  owner(typeId) {
    const entry = this.#nodes.get(typeId);
    return entry ? { id: entry.owner, version: entry.version } : null;
  }
  /** 一次注册中的节点和每个目标规则必须齐全，任一冲突都不会留下部分注册。 */
  register(
    owner,
    version,
    { nodes, compilers },
    { builtinDefinitions = false, fingerprint = null } = {},
  ) {
    let current = null,
      active = true;
    const remove = () => {
      for (const key of current.nodes) this.#nodes.delete(key);
      for (const key of current.rules) this.#rules.delete(key);
    };
    const install = ({ nodes, compilers }) => {
      if (!active) throw Error("节点登记已经释放");
      if (
        !/^[a-z][\w.-]+$/.test(owner) ||
        !/^\d+\.\d+\.\d+$/.test(version) ||
        !Array.isArray(nodes) ||
        !nodes.length ||
        !Array.isArray(compilers)
      )
        throw new Error("注册清单无效");
      const pending = new Map(),
        rules = new Map();
      for (const input of nodes) {
        const definition = copyJson(input);
        if (
          !definition.typeId ||
          (!builtinDefinitions &&
            (!definition.typeId.startsWith(owner + ".") ||
              !/^[a-z][\w.-]+$/.test(definition.typeId))) ||
          (this.#nodes.has(definition.typeId) &&
            !current?.nodes.has(definition.typeId)) ||
          pending.has(definition.typeId)
        )
          throw new Error(`节点 ID 冲突或越权：${definition.typeId}`);
        if (
          typeof definition.title !== "string" ||
          !definition.title ||
          (definition.category !== undefined &&
            typeof definition.category !== "string") ||
          !Array.isArray(definition.inputs) ||
          !Array.isArray(definition.outputs)
        )
          throw new Error("节点定义缺少标题或端口");
        if (
          definition.dynamicKind &&
          !DYNAMIC_KINDS.includes(definition.dynamicKind)
        )
          throw new Error("未知动态端口规则");
        for (const ports of [definition.inputs, definition.outputs]) {
          const names = new Set();
          for (const port of ports) {
            if (!port.name || !port.type || names.has(port.name))
              throw new Error("端口定义无效");
            if (
              !builtinDefinitions &&
              (!/^[A-Za-z_]\w*$/.test(port.name) ||
                !(
                  EXPRESSION_TYPES.includes(port.type) ||
                  (port.type === "ANY" && definition.dynamicKind)
                ))
            )
              throw new Error("插件端口名或类型无效");
            names.add(port.name);
          }
        }
        definition.properties ||= {};
        definition.targets ||= ["glsl-es-300", "glsl-430"];
        definition.stages ||= ["vertex", "fragment"];
        if (
          !definition.targets.length ||
          !definition.stages.length ||
          definition.targets.some(
            (x) => !["glsl-es-300", "glsl-430"].includes(x),
          ) ||
          definition.stages.some((x) => !["vertex", "fragment"].includes(x))
        )
          throw new Error("节点目标/阶段无效");
        if (definition.propertySchema) {
          validateSchema(
            definition.propertySchema,
            definition.typeId + ".properties",
          );
          validateValue(
            definition.properties,
            definition.propertySchema,
            "默认属性",
          );
        }
        if (definition.glsl !== undefined) {
          const canonical = defineGlslNode(definition);
          if (
            definition.dynamicKind ||
            ["inputs", "outputs"].some(
              (k) =>
                canonical[k].length !== definition[k].length ||
                canonical[k].some(
                  (p, i) =>
                    p.name !== definition[k][i].name ||
                    p.type !== definition[k][i].type,
                ),
            )
          )
            throw Error("GLSL 参数与节点端口不一致：" + definition.typeId);
          definition.glsl = canonical.glsl;
        }
        pending.set(definition.typeId, { owner, version, definition });
      }
      for (const rule of compilers) {
        const key = rule.typeId + "@" + rule.target;
        if (
          !pending.has(rule.typeId) ||
          rules.has(key) ||
          typeof rule.compile !== "function"
        )
          throw new Error("编译规则重复、无对应节点或不可调用");
        if (pending.get(rule.typeId).definition.glsl)
          throw Error("GLSL 函数和表达式规则不能重复登记");
        if (!pending.get(rule.typeId).definition.targets.includes(rule.target))
          throw new Error("编译目标未声明");
        rules.set(key, { ...rule, owner });
      }
      for (const [typeId, entry] of pending)
        for (const target of entry.definition.targets)
          if (
            !builtinDefinitions &&
            !entry.definition.glsl &&
            !rules.has(typeId + "@" + target)
          )
            throw new Error(`缺少编译规则：${typeId} / ${target}`);
      if (current) remove();
      current = {
        nodes: new Set(pending.keys()),
        rules: new Set(rules.keys()),
      };
      const generation = ++this.#generation;
      for (const [key, value] of pending)
        this.#nodes.set(key, { ...value, generation, fingerprint });
      for (const [key, value] of rules) this.#rules.set(key, value);
      this.#emit();
    };
    install({ nodes, compilers });
    const handle = registration(owner, () => {
      active = false;
      remove();
      this.#emit();
    });
    return Object.freeze({
      owner,
      get active() {
        return handle.active;
      },
      dispose: handle.dispose,
      replace: install,
    });
  }
  /** 编译一个输出，同步或异步结果均校验 IR，已撤销规则的迟到结果不得返回。 */
  compile(typeId, target, context) {
    const rule = this.#rules.get(typeId + "@" + target);
    if (!rule) throw new Error(`缺少节点编译器：${typeId} / ${target}`);
    context = copyJson(context);
    const definition = this.get(typeId);
    if (definition.propertySchema)
      validateValue(
        context.node.properties,
        definition.propertySchema,
        "节点属性",
      );
    const value = rule.compile(copyJson(context));
    const validate = (value) => {
      if (this.#rules.get(typeId + "@" + target) !== rule)
        throw new Error("节点编译规则已撤销：" + typeId);
      const result = validateExpression(value);
      const resolved = resolveNodePorts(definition, context.node.properties);
      const concrete = (p) => ({
        ...p,
        type: p.type === "ANY" ? "FLOAT" : p.type,
      });
      const inputs = resolved.inputs.map(concrete);
      const output = resolved.outputs
        .map(concrete)
        .find((p) => p.name === context.socket);
      if (!output || result.type !== output.type)
        throw new Error(`IR 输出类型不匹配：${typeId}.${context.socket}`);
      const checkInput = (item) => {
        if (
          item.kind === "input" &&
          !inputs.some(
            (port) => port.name === item.name && port.type === item.type,
          )
        )
          throw new Error("IR 引用未知输入或类型不匹配");
        if (item.left) checkInput(item.left);
        if (item.right) checkInput(item.right);
        for (const arg of item.args || []) checkInput(arg);
      };
      checkInput(result);
      return result;
    };
    return value && typeof value.then === "function"
      ? Promise.resolve(value).then(validate)
      : validate(value);
  }
}

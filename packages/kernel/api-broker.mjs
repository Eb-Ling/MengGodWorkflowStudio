import {
  copyJson,
  validateValue,
  validateSchema,
} from "../plugin-sdk/schema.mjs";
import { ContractError, contractFailure } from "../plugin-sdk/errors.mjs";
export const validId = (value) =>
  typeof value === "string" && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/.test(value);
export const validVersion = (value) =>
  typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
/** 支持精确版本和 caret 范围，不接受未实现的 npm 版本表达式。 */
export function compatibleVersion(actual, range) {
  if (!validVersion(actual) || typeof range !== "string") return false;
  if (!range.startsWith("^")) return actual === range;
  const minimum = range.slice(1);
  if (!validVersion(minimum)) return false;
  const a = actual.split(".").map(Number),
    b = minimum.split(".").map(Number);
  if (
    a[0] !== b[0] ||
    (a[0] === 0 && a[1] !== b[1]) ||
    (a[0] === 0 && a[1] === 0 && a[2] !== b[2])
  )
    return false;
  return a[1] > b[1] || (a[1] === b[1] && a[2] >= b[2]);
}

/** API 的声明、提供者选择与调用代理。生命周期顺序由 PluginHost 决定。 */
export class ApiBroker {
  declarations = new Map();
  values = new Map();
  selection = new Map();
  declare(owner, id, definition) {
    if (!validId(id) || !validVersion(definition.version))
      throw new ContractError("INVALID_REGISTRATION", `API 声明无效：${id}`);
    const key = owner + ":" + id;
    if (this.declarations.has(key))
      throw new ContractError("CONFLICT", `API 重复：${id}`);
    const snapshot = copyJson(definition);
    for (const [name, method] of Object.entries(snapshot.methods || {})) {
      if (!method || typeof method !== "object" || Array.isArray(method))
        throw new ContractError(
          "INVALID_REGISTRATION",
          `API 方法声明无效：${id}.${name}`,
        );
      if (method.arguments)
        validateSchema(method.arguments, `${id}.${name}.arguments`);
      if (method.returns)
        validateSchema(method.returns, `${id}.${name}.returns`);
    }
    this.declarations.set(key, { ...snapshot, owner, id });
  }
  /** 仅撤销这次失败的声明，不影响宿主已提供的其他 API。 */
  removeDeclaration(owner, id) {
    this.declarations.delete(owner + ":" + id);
    this.values.delete(owner + ":" + id);
  }
  removeOwner(owner) {
    for (const [key, item] of this.declarations)
      if (item.owner === owner) {
        this.declarations.delete(key);
        this.values.delete(key);
      }
  }
  select(id, owner) {
    if (!this.declarations.has(owner + ":" + id))
      throw new Error("未知 API 提供者");
    this.selection.set(id, owner);
  }
  resolve(id, range) {
    let candidates = [...this.declarations.values()].filter(
      (item) => item.id === id && compatibleVersion(item.version, range),
    );
    const selected = this.selection.get(id);
    if (selected)
      candidates = candidates.filter((item) => item.owner === selected);
    if (candidates.length > 1)
      throw new Error(`API ${id} 有多个提供者，请由宿主选择`);
    return candidates[0] || null;
  }
  publish(owner, id, value) {
    const key = owner + ":" + id,
      definition = this.declarations.get(key);
    if (!definition) throw new Error(`未声明提供的 API：${id}`);
    if (this.values.has(key)) throw new Error(`API 已提供：${id}`);
    if (
      !value ||
      (definition.scoped
        ? typeof value !== "function"
        : typeof value !== "object")
    )
      throw new Error("API 实现必须是对象，作用域 API 必须是工厂");
    for (const name of definition.scoped
      ? []
      : Object.keys(definition.methods || {}))
      if (typeof value[name] !== "function")
        throw new Error(`API 缺少方法：${id}.${name}`);
    this.values.set(key, value);
  }
  unpublish(owner) {
    for (const [key, item] of this.declarations)
      if (item.owner === owner) this.values.delete(key);
  }
  /** 异步 JSON 能力的延迟代理，调用前先检查声明和权限，再由唯一生命周期管理器激活。 */
  deferred(definition, consumer, capabilities, isLive, own, metadata, ensure) {
    let handle = null;
    const methods = new Map();
    const check = () => {
      if (!isLive())
        throw new ContractError("API_REVOKED", `API 已撤销：${definition.id}`);
    };
    return new Proxy(
      {},
      {
        get: (_target, name) => {
          check();
          const contract = Object.hasOwn(definition.methods || {}, name)
            ? definition.methods[name]
            : null;
          if (!contract) throw Error(`未声明方法：${String(name)}`);
          if (!methods.has(name))
            methods.set(name, async (...args) => {
              check();
              if (contract.capability && !capabilities.has(contract.capability))
                throw new ContractError(
                  "PERMISSION_DENIED",
                  `缺少能力：${contract.capability}`,
                );
              const input = copyJson(args);
              validateValue(
                input,
                contract.arguments,
                `${definition.id}.${String(name)} 参数`,
              );
              await ensure();
              check();
              handle ||= this.handle(
                definition,
                consumer,
                capabilities,
                isLive,
                own,
                metadata,
              );
              return handle[name](...input);
            });
          return methods.get(name);
        },
      },
    );
  }
  /** 返回受生命周期与能力约束的代理，插件提供的 API 仅通过 schema 校验的 JSON 数据交换。 */
  handle(
    definition,
    consumer,
    capabilities,
    isLive,
    own = () => {},
    metadata = {},
  ) {
    const key = definition.owner + ":" + definition.id,
      original = this.values.get(key);
    if (!original) throw new Error(`API 尚未就绪：${definition.id}`);
    const value = definition.scoped
        ? original(consumer, own, metadata)
        : original,
      methods = new Map();
    for (const name of Object.keys(definition.methods || {}))
      if (typeof value?.[name] !== "function")
        throw Error(`API 缺少方法：${definition.id}.${name}`);
    const check = () => {
      if (!isLive() || this.values.get(key) !== original)
        throw new ContractError("API_REVOKED", `API 已撤销：${definition.id}`);
    };
    return new Proxy(
      {},
      {
        get: (_target, name) => {
          check();
          const member = value[name];
          if (typeof member !== "function") {
            if (
              definition.jsonOnly ||
              (definition.declaredOnly && !definition.values?.includes(name))
            )
              throw new Error("插件 API 仅暴露已声明的方法");
            return member;
          }
          const contract = Object.hasOwn(definition.methods || {}, name)
            ? definition.methods[name]
            : null;
          if ((definition.jsonOnly || definition.declaredOnly) && !contract)
            throw new Error(`未声明方法：${String(name)}`);
          if (!methods.has(name))
            methods.set(name, (...args) => {
              check();
              const capability = contract?.capability;
              if (capability && !capabilities.has(capability))
                throw new ContractError(
                  "PERMISSION_DENIED",
                  `缺少能力：${capability}`,
                );
              let input = args;
              if (definition.jsonOnly) {
                input = copyJson(args);
                validateValue(
                  input,
                  contract.arguments,
                  `${definition.id}.${String(name)} 参数`,
                );
              }
              let result;
              try {
                result = member.apply(value, input);
              } catch (error) {
                throw contractFailure(error);
              }
              const finish = (output) => {
                check();
                if (!definition.jsonOnly) return output;
                const copy = copyJson(output);
                validateValue(
                  copy,
                  contract.returns,
                  `${definition.id}.${String(name)} 返回值`,
                );
                return copy;
              };
              return result?.then
                ? result.then(finish, (error) => {
                    throw contractFailure(error);
                  })
                : finish(result);
            });
          return methods.get(name);
        },
      },
    );
  }
}

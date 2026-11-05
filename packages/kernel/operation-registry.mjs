import {
  copyJson,
  validateValue,
  validateSchema,
} from "../plugin-sdk/schema.mjs";
import { registration, ownRegistration } from "../plugin-sdk/registration.mjs";
import { ContractError } from "../plugin-sdk/errors.mjs";
import { validId, validVersion } from "./api-broker.mjs";

/** 通用数据处理扩展点。内核只校验契约、命名空间和生命周期，不理解具体导出格式。 */
export class OperationRegistry {
  #entries = new Map();
  #listeners = new Set();
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  #emit() {
    for (const listener of this.#listeners)
      try {
        listener();
      } catch {}
  }
  list() {
    return [...this.#entries.values()].map(({ run, ...entry }) =>
      copyJson(entry),
    );
  }
  has(id) {
    return this.#entries.has(id);
  }
  /** 一批操作原子注册，返回的句柄可重复清理，不能删除其他所有者的操作。 */
  register(owner, version, operations) {
    if (!validId(owner) || !validVersion(version))
      throw Error("操作所有者或版本无效");
    if (!Array.isArray(operations) || !operations.length)
      throw Error("操作贡献不能为空");
    const pending = new Map();
    for (const item of operations) {
      const { run, ...metadata } = item,
        entry = copyJson({ ...metadata, owner, version });
      if (
        typeof run !== "function" ||
        !entry.id?.startsWith(owner + ".") ||
        !/^[a-z][\w.-]+$/.test(entry.id) ||
        this.#entries.has(entry.id) ||
        pending.has(entry.id)
      )
        throw Error("操作 ID 冲突、越权或处理器无效");
      if (!entry.inputSchema || !entry.outputSchema || !entry.title)
        throw Error("操作必须声明输入、输出 schema 和标题");
      validateSchema(entry.inputSchema, entry.id + ".inputSchema");
      validateSchema(entry.outputSchema, entry.id + ".outputSchema");
      pending.set(entry.id, { ...entry, run });
    }
    for (const [id, entry] of pending) this.#entries.set(id, entry);
    this.#emit();
    return registration(owner, () => {
      for (const [id, entry] of pending)
        if (this.#entries.get(id) === entry) this.#entries.delete(id);
      this.#emit();
    });
  }
  /** 执行时传入/返回 JSON 副本，停用或替换后，旧异步结果被拒绝。 */
  execute(id, input) {
    const entry = this.#entries.get(id);
    if (!entry) throw Error("缺少已启用的操作提供者：" + id);
    const value = copyJson(input);
    validateValue(value, entry.inputSchema, id + " 输入");
    const finish = (result) => {
      if (this.#entries.get(id) !== entry)
        throw new ContractError("API_REVOKED", "操作提供者已停用或替换：" + id);
      const output = copyJson(result);
      validateValue(output, entry.outputSchema, id + " 输出");
      return output;
    };
    const result = entry.run(value);
    return result?.then ? result.then(finish) : finish(result);
  }
  /** 为插件创建公开操作 API，注册项和订阅都由内核生命周期兜底回收。 */
  createApi(owner, own = () => {}, metadata = { version: "1.0.0" }) {
    return {
      list: () => this.list(),
      execute: (id, input) => this.execute(id, input),
      register: (operations) => {
        const h = this.register(owner, metadata.version, operations);
        return ownRegistration(own, h);
      },
      subscribe: (listener) => {
        const stop = this.subscribe(listener);
        return ownRegistration(own, registration(owner, stop)).dispose;
      },
    };
  }
}

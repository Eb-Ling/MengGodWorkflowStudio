import { PluginHost } from "../kernel/index.mjs";
import { activatePlugin } from "./context.mjs";

/** 将公开插件定义转换为内核执行单元，不保留第二套启停状态或依赖关系。 */
function execution(definition) {
  if (!definition || typeof definition.activate !== "function")
    throw Error("插件必须提供 activate(context) 入口");
  const activate = definition.activate;
  return {
    manifest: definition.manifest,
    fingerprint: definition.fingerprint ?? null,
    start: (port) => activatePlugin(activate, port),
  };
}

/**
 * L1 统一接入入口，供组合根、原生宿主和开发测试包使用。
 * 唯一 PluginHost 私有保存在这里，所有依赖、权限、撤销与回收决策仍由 L0 执行。
 * 业务插件只收到 SDK 上下文，不能取得此对象或内核执行端口。
 */
export class PluginRuntime {
  #host;
  constructor(options = {}) {
    this.#host = new PluginHost(options);
  }
  /** 登记公开插件定义，授权范围由宿主显式指定，尚不启动插件。 */
  register(definition, options) {
    return this.#host.register(execution(definition), options);
  }
  /** 替换公开定义，失败恢复、消费者重绑和启停次序由内核负责。 */
  replace(definition, options) {
    return this.#host.replace(execution(definition), options);
  }
  /** 注入宿主基础能力，业务插件不得取得此管理入口。 */
  provide(...args) {
    return this.#host.provide(...args);
  }
  /** 指定有多个兼容实现时使用的提供者，不自行维护选择状态。 */
  selectProvider(...args) {
    return this.#host.selectProvider(...args);
  }
  /** 读取内核生成的插件状态快照。 */
  list() {
    return this.#host.list();
  }
  /** 查询停用或替换将影响的消费者。 */
  impact(id) {
    return this.#host.impact(id);
  }
  /** 请求启停，依赖排序和清理仍由唯一内核执行。 */
  setEnabled(id, enabled, options) {
    return this.#host.setEnabled(id, enabled, options);
  }
  /** 注销插件及其受影响的挂载。 */
  unregister(id) {
    return this.#host.unregister(id);
  }
  /** 释放此宿主的全部插件资源。 */
  dispose() {
    return this.#host.dispose();
  }
}

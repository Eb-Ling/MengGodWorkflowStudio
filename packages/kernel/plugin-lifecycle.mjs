import {
  ApiBroker,
  validId,
  validVersion,
  compatibleVersion,
} from "./api-broker.mjs";
import { readActivationEvents } from "../plugin-sdk/plugin-activation.mjs";
export { compatibleVersion } from "./api-broker.mjs";

/** 唯一插件管理器：解析依赖、编排启停、回滚及回收。只接宿主执行单元，不构造插件 SDK。 */
export class PluginHost {
  #broker = new ApiBroker();
  #plugins = new Map();
  #tail = Promise.resolve();
  #enforceLayers;
  #activations = new Map();
  #starting = new Map();
  #generation = 0;
  #closed = false;
  constructor({ enforceLayers = false } = {}) {
    this.#enforceLayers = enforceLayers;
  }
  #checkLayer(consumer, provider) {
    if (!this.#enforceLayers) return;
    const from = consumer.layer ?? 3,
      to = provider.layer ?? 1;
    if (![2, 3].includes(from) || from < to || from - to > 1)
      throw Error(
        `禁止跨层业务依赖：${consumer.id} L${from} → ${provider.id} L${to}`,
      );
  }
  /** 宿主注册公共能力。scoped=true 时实现为按插件所有者创建 API 的工厂。 */
  provide(id, version, value, scoped = false, options = {}) {
    this.#broker.declare("$host", id, {
      version,
      scoped,
      ...options,
      layer: 1,
    });
    try {
      this.#broker.publish("$host", id, value);
    } catch (error) {
      this.#broker.removeDeclaration("$host", id);
      throw error;
    }
  }
  /** 注册插件清单。能力必须同时列于清单及宿主授予列表，此方法不激活插件。 */
  register(
    definition,
    {
      grantedCapabilities = definition.manifest.capabilities || [],
      allowLocalApis = false,
    } = {},
  ) {
    const manifest = structuredClone(definition.manifest);
    const activationEvents = readActivationEvents(manifest);
    if (this.#closed) throw Error("插件宿主已关闭");
    if (this.#enforceLayers && ![2, 3].includes(manifest.layer ?? 3))
      throw Error("插件层级必须为 L2 或 L3");
    if (
      !validId(manifest.id) ||
      !validVersion(manifest.version) ||
      manifest.apiVersion !== "1.0.0" ||
      this.#plugins.has(manifest.id) ||
      typeof definition.start !== "function" ||
      !manifest.requiredApis ||
      typeof manifest.requiredApis !== "object" ||
      Array.isArray(manifest.requiredApis)
    )
      throw new Error("插件清单无效、版本不兼容或 ID 重复");
    for (const [id, range] of Object.entries({
      ...manifest.optionalApis,
      ...manifest.requiredApis,
    }))
      if (!validId(id) || !validVersion(String(range).replace(/^\^/, "")))
        throw new Error(`API 声明无效：${id}`);
    if (
      (manifest.capabilities || []).some(
        (value) => !grantedCapabilities.includes(value),
      )
    )
      throw new Error("宿主未授予插件请求的全部能力");
    try {
      for (const [id, api] of Object.entries(manifest.providesApis || {})) {
        const local = api.transport === "local";
        if (api.transport && !["local", "json"].includes(api.transport))
          throw new Error("未知 API 传输类型");
        if (local && !allowLocalApis) throw new Error("宿主未授权本地对象 API");
        // 工厂留在受信任宿主内，为消费者绑定所有者，跨边界的参数/返回仍校验为 JSON。
        if (!api.methods || !Object.keys(api.methods).length)
          throw new Error("提供 API 必须声明方法 schema");
        for (const method of Object.values(api.methods))
          if (!local && (!method.arguments || !method.returns))
            throw new Error("API 方法必须声明参数和返回 schema");
        this.#broker.declare(manifest.id, id, {
          ...api,
          jsonOnly: !local,
          declaredOnly: true,
          layer: manifest.layer ?? 3,
        });
      }
      this.#assertNoApiCycles(manifest);
    } catch (error) {
      this.#broker.removeOwner(manifest.id);
      throw error;
    }
    this.#plugins.set(manifest.id, {
      manifest,
      start: definition.start,
      enabled: false,
      error: null,
      cleanup: [],
      bindings: new Map(),
      capabilities: new Set(manifest.capabilities || []),
      allowLocalApis,
      deferred: activationEvents.length > 0,
      requested: false,
      blocked: false,
      intent: 0,
      fingerprint: definition.fingerprint ?? null,
      generation: 0,
    });
  }
  /** 注册阶段即拒绝必需/可选 API 的潜在依赖环，不等到首次激活才发现。 */
  #assertNoApiCycles(candidate) {
    const manifests = new Map(
      [...this.#plugins].map(([id, p]) => [id, p.manifest]),
    );
    manifests.set(candidate.id, candidate);
    const visiting = [],
      done = new Set();
    const visit = (id) => {
      if (visiting.includes(id))
        throw Error("插件 API 依赖循环：" + [...visiting, id].join(" → "));
      if (done.has(id)) return;
      visiting.push(id);
      const manifest = manifests.get(id);
      for (const [api, range] of Object.entries({
        ...manifest.optionalApis,
        ...manifest.requiredApis,
      }))
        for (const d of this.#broker.declarations.values())
          if (d.id === api && compatibleVersion(d.version, range)) {
            this.#checkLayer(manifest, d);
            if (d.owner !== "$host" && manifests.has(d.owner)) visit(d.owner);
          }
      visiting.pop();
      done.add(id);
    };
    for (const id of manifests.keys()) visit(id);
  }
  /** 多提供者时显式选择，已有活动消费者时拒绝切换，避免静默替换语义。 */
  selectProvider(apiId, pluginId) {
    if (
      [...this.#plugins.values()].some(
        (p) => p.enabled && p.bindings.has(apiId),
      )
    )
      throw new Error("请先停用 API 消费者再切换提供者");
    this.#broker.select(apiId, pluginId);
  }
  list() {
    return [...this.#plugins.values()].map((p) => ({
      ...structuredClone(p.manifest),
      enabled: p.enabled || p.requested,
      active: p.enabled,
      activationState: p.enabled
        ? "active"
        : p.error
          ? "failed"
          : p.requested
            ? "waiting"
            : "disabled",
      error: p.error,
      // 返回实际绑定的提供者，不能用声明范围推测当前实现。
      bindings: Object.fromEntries(p.bindings),
      dependencies: [
        ...new Set([...p.bindings.values()].filter((x) => x !== "$host")),
      ],
    }));
  }
  /** 查看停用会影响的必需消费者及可选消费者，供管理界面展示。 */
  impact(id) {
    const required = new Set([id]),
      optional = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      for (const [key, p] of this.#plugins)
        if ((p.enabled || p.requested) && !required.has(key)) {
          // 待命插件尚无实际句柄，停用影响仍需覆盖其必需提供者。
          const dependencies = p.enabled
            ? p.bindings
            : Object.entries(p.manifest.requiredApis).map(([api, range]) => [
                api,
                this.#broker.resolve(api, range)?.owner,
              ]);
          for (const [api, owner] of dependencies)
            if (required.has(owner)) {
              if (p.manifest.requiredApis[api]) {
                required.add(key);
                changed = true;
              } else optional.add(key);
            }
        }
    }
    // 可选消费者重启也会撤销自己的 API，因此其所有间接消费者都必须重新绑定。
    changed = true;
    while (changed) {
      changed = false;
      for (const [key, p] of this.#plugins)
        if (
          p.enabled &&
          !required.has(key) &&
          !optional.has(key) &&
          [...p.bindings.values()].some((owner) => optional.has(owner))
        ) {
          optional.add(key);
          changed = true;
        }
    }
    return {
      stop: [...required],
      restart: [...optional].filter((x) => !required.has(x)),
    };
  }
  /** 以实际绑定排序，消费者先停止，不依赖插件登记顺序。 */
  #stopOrder(ids) {
    const selected = new Set(ids),
      seen = new Set(),
      result = [];
    const visit = (id) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const [key, p] of this.#plugins)
        if (selected.has(key) && [...p.bindings.values()].includes(id))
          visit(key);
      result.push(id);
    };
    for (const id of selected) visit(id);
    return result;
  }
  /** defer 仅供启动恢复使用，明确点击启用仍立即验证实现。 */
  setEnabled(id, enabled, { defer = false } = {}) {
    const p = this.#plugins.get(id),
      intent = p ? ++p.intent : 0;
    if (p && !enabled) p.blocked = true;
    const task = this.#tail.then(() => {
      if (this.#closed) throw Error("插件宿主已关闭");
      if (enabled && p?.intent !== intent) return { superseded: true };
      if (p && enabled) p.blocked = false;
      return this.#change(id, enabled, { defer });
    });
    this.#tail = task.catch(() => {});
    return task;
  }
  /** 卸载定义，先按依赖规则停止贡献与资源，再释放所有者的 API 声明。 */
  unregister(id) {
    const task = this.#tail.then(async () => {
      if (!this.#plugins.has(id)) throw new Error("未知插件：" + id);
      await this.#change(id, false);
      this.#broker.removeOwner(id);
      this.#plugins.delete(id);
    });
    this.#tail = task.catch(() => {});
    return task;
  }
  /** 原子替换定义并恢复启用状态，失败时重新激活旧定义及原有消费者。 */
  replace(definition, options = {}) {
    const task = this.#tail.then(async () => {
      const id = definition.manifest.id,
        old = this.#plugins.get(id);
      if (!old) throw new Error("未知插件：" + id);
      const active = new Set(
        [...this.#plugins].filter(([, p]) => p.enabled).map(([key]) => key),
      );
      const before = [...this.#plugins]
        .filter(([, p]) => p.enabled || p.requested)
        .map(([key]) => key);
      const restore = async () => {
        if (before.includes(id))
          await this.#change(id, true, { defer: !active.has(id) });
        for (const key of before)
          await this.#enableTree(key, { forceRoot: active.has(key) });
      };
      await this.#change(id, false);
      this.#broker.removeOwner(id);
      this.#plugins.delete(id);
      try {
        this.register(definition, options);
        this.#plugins.get(id).blocked = old.blocked;
        await restore();
      } catch (error) {
        if (this.#plugins.has(id)) {
          try {
            await this.#change(id, false);
          } catch {}
          this.#broker.removeOwner(id);
          this.#plugins.delete(id);
        }
        this.register(
          {
            manifest: old.manifest,
            start: old.start,
            fingerprint: old.fingerprint,
          },
          {
            grantedCapabilities: [...old.capabilities],
            allowLocalApis: old.allowLocalApis,
          },
        );
        this.#plugins.get(id).blocked = old.blocked;
        try {
          await restore();
        } catch (rollback) {
          throw new Error(String(error) + "，旧插件恢复失败：" + rollback);
        }
        throw error;
      }
    });
    this.#tail = task.catch(() => {});
    return task;
  }
  async #change(id, enabled, { defer = false } = {}) {
    if (!this.#plugins.has(id)) throw new Error(`未知插件：${id}`);
    if (!enabled) {
      const impact = this.impact(id),
        errors = [];
      const order = this.#stopOrder([...impact.stop, ...impact.restart]);
      for (const key of impact.stop) this.#plugins.get(key).requested = false;
      for (const key of order) {
        try {
          await this.#stop(key);
        } catch (error) {
          errors.push(error.message);
        }
      }
      for (const key of [...order]
        .reverse()
        .filter((key) => impact.restart.includes(key))) {
        try {
          await this.#enableTree(key);
        } catch (error) {
          errors.push(error.message);
        }
      }
      if (errors.length) throw new Error(errors.join("; "));
      return impact;
    }
    await this.#enableTree(id, { forceRoot: !defer });
    // 新提供者出现时重启已运行的可选消费者，使它们重新获取可用能力。
    for (const [key, p] of this.#plugins)
      if (
        key !== id &&
        p.enabled &&
        Object.entries(p.manifest.optionalApis || {}).some(
          ([api, range]) =>
            !p.bindings.has(api) &&
            this.#broker.resolve(api, range)?.owner === id,
        )
      ) {
        const impact = this.impact(key),
          order = this.#stopOrder([...impact.stop, ...impact.restart]),
          errors = [];
        for (const affected of order)
          try {
            await this.#stop(affected);
          } catch (error) {
            errors.push(error.message);
          }
        for (const affected of [...order].reverse())
          try {
            await this.#enableTree(affected);
          } catch (error) {
            errors.push(error.message);
          }
        if (errors.length) throw Error(errors.join("; "));
      }
    return { stop: [], restart: [] };
  }
  #activateApi(id, inline) {
    const p = this.#plugins.get(id);
    if (this.#closed || !p || p.blocked || (!p.enabled && !p.requested))
      return Promise.reject(
        Error("插件已由用户停用，自动调用不能重新启用：" + id),
      );
    if (p.enabled) return Promise.resolve();
    const known = this.#activations.get(id);
    if (known) {
      // 后续激活入口可能正占用队列，提早执行同一任务，不能等待排在自身之后的任务。
      if (inline) known.start();
      return known.promise;
    }
    const activate = async () => {
      if (this.#closed || this.#plugins.get(id) !== p || p.blocked)
        throw Error("插件激活请求已失效：" + id);
      await this.#enableTree(id, { automatic: true, forceRoot: true });
      if (p.blocked || this.#closed) throw Error("插件已停用：" + id);
    };
    // 激活入口内调用下游 API 时在当前任务中完成，避免等待自身所在队列。
    let started = false,
      resolve,
      reject;
    const result = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const entry = {
      promise: null,
      start: () => {
        if (!started) {
          started = true;
          Promise.resolve().then(activate).then(resolve, reject);
        }
        return result;
      },
    };
    entry.promise = result.finally(() => {
      if (this.#activations.get(id) === entry) this.#activations.delete(id);
    });
    this.#activations.set(id, entry);
    if (inline) entry.start();
    else this.#tail = this.#tail.then(entry.start).catch(() => {});
    return entry.promise;
  }
  async #enableTree(id, { automatic = false, forceRoot = true } = {}) {
    const order = [],
      visiting = new Set(),
      visited = new Set(),
      deferred = [];
    const visit = (key, force = false) => {
      const p = this.#plugins.get(key);
      if (!p) throw new Error(`未知依赖插件：${key}`);
      if (this.#closed || (automatic && p.blocked))
        throw Error("自动激活不能启用已停用插件：" + key);
      if (!automatic) p.blocked = false;
      if (p.enabled || visited.has(key)) return;
      if (p.deferred && !force) {
        if (!p.requested) deferred.push(p);
        p.requested = true;
        return;
      }
      if (visiting.has(key))
        throw new Error(`插件 API 依赖循环：${[...visiting, key].join(" → ")}`);
      visiting.add(key);
      for (const [api, range] of Object.entries(p.manifest.requiredApis)) {
        const definition = this.#broker.resolve(api, range);
        if (!definition) throw new Error(`缺少兼容 API：${api} ${range}`);
        this.#checkLayer(p.manifest, definition);
        if (definition.owner !== "$host") visit(definition.owner);
      }
      visiting.delete(key);
      visited.add(key);
      order.push(key);
    };
    const started = [];
    try {
      visit(id, forceRoot);
      for (const key of order) {
        await this.#start(key);
        started.push(key);
      }
    } catch (error) {
      for (const key of started.reverse()) {
        // 并发的按需分支可能已经使用同一提供者，失败分支不能撤销另一分支的有效句柄。
        const shared = [...this.#plugins].some(
          ([consumer, p]) =>
            consumer !== key &&
            (p.enabled || this.#starting.has(consumer)) &&
            [...p.bindings.values()].includes(key),
        );
        if (shared) continue;
        try {
          await this.#stop(key);
        } catch {}
      }
      for (const p of deferred) if (!p.enabled) p.requested = false;
      this.#plugins.get(id).error = String(error);
      throw error;
    }
  }
  #start(id) {
    if (this.#starting.has(id)) return this.#starting.get(id);
    const task = Promise.resolve()
      .then(() => this.#startOnce(id))
      .finally(() => {
        if (this.#starting.get(id) === task) this.#starting.delete(id);
      });
    this.#starting.set(id, task);
    return task;
  }
  async #startOnce(id) {
    const p = this.#plugins.get(id);
    if (p.enabled) return;
    let live = true,
      accepting = true,
      starting = true;
    p.generation = ++this.#generation;
    const cleanup = [],
      granted = new Map();
    const own = (fn) => {
      if (!live || !accepting || typeof fn !== "function")
        throw Error("无效清理回调或插件正在停用");
      cleanup.push(fn);
      // 资源提前释放后可撤销兜底登记，避免长期运行的提供者积累失效句柄。
      return () => {
        const index = cleanup.indexOf(fn);
        if (index >= 0) cleanup.splice(index, 1);
      };
    };
    p.bindings.clear();
    // 内部执行端口只交付 L1 接入适配器，SDK 入口形状由上层负责。
    const port = Object.freeze({
      owner: id,
      resolve: (api) => {
        if (!live || !granted.has(api))
          throw new Error(`未声明、不可用或已撤销的 API：${api}`);
        return granted.get(api);
      },
      has: (api) => live && granted.has(api),
      publish: (api, value) => {
        if (!live || !accepting) throw new Error("插件已停用");
        this.#broker.publish(id, api, value);
      },
      own,
    });
    try {
      for (const [api, range] of Object.entries({
        ...p.manifest.optionalApis,
        ...p.manifest.requiredApis,
      })) {
        const definition = this.#broker.resolve(api, range);
        if (
          !definition ||
          (!p.manifest.requiredApis[api] &&
            definition.owner !== "$host" &&
            !this.#plugins.get(definition.owner)?.enabled &&
            !this.#plugins.get(definition.owner)?.requested)
        )
          continue;
        this.#checkLayer(p.manifest, definition);
        const metadata = {
          version: p.manifest.version,
          fingerprint: p.fingerprint,
          generation: p.generation,
        };
        const provider = this.#plugins.get(definition.owner);
        granted.set(
          api,
          provider?.deferred && !provider.enabled
            ? this.#broker.deferred(
                definition,
                id,
                p.capabilities,
                () => live,
                own,
                metadata,
                () => this.#activateApi(definition.owner, starting),
              )
            : this.#broker.handle(
                definition,
                id,
                p.capabilities,
                () => live,
                own,
                metadata,
              ),
        );
        p.bindings.set(api, definition.owner);
      }
      await p.start(port);
      starting = false;
      if (p.blocked || this.#closed) throw Error("插件激活期间已停用：" + id);
      for (const api of Object.keys(p.manifest.providesApis || {}))
        if (!this.#broker.values.has(id + ":" + api))
          throw new Error(`激活未提供清单声明的 API：${api}`);
      cleanup.unshift(() => {
        live = false;
        granted.clear();
        this.#broker.unpublish(id);
      });
      // 保留同一所有权列表：按钮点击等激活后的贡献也必须进入停用清理。
      p.cleanup = cleanup;
      p.stopAccepting = () => {
        accepting = false;
      };
      p.enabled = true;
      p.requested = p.deferred;
      p.error = null;
    } catch (error) {
      starting = false;
      accepting = false;
      for (const fn of cleanup.splice(0).reverse()) {
        try {
          await fn();
        } catch {}
      }
      live = false;
      this.#broker.unpublish(id);
      p.bindings.clear();
      p.error = String(error);
      throw error;
    }
  }
  async #stop(id) {
    const p = this.#plugins.get(id);
    if (!p?.enabled) return;
    p.enabled = false;
    p.stopAccepting?.();
    // 先撤销该提供者的公开 API，异步清理期间不能再接收业务调用或返回旧结果。
    // 插件清理仍可使用其消费的下游 API，直到清理完成。
    this.#broker.unpublish(id);
    const errors = [];
    for (const fn of p.cleanup.splice(0).reverse()) {
      try {
        await fn();
      } catch (error) {
        errors.push(String(error));
      }
    }
    p.bindings.clear();
    if (errors.length) {
      p.error = errors.join("; ");
      throw new Error(p.error);
    }
  }
  /** 关闭全部插件，即便某个清理回调失败也继续回收其他插件。 */
  async dispose() {
    this.#closed = true;
    const task = this.#tail.then(async () => {
      const errors = [];
      for (const p of this.#plugins.values()) p.requested = false;
      for (const id of this.#stopOrder([...this.#plugins.keys()]))
        try {
          await this.#stop(id);
        } catch (error) {
          errors.push(error.message);
        }
      if (errors.length) throw Error(errors.join("; "));
    });
    this.#tail = task.catch(() => {});
    return task;
  }
}

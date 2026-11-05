import { ContributionRegistry } from "../kernel/index.mjs";
import { PluginRuntime } from "../plugin-runtime/index.mjs";
import {
  readUiTree,
  readPanelPlacement,
  extensionUiContract,
} from "../plugin-sdk/extension-ui.mjs";
import { copyJson } from "../plugin-sdk/schema.mjs";
import { checkPluginSet } from "./index.mjs";
import { createStressSchedule } from "./schedule.mjs";
import { extensionPlatformContract } from '../plugin-sdk/extension-platform.mjs';

/** 测试替身仅提供内存数据，不代表真实文档编辑、DOM 或 GPU 渲染验收。 */
function fixtureApis(host, registry, snapshot) {
  // 仅内存替身：明确拒绝真实联网/进程，不能将 smoke 当作原生能力验收。
  host.provide('platform.extension','1.0.0',(_owner,own)=>{
    const data=new Map();own(()=>data.clear());return {
      readText:name=>data.get(name)||null,writeText:(name,text)=>{data.set(name,text);return null;},
      fetchText:()=>{throw Error('测试替身不执行真实联网');},runTask:()=>{throw Error('测试替身不执行真实后台任务');},
    };
  },true,extensionPlatformContract);
  const panels = new Map(),
    writes = [];
  host.provide(
    "workflow.nodes",
    "1.0.0",
    { list: () => registry.list(), get: (id) => registry.get(id) },
    false,
    {
      methods: {
        list: { capability: "nodes.read" },
        get: { capability: "nodes.read" },
      },
    },
  );
  host.provide(
    "workflow.editor",
    "1.0.0",
    {
      snapshot: () => copyJson(snapshot),
      execute: (request) => {
        writes.push(copyJson(request));
        return { ok: true };
      },
    },
    false,
    {
      methods: {
        snapshot: { capability: "workflow.read" },
        execute: { capability: "workflow.write" },
      },
    },
  );
  host.provide(
    "studio.extension-ui",
    "1.0.0",
    (owner, own) => {
      const entries = new Map();
      own(() => {
        for (const id of entries.keys()) panels.delete(id);
        entries.clear();
      });
      return {
        inspect({ owner: requestedOwner }) {
          return { panels: [...panels].filter(([, p]) => p.owner === requestedOwner).map(([id, p]) => {
            const controls = [], visit = (node) => { controls.push({ id: node.id, type: node.type }); node.children?.forEach(visit); };
            visit(p.tree);
            return { id, owner: p.owner, title: p.title, placement: p.placement, revision: p.revision, controls };
          }) };
        },
        create(p) {
          if (
            typeof p.id !== "string" ||
            !p.id.startsWith(owner + ".") ||
            panels.has(p.id) ||
            entries.size >= 8
          )
            throw Error("面板 ID/配额无效");
          const model = {
            owner,
            title: p.title,
            ...readPanelPlacement(p),
            tree: readUiTree(p.tree),
            revision: 1,
          };
          entries.set(p.id, model);
          panels.set(p.id, model);
          return { id: p.id, revision: 1 };
        },
        update({ id, tree }) {
          const model = entries.get(id);
          if (!model) throw Error("面板不属于消费者");
          model.tree = readUiTree(tree);
          return { id, revision: ++model.revision };
        },
        remove({ id }) {
          const removed = entries.delete(id);
          if (removed) panels.delete(id);
          return { removed };
        },
        events() {
          return { cursor: 0, events: [], truncated: false };
        },
      };
    },
    true,
    extensionUiContract,
  );
  return { panels, writes };
}
/** 用真实 PluginHost 与注入的 Electron 沙箱执行器检验脚本，不会在 Node 中 import 用户入口。 */
export async function runSandboxSuite(
  bundles,
  {
    createRunner,
    seed = 1,
    cycles = 3,
    restartPasses = 1,
    settleMs = 100,
    probes = [],
    snapshot,
    measure = () => ({}),
  } = {},
) {
  if (
    !Number.isInteger(cycles) ||
    cycles < 1 ||
    cycles > 10 ||
    !Number.isInteger(settleMs) ||
    settleMs < 0 ||
    settleMs > 2000 ||
    !Array.isArray(probes) ||
    probes.length > 64 ||
    bundles.length > 16
  )
    throw Error("测试预算：1–10 轮、0–2000ms 观察、最多 16 插件和 64 探针");
  if (bundles.some((b) => b.manifest.kind === "declarative"))
    throw Error("无脚本插件请用 check，动作与真实界面由 Studio 验收");
  await checkPluginSet(bundles);
  const schedule = createStressSchedule(
    bundles.map((b) => b.manifest.id),
    { seed, cycles, restartPasses },
  );
  const rounds = [],
    report = {
      ok: true,
      mode: "electron-sandbox",
      schedule,
      rounds,
      limits:
        "Windows renderer 在激活前配置 512 MiB 提交内存 / 系统 CPU 10% OS Job 硬上限，工作集采样仅供诊断，GPU 进程/显存不在此配额内",
      fixtures:
        "内存 UI/工作流替身，不含实际编辑器、渲染、用户事件或业务正确性验收",
    };
  try {
    for (let round = 0; round < cycles; round++) {
      const host = new PluginRuntime(),
        registry = new ContributionRegistry(),
        runners = new Map(),
        faults = [],
        values = new Map();
      const fixture = fixtureApis(
        host,
        registry,
        snapshot ?? {
          project: { id: "testkit" },
          documentToken: "testkit",
          stage: "fragment",
          graph: { revision: 0, nodes: [], links: [] },
          document: { revision: 0 },
          selection: [],
        },
      );
      const plan = schedule.rounds[round],
        order = plan.registration.map((id) =>
          bundles.find((b) => b.manifest.id === id),
        ),
        result = {
          order: plan.registration,
          enableOrder: plan.enable,
          trace: [],
          activations: [],
          checkpoints: [],
        };
      rounds.push(result);
      const step = (action, pluginId) =>
        result.trace.push({ action, ...(pluginId ? { pluginId } : {}) });
      const resources = () => ({
        runners: runners.size,
        nodes: registry.list().length,
        panels: fixture.panels.size,
        writes: fixture.writes.length,
      });
      const checkpoint = (phase, pluginId) => {
        const enabled = host
          .list()
          .filter((p) => p.enabled)
          .map((p) => p.id)
          .sort();
        result.checkpoints.push({
          phase,
          pluginId,
          enabled,
          resources: resources(),
          measured: measure(),
        });
        if (
          JSON.stringify(enabled) !==
            JSON.stringify([...runners.keys()].sort()) ||
          registry.list().some((n) => !enabled.includes(n.owner)) ||
          [...fixture.panels.values()].some((p) => !enabled.includes(p.owner))
        )
          throw Error("资源所有者与内核启用状态不一致");
      };
      const observe = async () => {
        await new Promise((resolve) => setTimeout(resolve, settleMs));
        for (const runner of runners.values()) await runner.request("ping", {});
        if (faults.length) throw Error(JSON.stringify(faults));
      };
      try {
        for (const bundle of order)
          host.register({
            manifest: bundle.manifest,
            async activate(context) {
              const id = bundle.manifest.id,
                apis = new Map();
              result.activations.push(id);
              const runner = await createRunner(bundle, {
                availableApis: Object.keys({
                  ...bundle.manifest.optionalApis,
                  ...bundle.manifest.requiredApis,
                }).filter((id) => context.hasApi(id)),
                onFault: (error) => faults.push({ id, error }),
                onApiCall: async (request) => {
                  if (!apis.has(request.api))
                    apis.set(request.api, context.api(request.api));
                  return await apis
                    .get(request.api)
                    [request.method](...request.args);
                },
              });
              runners.set(id, runner);
              context.onDispose(async () => {
                try {
                  await runner.dispose();
                } finally {
                  runners.delete(id);
                  // 已停用代次的编译缓存不跨越重启复用。
                  for (const key of values.keys())
                    if (JSON.parse(key)[0] === id) values.delete(key);
                }
              });
              for (const [api, spec] of Object.entries(
                bundle.manifest.providesApis || {},
              ))
                context.provide(
                  api,
                  Object.fromEntries(
                    Object.keys(spec.methods).map((method) => [
                      method,
                      (...args) =>
                        runner.request("invoke", { api, method, args }),
                    ]),
                  ),
                );
              const contribution = runner.contribution;
              if (contribution.nodes.length || contribution.compilers.length) {
                if (
                  !bundle.manifest.capabilities.includes("nodes.register") ||
                  !context.hasApi("workflow.nodes")
                )
                  throw Error("未授权节点贡献");
                const handle = registry.register(id, bundle.manifest.version, {
                  nodes: contribution.nodes,
                  compilers: contribution.compilers.map((rule) => ({
                    ...rule,
                    compile: (input) => {
                      const key = JSON.stringify([
                        id,
                        rule.typeId,
                        rule.target,
                        input,
                      ]);
                      if (!values.has(key))
                        throw Error("请先执行此节点的 compile 探针");
                      return values.get(key);
                    },
                  })),
                });
                context.onDispose(() => handle.dispose());
              }
            },
          });
        for (const id of plan.enable) {
          step("enable", id);
          await host.setEnabled(id, true);
        }
        const runProbes = async () => {
          for (const probe of probes) {
            if (probe.kind !== "compile") throw Error("当前探针仅支持 compile");
            const runner = runners.get(probe.pluginId);
            if (!runner || registry.owner(probe.typeId)?.id !== probe.pluginId)
              throw Error("探针插件/节点不存在或所有者不匹配");
            const context = copyJson(probe.context),
              value = await runner.request("compile", {
                typeId: probe.typeId,
                target: probe.target,
                context,
              });
            values.set(
              JSON.stringify([
                probe.pluginId,
                probe.typeId,
                probe.target,
                context,
              ]),
              value,
            );
            registry.compile(probe.typeId, probe.target, context);
            if (
              Object.hasOwn(probe, "expected") &&
              JSON.stringify(value) !== JSON.stringify(probe.expected)
            )
              throw Error("编译探针结果不符：" + probe.typeId);
          }
        };
        step("initial-probes");
        await runProbes();
        await observe();
        checkpoint("initial");
        result.activeResources = resources();
        for (const restart of plan.restarts) {
          step("disable", restart.pluginId);
          await host.setEnabled(restart.pluginId, false);
          await observe();
          checkpoint("disabled", restart.pluginId);
          for (const id of restart.restore) {
            step("restore", id);
            await host.setEnabled(id, true);
          }
          await observe();
          checkpoint("restored", restart.pluginId);
        }
        step("final-probes");
        await runProbes();
        result.compileProbes = probes.length * 2;
      } catch (error) {
        result.failure = {
          action: result.trace.at(-1),
          error: String(error.message || error),
        };
        throw error;
      } finally {
        step("dispose");
        try {
          await host.dispose();
        } finally {
          for (const runner of runners.values()) runner.destroy();
          const { writes, ...remaining } = resources();
          result.remaining = remaining;
          result.measurementAfterDispose = measure();
        }
      }
      if (runners.size || registry.list().length || fixture.panels.size)
        throw Error("停用后存在测试宿主资源残留");
    }
    return report;
  } catch (error) {
    report.ok = false;
    report.error = String(error.stack || error);
    error.testReport = report;
    throw error;
  }
}

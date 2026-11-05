import { createPluginControl } from "./plugin-control.mjs";
import { createLocalTransport } from "./local-transport.mjs";
import { mcpConnectionPlugin } from "../../plugins/mcp-connection/index";
import { pluginServicePlugin } from "../../plugins/plugin-service/index.mjs";
import { createWorkspacePorts } from "./workspace-ports.mjs";
import { workspacePlugin } from "../../plugins/workspace/index.mjs";
import { interactionPlugin } from "../../plugins/interaction/index.mjs";
import { workflowServicePlugin } from "../../plugins/workflow-service/index.mjs";
import { nodeModelPlugin } from "../../plugins/node-model/index.mjs";
import { shortcutsPlugin } from "../../plugins/shortcuts/index";
import { createPluginSettings } from "./plugin-settings.mjs";
import { extensionUiPlugin } from "../../plugins/extension-ui/index";
import { declarationsPlugin } from "../../plugins/declarations/index.mjs";
import { persistentStorage } from "../project/persistent-storage.js";
import { noisePlugin } from "../../plugins/noise/index.mjs";
import { mathPlugin } from "../../plugins/math/index.mjs";
import { sdfPlugin } from "../../plugins/sdf/index.mjs";
import { starsectorPlugin } from "../../plugins/starsector/index.mjs";
import { compilerPlugin } from "../../plugins/compiler/index.mjs";
import { glslPlugin } from "../../plugins/glsl-backend/index.mjs";
import { previewPlugin } from "../../plugins/preview/index";
import { workflowUiPlugin } from "../../plugins/workflow-ui/index";
import { geometryUiPlugin } from "../../plugins/geometry-ui/index";
import { projectUiPlugin } from "../../plugins/project-ui/index";
import { projectFilesPlugin } from "../../plugins/project-files/index.mjs";
import { templatesPlugin } from "../../plugins/templates/index.mjs";
import { autoLayoutPlugin } from "../../plugins/layout/index.mjs";
import { layoutPlugin } from "../../plugins/example-layout/index.mjs";
import { showcasePlugin } from "../../plugins/example-showcase/index";
import { pluginManagerPlugin } from "../../plugins/plugin-manager/index";
import { mcpBrowserPlugin } from "../../plugins/mcp/browser-plugin";
import { PluginRuntime } from "../../packages/plugin-runtime/index.mjs";
import { uiPlugin } from "../../plugins/ui/index";
import { mountUiSurface } from "../../packages/ui-kit/surface";
import { installUiRecovery, uiRecovery } from "./ui-recovery";
import type { BrowserApi } from "../../packages/plugin-sdk/types";

/** 组合根：只装配公共能力和内置定义，插件设置面板由插件通过 studio.ui 挂载。 */
export async function startStudioPlugins() {
  const host = new PluginRuntime({ enforceLayers: true }),
    localPreferences = persistentStorage(),
    ports = createWorkspacePorts();
  const invalidate = ports.invalidateNodes;
  host.provide(
    "platform.node-registry",
    "1.0.0",
    (owner: string) => {
      if (owner !== "studio.node-model")
        throw Error("节点登记端口只供节点能力持有");
      return ports.nodeRegistry;
    },
    true,
    {
      methods: {
        preferences: { capability: "nodes.host" },
        contributions: { capability: "nodes.host" },
      },
    },
  );
  host.provide(
    "platform.workflow-file-picker",
    "1.0.0",
    (owner: string) => ({
      async fromFile(file: File) {
        if (owner !== "studio.project-files")
          throw Error("文件选择端口仅供工作流存储能力使用");
        const bridge = (window as any).workflowDesktop?.projects;
        if (!bridge)
          throw Error("关联磁盘文件需要桌面版，浏览器可使用导入工作流");
        const result = await bridge.fromFile(file);
        if (!result.ok) throw Error(result.error);
        return result.value;
      },
    }),
    true,
    { methods: { fromFile: { capability: "project.file-picker" } } },
  );
  host.provide(
    "platform.export-storage",
    "1.0.0",
    (owner: string) => {
      if (owner !== "studio.starsector")
        throw Error("导出记录只供导出插件持有");
      return {
        getItem: (key: string) => localPreferences.getItem(key),
        setItem: (key: string, value: string) =>
          localPreferences.setItem(key, value),
      };
    },
    true,
    {
      methods: {
        getItem: { capability: "export.storage" },
        setItem: { capability: "export.storage" },
      },
    },
  );
  host.provide("platform.downloads", "1.0.0", ports.downloads, false, {
    methods: {
      zip: { capability: "downloads.write" },
      text: { capability: "downloads.write" },
      blob: { capability: "downloads.write" },
    },
  });
  host.provide(
    "platform.workspace-state",
    "1.0.0",
    (owner: string) => {
      if (owner !== "studio.workflow-service")
        throw Error("状态端口只供工作流能力持有");
      return ports.state;
    },
    true,
    {
      methods: Object.fromEntries(
        Object.keys(ports.state).map((name) => [
          name,
          { capability: "workflow.host" },
        ]),
      ),
    },
  );
  host.provide(
    "platform.workspace-execution",
    "1.0.0",
    (owner: string) => {
      if (owner !== "studio.workspace")
        throw Error("执行端口只供工作区能力持有");
      return ports.execution;
    },
    true,
    {
      methods: Object.fromEntries(
        Object.keys(ports.execution).map((name) => [
          name,
          { capability: "workspace.host" },
        ]),
      ),
    },
  );
  host.provide(
    "workflow.template-storage",
    "1.0.0",
    (owner: string) => ({
      read() {
        if (owner !== "studio.templates") throw Error("未授权模板存储");
        return JSON.parse(
          localPreferences.getItem("workflow.subgraphNodes") || "[]",
        );
      },
      write(value: unknown) {
        if (owner !== "studio.templates") throw Error("未授权模板存储");
        localPreferences.setItem(
          "workflow.subgraphNodes",
          JSON.stringify(value),
        );
      },
    }),
    true,
    {
      methods: {
        read: { capability: "templates.storage" },
        write: { capability: "templates.storage" },
      },
    },
  );
  const port =
    Number(new URLSearchParams(location.search).get("bridgePort")) ||
    Number(localPreferences.getItem("workflow.bridgePort")) ||
    4174;
  const baseUrl = `http://127.0.0.1:${port}`;
  host.provide(
    "platform.ui-shell",
    "1.0.0",
    (_owner: string, own: (fn: () => void) => void) => ({
      mount(surface: unknown) {
        own(mountUiSurface(surface));
      },
    }),
    true,
    { methods: { mount: { capability: "ui.shell.mount" } } },
  );
  host.provide("workflow.operations", "1.0.0", ports.operationApi, true, {
    methods: {
      register: { capability: "operations.register" },
      execute: { capability: "operations.execute" },
      list: { capability: "operations.read" },
      subscribe: { capability: "operations.read" },
    },
  });
  host.provide(
    "platform.assets",
    "1.0.0",
    (owner: string) => ({
      /** 只读取当前内置插件声明的资源，不接受任意 URL 或磁盘路径。 */
      async readText(name: string) {
        if (owner !== "studio.starsector" || name !== "runtime")
          throw Error("插件未声明该资源");
        const response = await fetch(
          "/assets/starsector/WorkflowRuntime.java",
          { signal: AbortSignal.timeout(5000) },
        );
        if (!response.ok)
          throw Error("缺少 Starsector 运行依赖模板，请使用完整桌面包");
        return response.text();
      },
    }),
    true,
    { methods: { readText: { capability: "assets.read" } } },
  );
  const desktop = (
    window as unknown as {
      workflowDesktop?: BrowserApi["desktop"] & { plugins?: unknown };
    }
  ).workflowDesktop;
  host.provide(
    "platform.project-files",
    "1.0.0",
    (owner: string, own: (fn: () => void) => void) => {
      if (owner !== "studio.project-files")
        throw Error("工作流文件端口仅由存储插件持有");
      const port = (window as any).workflowDesktop?.projects;
      return {
        available: !!port,
        ...Object.fromEntries(
          [
            "chooseOpen",
            "chooseSave",
            "list",
            "read",
            "write",
            "backup",
            "recoveries",
            "recover",
          ].map((name) => [
            name,
            (input: unknown) => {
              if (!port) throw Error("工作流文件需要桌面版");
              return port.call(name, input).then((r: any) => {
                if (!r.ok)
                  throw Object.assign(new Error(r.error), {
                    code: r.code,
                    version: r.version,
                  });
                return r.value;
              });
            },
          ]),
        ),
        checkpoint: (input: unknown) => port?.checkpoint(input),
        onClose: (fn: () => void) => {
          window.addEventListener("beforeunload", fn);
          const off = () => window.removeEventListener("beforeunload", fn);
          own(off);
          return off;
        },
      };
    },
    true,
    {
      methods: Object.fromEntries(
        [
          "chooseOpen",
          "chooseSave",
          "list",
          "read",
          "write",
          "backup",
          "recoveries",
          "recover",
          "checkpoint",
          "onClose",
        ].map((name) => [name, { capability: "project.storage" }]),
      ),
    },
  );
  // L1 原生端口：调用者身份来自内核作用域，插件不能传入其他插件 ID 或窗口 ID。
  host.provide(
    "platform.extension-transport",
    "1.0.0",
    (owner: string) => {
      if (owner !== "studio.plugin-service")
        throw Error("扩展传输只供受控扩展能力持有");
      return {
        call: (consumer: string, method: string, args: unknown[]) => {
          const platform = desktop?.plugins as any;
          if (!platform) throw Error("原生扩展能力需要桌面版");
          return platform.call("capability", { id: consumer, method, args });
        },
      };
    },
    true,
    { methods: { call: { capability: "plugins.host" } } },
  );
  host.provide(
    "platform.browser",
    "1.0.0",
    (owner: string): BrowserApi => ({
      baseUrl,
      settings: createPluginSettings(localPreferences, owner),
      fetch: createLocalTransport({ owner, baseUrl, desktop }),
      preferences: {
        get: (key) => sessionStorage.getItem(`plugin.${owner}.${key}`),
        set: (key, value) =>
          sessionStorage.setItem(`plugin.${owner}.${key}`, value),
      },
      desktop:
        desktop && owner === "studio.mcp-connection"
          ? {
              getMcpConfig: desktop.getMcpConfig,
              testMcp: desktop.testMcp,
              revokeMcp: desktop.revokeMcp,
              mcpStatus: desktop.mcpStatus,
              copyText: desktop.copyText,
            }
          : undefined,
    }),
    true,
    { methods: { fetch: { capability: "platform.network" } } },
  );
  const builtins = [
    nodeModelPlugin,
    workflowServicePlugin,
    workspacePlugin,
    mcpConnectionPlugin,
    pluginServicePlugin,
    pluginManagerPlugin,
    uiPlugin,
    shortcutsPlugin,
    extensionUiPlugin,
    declarationsPlugin,
    interactionPlugin,
    mcpBrowserPlugin,
    workflowUiPlugin,
    geometryUiPlugin,
    projectFilesPlugin,
    projectUiPlugin,
    noisePlugin,
    mathPlugin,
    sdfPlugin,
    glslPlugin,
    compilerPlugin,
    previewPlugin,
    templatesPlugin,
    autoLayoutPlugin,
    starsectorPlugin,
    layoutPlugin,
    showcasePlugin,
  ];
  for (const plugin of builtins)
    host.register(plugin, {
      allowLocalApis:
        plugin === mcpConnectionPlugin ||
        plugin === pluginServicePlugin ||
        plugin === workflowServicePlugin ||
        plugin === nodeModelPlugin ||
        plugin === workspacePlugin ||
        plugin === starsectorPlugin ||
        plugin === projectFilesPlugin ||
        plugin === previewPlugin ||
        plugin === uiPlugin ||
        plugin === shortcutsPlugin ||
        plugin === interactionPlugin ||
        plugin === declarationsPlugin,
    });
  const builtinIds = new Set(
    builtins
      .filter((p) => p.manifest.id !== "studio.plugin-manager")
      .map((p) => p.manifest.id),
  );
  let startAdministration: (() => Promise<void>) | undefined;
  host.provide(
    "platform.plugin-host",
    "1.0.0",
    (owner: string) => {
      if (owner !== "studio.plugin-service")
        throw Error("管理端口只供插件管理能力持有");
      const platform = desktop?.plugins as any;
      const control = createPluginControl(host, platform);
      return {
        options: () => ({
          host: control,
          platform,
          invalidate,
          builtinIds: [...builtinIds],
          storage: {
            getItem: (k: string) => localPreferences.getItem(k),
            setItem: (k: string, v: string) => localPreferences.setItem(k, v),
          },
        }),
        ready: (fn: () => Promise<void>) => {
          startAdministration = fn;
        },
        pending: (value: boolean) => {
          uiRecovery.pending = value;
        },
        recovery: (fn: () => Promise<void>) => installUiRecovery(fn),
        recoveryBusy: () => uiRecovery.busy,
      };
    },
    true,
    {
      methods: Object.fromEntries(
        ["options", "ready", "pending", "recovery", "recoveryBusy"].map(
          (name) => [name, { capability: "plugins.host" }],
        ),
      ),
    },
  );
  await host.setEnabled(pluginManagerPlugin.manifest.id, true);
  await startAdministration?.();
  window.addEventListener(
    "pagehide",
    () => {
      void host.dispose();
    },
    { once: true },
  );
}

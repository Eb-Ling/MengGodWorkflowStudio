import { extensionPlatformMethods } from "../../packages/plugin-sdk/extension-platform.mjs";
import { pluginServiceManifest } from "./manifest.mjs";
import { createAdministration } from "./coordination.mjs";
export const pluginServicePlugin = {
  manifest: pluginServiceManifest,
  activate(context) {
    context.provide("platform.extension", (owner, own) => {
      let live = true,
        pending = 0;
      own(() => {
        live = false;
      });
      return Object.fromEntries(
        Object.keys(extensionPlatformMethods).map((method) => [
          method,
          async (...args) => {
            if (!live) throw Error("扩展能力已撤销");
            if (pending >= 32) throw Error("扩展请求队列已满");
            pending++;
            try {
              const result = await context
                .api("platform.extension-transport")
                .call(owner, method, args);
              if (!live) throw Error("扩展结果已过期");
              return result;
            } finally {
              pending--;
            }
          },
        ]),
      );
    });
    const port = context.api("platform.plugin-host"),
      browser = context.api("platform.browser"),
      options = port.options();
    const management = createAdministration({
      ...options,
      builtinIds: new Set(options.builtinIds),
      browser,
      ports: port,
    });
    context.onDispose(() => management.dispose());
    port.ready(() => management.start());
    context.provide("studio.plugins", (owner, own) => ({
      ...management.scoped(owner, own),
      async downloadKit() {
        const response = await browser.fetch(
          new URL(
            "/assets/developer/workflow-plugin-devkit-1.0.0.zip",
            browser.baseUrl,
          ),
          { signal: AbortSignal.timeout(10000) },
        );
        if (!response.ok) throw Error("开发者测试包不可用，请检查安装包完整性");
        context
          .api("platform.downloads")
          .blob("workflow-plugin-devkit-1.0.0.zip", await response.blob());
      },
    }));
  },
};

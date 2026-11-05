import { reactive } from "vue";
import type { PluginContext, UiApi } from "../../packages/plugin-sdk/types";
import { extensionUiApi } from "../../packages/plugin-sdk/extension-ui.mjs";
import { extensionUiManifest } from "./manifest.mjs";
import { createExtensionUiService } from "./service.mjs";
import ExtensionPanel from "./ExtensionPanel.vue";
import ExtensionSettings from "./ExtensionSettings.vue";
export const extensionUiPlugin = {
  manifest: extensionUiManifest,
  activate(context: PluginContext) {
    const ui = context.api<UiApi>("studio.ui");
    const scope = ui.createScope(context.pluginId);
    const componentId = context.pluginId + ".settings";
    scope.register({
      id: componentId,
      version: "1.0.0",
      component: ExtensionSettings,
    });
    const service = createExtensionUiService((p: any) => {
      const props = { controls: ui.components, model: p.model, send: p.send };
      if (p.placement === "dock")
        return ui.addDock({
          id: p.id,
          title: p.title,
          side: p.side,
          component: ExtensionPanel,
          props,
        });
      // 每个消费者单独跟踪实例，移除贡献时立即释放，不能等待设置页下一次渲染。
      const instances = new Set<{ dispose(): void }>();
      let live = true;
      const panel = ui.addSettingsPanel({
        id: p.id,
        title: p.title,
        category: "settings",
        mount(target) {
          if (!live) throw Error("插件设置面板已移除");
          const instance = scope.create(componentId, target, {
            ...props,
            title: p.title,
            placement: p.placement,
          });
          const handle = {
            dispose() {
              instance.dispose();
              instances.delete(handle);
            },
          };
          instances.add(handle);
          return handle;
        },
      });
      return {
        dispose() {
          live = false;
          for (const instance of [...instances]) instance.dispose();
          panel.dispose();
        },
      };
    }, reactive);
    context.onDispose(() => service.dispose());
    context.provide(extensionUiApi, service.scoped);
  },
};

import type {
  PluginContext,
  UiApi,
  PluginManagementApi,
  BrowserApi,
} from "../../packages/plugin-sdk/types";
import { managerManifest } from "./manifest.mjs";
import PluginManagerPanel from "./PluginManagerPanel.vue";

/** 管理插件只创建界面、调用公共 API，不导入 PluginHost、文件系统或其他插件。 */
export const pluginManagerPlugin = {
  manifest: managerManifest,
  activate(context: PluginContext) {
    const ui = context.api<UiApi>("studio.ui"),
      api = context.api<PluginManagementApi>("studio.plugins");
    const scope = ui.createScope(context.pluginId);
    scope.register({
      id: context.pluginId + ".panel",
      version: "1.0.0",
      component: PluginManagerPanel,
    });
    for (const developer of [false, true])
      ui.addSettingsPanel({
        id: context.pluginId + (developer ? ".examples" : ".panel"),
        title: developer ? "开发者示例" : "插件管理",
        category: developer ? "developer" : "management",
        mount: (target) =>
          scope.create(context.pluginId + ".panel", target, {
            controls: ui.components,
            api,
            developer,
            downloadKit: () => (api as any).downloadKit(),
          }),
      });
  },
};

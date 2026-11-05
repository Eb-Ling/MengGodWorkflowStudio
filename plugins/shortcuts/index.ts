import type {
  PluginContext,
  UiApi,
  BrowserApi,
} from "../../packages/plugin-sdk/types";
import { shortcutsManifest } from "./manifest.mjs";
import { createShortcutRegistry } from "./registry.mjs";
import ShortcutSettings from "./ShortcutSettings.vue";
export const shortcutsPlugin = {
  manifest: shortcutsManifest,
  activate(context: PluginContext) {
    const ui = context.api<UiApi>("studio.ui"),
      service = createShortcutRegistry(
        context.api<BrowserApi>("platform.browser").settings,
      );
    context.onDispose(() => service.dispose());
    context.provide("studio.shortcuts", service.scoped);
    const scope = ui.createScope(context.pluginId),
      id = context.pluginId + ".settings";
    scope.register({ id, version: "1.0.0", component: ShortcutSettings });
    ui.addSettingsPanel({
      id,
      title: "快捷键",
      category: "settings",
      mount: (target) =>
        scope.create(id, target, { controls: ui.components, service }),
    });
  },
};

import type { PluginContext } from "../../packages/plugin-sdk/types";
import { uiManifest } from "./manifest.mjs";
import { createUiService } from "./service";
import ComponentWorkshop from "./ComponentWorkshop.vue";
export const uiPlugin = {
  manifest: uiManifest,
  activate(context: PluginContext) {
    const service = createUiService();
    context.onDispose(() => service.dispose());
    context.provide("studio.ui", service.scoped);
    const ui = service.scoped(context.pluginId, (fn) => context.onDispose(fn));
    ui.addOverlay({
      id: "studio.ui.workshop",
      component: ComponentWorkshop,
      props: { registry: service.registry, model: service.model },
    });
    context.api<any>("platform.ui-shell").mount(service.surface);
  },
};

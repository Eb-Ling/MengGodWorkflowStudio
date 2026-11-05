import { shallowRef } from "vue";
import type { PluginContext, UiApi } from "../../packages/plugin-sdk/types";
import { geometryUiManifest } from "./manifest.mjs";
import GeometryPanel from "./GeometryPanel.vue";
export const geometryUiPlugin = {
  manifest: geometryUiManifest,
  activate(context: PluginContext) {
    const ui = context.api<UiApi>("studio.ui"),
      workflow = context.api<any>("workflow.workspace"),
      snapshot = shallowRef(workflow.snapshot());
    context.onDispose(
      workflow.subscribe(() => (snapshot.value = workflow.snapshot())),
    );
    ui.addView({
      id: context.pluginId + ".panel",
      slot: "geometry",
      component: GeometryPanel,
      props: {
        ui,
        workflow,
        snapshot,
        presentation: context.api("workflow.presentation"),
        exporter: context.api("workflow.export"),
        preview: context.api("workflow.preview"),
      },
    });
  },
};

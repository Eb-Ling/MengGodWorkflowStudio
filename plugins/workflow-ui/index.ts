import CanvasTools from "./CanvasTools.vue";
import { graphShortcuts } from "./shortcuts.mjs";
import type { PluginContext, UiApi } from "../../packages/plugin-sdk/types";
import { workflowUiManifest } from "./manifest.mjs";
import { createViewSession } from "./session.mjs";
import NodeCard from "./NodeCard.vue";
import PortView from "./PortView.vue";
import InspectorField from "./InspectorField.vue";
import TimeValue from "./TimeValue.vue";
import GraphEditor from "./GraphEditor.vue";
import Inspector from "./Inspector.vue";
import NodeCatalog from "./NodeCatalog.vue";
import PreviewControls from "./PreviewControls.vue";
import WorkspaceControls from "./WorkspaceControls.vue";
export const workflowUiPlugin = {
  manifest: workflowUiManifest,
  activate(context: PluginContext) {
    const ui = context.api<UiApi>("studio.ui"),
      session = createViewSession({
        workflow: context.api("workflow.workspace"),
        preview: context.api("workflow.preview"),
        interaction: context.api("workflow.interaction"),
        shortcuts: context.api("studio.shortcuts"),
        ui,
        preferences: context.api<any>("workflow.workspace").preferences(),
      });
    context.onDispose(session.dispose);
    for (const [slot, variant] of [
      ["stage-tabs", "stages"],
      ["workspace-actions", "actions"],
    ] as const)
      ui.addView({
        id: context.pluginId + "." + slot,
        slot,
        component: WorkspaceControls,
        props: { session, variant },
      });
    session.shortcuts.register(graphShortcuts);
    ui.addDock({
      id: context.pluginId + ".tools",
      title: "画布策略",
      side: "right",
      defaultCollapsed: true,
      component: CanvasTools,
      props: { session },
    });
    for (const [kind, component] of Object.entries({
      node: NodeCard,
      port: PortView,
      field: InspectorField,
    }))
      ui.addRenderer({
        id: context.pluginId + "." + kind,
        kind: kind as "node" | "port" | "field",
        typeIds: ["*"],
        component,
      });
    ui.addRenderer({
      id: context.pluginId + ".time-value", kind: "field",
      typeIds: ["input.time.defaultValue"], component: TimeValue,
    });
    for (const [slot, component] of Object.entries({
      graph: GraphEditor,
      catalog: NodeCatalog,
      inspector: Inspector,
      "preview-controls": PreviewControls,
    }))
      ui.addView({
        id: context.pluginId + "." + slot,
        slot: slot as "graph" | "catalog" | "inspector" | "preview-controls",
        component,
        props: { session },
      });
  },
};

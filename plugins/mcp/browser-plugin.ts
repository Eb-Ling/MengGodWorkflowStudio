import type {
  PluginContext,
  WorkflowApi,
  UiApi,
  BrowserApi,
} from "../../packages/plugin-sdk/types";
import { manifest } from "./manifest.mjs";
import McpSettings from "./McpSettings.vue";

export const mcpBrowserPlugin = {
  manifest,
  activate(context: PluginContext) {
    const ui = context.api<UiApi>("studio.ui"),
      scope = ui.createScope(manifest.id);
    context.onDispose(() => scope.dispose());
    const { model, actions } = context
      .api<any>("studio.mcp-connection")
      .createSession();
    scope.register({
      id: "studio.mcp.settings",
      version: "1.0.0",
      component: McpSettings,
    });
    const panel = ui.addSettingsPanel({
      id: "studio.mcp.settings",
      title: manifest.name,
      mount: (target) =>
        scope.create("studio.mcp.settings", target, {
          controls: ui.components,
          model,
          actions,
        }),
    });
    context.onDispose(() => panel.dispose());
  },
};

import { mcpConnectionManifest } from "./manifest.mjs";
import { createMcpSession } from "./session";
import type { PluginContext } from "../../packages/plugin-sdk/types";
export const mcpConnectionPlugin = {
  manifest: mcpConnectionManifest,
  activate(context: PluginContext) {
    context.provide("studio.mcp-connection", (_owner: any, own: any) => ({
      createSession() {
        const session = createMcpSession({
          workflow: context.api("workflow.workspace"),
          preview: context.api("workflow.preview"),
          plugins: context.api("studio.plugins"),
          extensionUi: context.api("studio.extension-ui"),
          platform: context.api("platform.browser"),
        });
        own(() => session.dispose());
        return session;
      },
    }));
  },
};

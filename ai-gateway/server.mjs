import { mcpConnectionManifest } from "../plugins/mcp-connection/manifest.mjs";
import { pluginServiceManifest } from "../plugins/plugin-service/manifest.mjs";
import { workspaceManifest } from "../plugins/workspace/manifest.mjs";
import { declarationsManifest } from "../plugins/declarations/manifest.mjs";
import { workflowServiceManifest } from "../plugins/workflow-service/manifest.mjs";
import { nodeModelManifest } from "../plugins/node-model/manifest.mjs";
import { interactionManifest } from "../plugins/interaction/manifest.mjs";
import { shortcutsManifest } from "../plugins/shortcuts/manifest.mjs";
import { extensionUiManifest } from "../plugins/extension-ui/manifest.mjs";
import { uiManifest } from "../plugins/ui/manifest.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createStudioServer } from "../packages/native-host/index.mjs";
import { mcpServerPlugin } from "../plugins/mcp/server-plugin.mjs";
import { customNodesManifest } from "../plugins/custom-nodes/manifest.mjs";
import { noiseManifest } from "../plugins/noise/manifest.mjs";
import { mathManifest } from "../plugins/math/manifest.mjs";
import { sdfManifest } from "../plugins/sdf/manifest.mjs";
import { starsectorManifest } from "../plugins/starsector/manifest.mjs";
import { compilerManifest } from "../plugins/compiler/manifest.mjs";
import { glslManifest } from "../plugins/glsl-backend/manifest.mjs";
import { previewManifest } from "../plugins/preview/manifest.mjs";
import { workflowUiManifest } from "../plugins/workflow-ui/manifest.mjs";
import { geometryUiManifest } from "../plugins/geometry-ui/manifest.mjs";
import { projectUiManifest } from "../plugins/project-ui/manifest.mjs";
import { projectFilesManifest } from "../plugins/project-files/manifest.mjs";
import { templatesManifest } from "../plugins/templates/manifest.mjs";
import { autoLayoutManifest } from "../plugins/layout/manifest.mjs";
import { layoutManifest } from "../plugins/example-layout/manifest.mjs";
import { showcaseManifest } from "../plugins/example-showcase/manifest.mjs";
// 原生侧仅保存浏览器插件启停配置，实现与依赖解析由浏览器宿主负责。
const browserConfigurationPlugins = [
  nodeModelManifest,
  mcpConnectionManifest,
  pluginServiceManifest,
  workspaceManifest,
  workflowServiceManifest,
  shortcutsManifest,
  declarationsManifest,
  extensionUiManifest,
  interactionManifest,
  uiManifest,
  workflowUiManifest,
  geometryUiManifest,
  projectFilesManifest,
  projectUiManifest,
  mathManifest,
  sdfManifest,
  customNodesManifest,
  noiseManifest,
  glslManifest,
  compilerManifest,
  previewManifest,
  templatesManifest,
  autoLayoutManifest,
  starsectorManifest,
  layoutManifest,
  showcaseManifest,
].map(({ id, name, version, apiVersion, developmentOnly }) => ({
  enabledByDefault: !developmentOnly,
  manifest: { id, name, version, apiVersion, requiredApis: {} },
  activate() {},
}));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = path.join(
  root,
  existsSync(path.join(root, "frontend/ui/main.ts")) ? "build/ui" : "frontend",
);
if (!existsSync(path.join(frontendRoot, "index.html")))
  throw new Error("UI build missing. Run pnpm build first.");
const port = Number(process.env.WORKFLOW_BRIDGE_PORT || 4174);
const application = await createStudioServer({
  frontendRoot,
  plugins: [mcpServerPlugin, ...browserConfigurationPlugins],
  settingsFile: process.env.WORKFLOW_PLUGIN_SETTINGS,
  controlToken: process.env.WORKFLOW_BRIDGE_CONTROL_TOKEN,
  instanceId: process.env.WORKFLOW_BRIDGE_INSTANCE,
});
delete process.env.WORKFLOW_BRIDGE_CONTROL_TOKEN;
application.server.listen(port, "127.0.0.1", () => {
  process.send?.({ type: "ready", port: application.server.address().port });
  console.log("Workflow Studio host listening on http://127.0.0.1:" + port);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => application.dispose().then(() => process.exit(0)));

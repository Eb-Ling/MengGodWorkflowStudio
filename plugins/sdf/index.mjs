import { sdfManifest } from "./manifest.mjs";
import { sdfContribution } from "./contribution.mjs";
/** 通过公开 API 注册，停用回收本插件贡献。 */
export const sdfPlugin = {
  manifest: sdfManifest,
  activate(context) {
    const h = context.api("workflow.nodes").register(sdfContribution());
    context.onDispose(() => h.dispose());
  },
};

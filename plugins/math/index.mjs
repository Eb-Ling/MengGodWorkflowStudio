import { mathManifest } from "./manifest.mjs";
import { mathContribution } from "./contribution.mjs";
/** 通过公开 API 注册，停用回收本插件贡献。 */
export const mathPlugin = {
  manifest: mathManifest,
  activate(context) {
    const h = context.api("workflow.nodes").register(mathContribution());
    context.onDispose(() => h.dispose());
  },
};

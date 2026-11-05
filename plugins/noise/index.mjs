import { noiseManifest } from "./manifest.mjs";
import { noiseContribution } from "./contribution.mjs";
/** 只通过公开 NodeApi 注册，不读取工作流、UI、导出或其他插件实现。 */
export const noisePlugin = {
  manifest: noiseManifest,
  activate(context) {
    const registration = context
      .api("workflow.nodes")
      .register(noiseContribution());
    context.onDispose(() => registration.dispose());
  },
};

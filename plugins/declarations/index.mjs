import { declarationsManifest } from "./manifest.mjs";
import { createDeclarationSession } from "./session.mjs";
/** 解释有限 JSON 的能力插件，没有目录 IO、动态脚本加载或内核实现依赖。 */
export const declarationsPlugin = {
  manifest: declarationsManifest,
  activate(context) {
    const scopes = new Set();
    context.onDispose(() => {
      for (const stop of [...scopes]) stop();
    });
    context.provide("studio.declarations", (owner, own) => {
      let session = null,
        live = true;
      const dispose = () => {
        if (!live) return;
        live = false;
        session?.dispose();
        scopes.delete(dispose);
      };
      scopes.add(dispose);
      own(dispose);
      return {
        mount(definition, ports) {
          if (!live || session) throw Error("声明式插件已挂载或已停用");
          session = createDeclarationSession(owner, definition, ports);
          return { dispose };
        },
      };
    });
  },
};

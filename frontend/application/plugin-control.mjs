import { externalPlugin } from "./external-plugin.mjs";
import { declarativePlugin } from "./declarative-plugin.mjs";
/** L1 将目录快照装配成执行定义，不持有安装记录、依赖图或启停状态。 */
export function createPluginControl(host, platform) {
  const definition = (p) =>
    p.manifest.kind === "declarative"
      ? declarativePlugin(p)
      : externalPlugin(p, platform);
  return {
    list: () => host.list(),
    impact: (id) => host.impact(id),
    setEnabled: (id, enabled, options) => host.setEnabled(id, enabled, options),
    unregister: (id) => host.unregister(id),
    register: (p) => host.register(definition(p)),
    replace: (p) => host.replace(definition(p)),
  };
}

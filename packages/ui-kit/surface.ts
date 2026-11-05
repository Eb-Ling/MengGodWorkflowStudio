import { shallowRef, shallowReadonly } from "vue";
/** 宿主显示端口。只持有当前提供者的只读投影，组件库不依赖任何插件实现。 */
const current = shallowRef<any>(null);
export const uiSurface = shallowReadonly(current);
/** 仅组合根注入给受信任 UI 提供者。旧清理句柄不能卸载新的提供者。 */
export function mountUiSurface(surface: unknown) {
  if (current.value) throw Error("已有 UI 提供者占用显示端口");
  current.value = surface;
  return () => {
    if (current.value === surface) current.value = null;
  };
}

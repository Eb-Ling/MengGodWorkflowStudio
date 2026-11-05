import { shallowRef, shallowReadonly, reactive, markRaw, nextTick } from "vue";
import {
  uiComponents,
  ThemeProvider,
  createComponentRegistry,
} from "../../packages/ui-kit/index";
import type { UiApi } from "../../packages/plugin-sdk/types";
import { createWorkspaceState } from "./workspace-registry";
import {
  registration,
  ownRegistration,
} from "../../packages/plugin-sdk/registration.mjs";
/** 实例化的 UI 提供者，注册表、组件作用域与窗口状态都随该插件销毁。 */
export function createUiService() {
  const registry = createComponentRegistry(ThemeProvider),
    workspace = createWorkspaceState();
  const settings = shallowRef<any[]>([]),
    overlays = shallowRef<any[]>([]),
    docks = shallowRef<any[]>([]);
  const model = reactive({ open: false });
  const builtin = registry.createScope("studio.ui");
  for (const [key, component] of Object.entries(uiComponents))
    builtin.register({
      id:
        "studio.ui." +
        (key === "AppFrame"
          ? "frame"
          : key
              .replace(/^Ui/, "")
              .replace("FileInput", "file")
              .replace("SplitView", "split")
              .toLowerCase()),
      version: "1.0.0",
      component,
    });
  let active = true;
  const surface = {
    ...workspace,
    settingsPanels: shallowReadonly(settings),
    pluginOverlays: shallowReadonly(overlays),
    docks: shallowReadonly(docks),
    openWorkshop() {
      model.open = true;
    },
  };
  function scoped(
    owner: string,
    own: (cleanup: () => void) => void | (() => void),
  ): UiApi {
    let live = true;
    own(() => {
      live = false;
    });
    const check = (id: string) => {
      if (!active || !live) throw Error("UI 注册接口已撤销");
      if (!id.startsWith(owner + "."))
        throw Error("UI 注册 ID 超出所有者命名空间");
    };
    function register(items: typeof overlays, value: any) {
      check(value.id);
      if (items.value.some((e) => e.id === value.id))
        throw Error("UI 注册 ID 重复");
      const entry = {
        ...value,
        owner,
        ...(value.component ? { component: markRaw(value.component) } : {}),
      };
      items.value = [...items.value, entry];
      return ownRegistration(
        own,
        registration(owner, () => {
          items.value = items.value.filter((e) => e !== entry);
        }),
      );
    }
    return {
      components: uiComponents,
      ...workspace.createWorkspaceRegistration(owner, own),
      addSettingsPanel(p) {
        const category = p.category || "settings";
        if (!["management", "settings", "developer"].includes(category))
          throw Error("无效设置面板分区");
        return register(settings, { ...p, category });
      },
      addOverlay: (p) => register(overlays, p),
      addDock(p) {
        if (!["left", "right", "bottom"].includes(p.side))
          throw Error("无效 Dock 位置");
        return register(docks, p);
      },
      createScope(id) {
        check(id + ".scope");
        if (id !== owner) throw Error("组件作用域必须属于当前插件");
        const scope = registry.createScope(owner);
        const handle = ownRegistration(
          own,
          registration(owner, () => scope.dispose()),
        );
        return { ...scope, dispose: handle.dispose };
      },
    };
  }
  return {
    scoped,
    surface,
    registry,
    model,
    async dispose() {
      active = false;
      workspace.dispose();
      settings.value = [];
      overlays.value = [];
      docks.value = [];
      await nextTick();
      builtin.dispose();
    },
  };
}

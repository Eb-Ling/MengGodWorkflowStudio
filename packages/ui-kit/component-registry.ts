import {
  createApp,
  defineComponent,
  h,
  onErrorCaptured,
  shallowReactive,
  type Component,
  type Slots,
  type App,
} from "vue";

export interface ComponentDefinition {
  id: string;
  version: string;
  component: Component;
}
export interface UiInstance {
  update(props: Record<string, unknown>): void;
  dispose(): void;
}

// Trusted in-process UI modules only. This is not a permission or sandbox layer.
export function createComponentRegistry(provider: Component) {
  let instanceSequence = 0;
  const definitions = new Map<
    string,
    ComponentDefinition & { owner: string }
  >();
  const scopes = new Map<string, ReturnType<typeof createScope>>();

  function createScope(owner: string) {
    if (!/^[a-z][a-z0-9.-]+$/.test(owner) || scopes.has(owner))
      throw new Error(`UI 模块 ID 重复或无效：${owner}`);
    const instances = new Set<{ id: string; handle: UiInstance }>();
    const registrations = new Set<string>();
    let disposed = false;
    const assertActive = () => {
      if (disposed) throw new Error(`UI 模块已销毁：${owner}`);
    };
    const scope = {
      register(definition: ComponentDefinition) {
        assertActive();
        if (
          !definition.id.startsWith(owner + ".") ||
          definitions.has(definition.id)
        )
          throw new Error(`组件 ID 冲突或超出命名空间：${definition.id}`);
        if (!/^\d+\.\d+\.\d+$/.test(definition.version))
          throw new Error("组件必须声明版本");
        definitions.set(definition.id, { ...definition, owner });
        registrations.add(definition.id);
      },
      create(
        id: string,
        target: HTMLElement,
        props: Record<string, unknown> = {},
        slots: Slots = {},
      ): UiInstance {
        assertActive();
        const definition = definitions.get(id);
        if (!definition) throw new Error(`组件未注册：${id}`);
        const root = document.createElement("div");
        root.className = "ui-component-instance";
        root.dataset.uiOwner = owner;
        target.append(root);
        const state = shallowReactive({ props: { ...props }, error: "" });
        const content = defineComponent({
          setup() {
            onErrorCaptured((error) => {
              state.error = String(error);
              return false;
            });
            return () =>
              state.error
                ? h(
                    "p",
                    { role: "alert", class: "ui-field-error" },
                    "组件无法显示：" + state.error,
                  )
                : h(definition.component, state.props, slots);
          },
        });
        const app: App = createApp({
          render: () => h(provider, null, { default: () => h(content) }),
        });
        app.config.idPrefix = `${owner}-${++instanceSequence}`;
        let live = true;
        const record = { id, handle: null as unknown as UiInstance };
        const handle: UiInstance = {
          update(next) {
            assertActive();
            if (!live) throw new Error("UI 实例已销毁");
            state.props = { ...state.props, ...next };
          },
          dispose() {
            if (!live) return;
            live = false;
            app.unmount();
            root.remove();
            instances.delete(record);
          },
        };
        record.handle = handle;
        try {
          app.mount(root);
          instances.add(record);
        } catch (error) {
          root.remove();
          throw error;
        }
        return handle;
      },
      dispose() {
        if (disposed) return;
        // A provider cannot silently invalidate another live consumer. Full API
        // dependency orchestration will live in the future extension host.
        for (const [otherOwner, other] of scopes) {
          if (otherOwner !== owner && other.usesAny(registrations))
            throw new Error(`UI 模块仍被 ${otherOwner} 使用`);
        }
        for (const record of [...instances]) record.handle.dispose();
        for (const id of registrations) definitions.delete(id);
        disposed = true;
        scopes.delete(owner);
      },
      usesAny(ids: Set<string>) {
        return [...instances].some((record) => ids.has(record.id));
      },
    };
    scopes.set(owner, scope);
    return scope;
  }

  return {
    createScope,
    list: () =>
      [...definitions.values()].map(({ id, version, owner }) => ({
        id,
        version,
        owner,
      })),
  };
}

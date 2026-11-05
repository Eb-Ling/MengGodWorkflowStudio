import { shallowRef, shallowReadonly, markRaw } from "vue";
import type { Component } from "vue";
import type { Registration } from "../../packages/plugin-sdk/types";
import {
  registration,
  ownRegistration,
} from "../../packages/plugin-sdk/registration.mjs";
import { ContractError } from "../../packages/plugin-sdk/errors.mjs";
export type ViewSlot =
  | "graph"
  | "catalog"
  | "inspector"
  | "geometry"
  | "preview-controls"
  | "stage-tabs"
  | "workspace-actions"
  | "project-config"
  | "project-library"
  | "project-examples"
  | "project-actions"
  | "project-title-actions";
export interface ViewEntry {
  id: string;
  slot: ViewSlot;
  component: Component;
  props?: Record<string, unknown>;
}
export interface RendererEntry {
  id: string;
  kind: "node" | "port" | "field";
  typeIds: string[];
  priority?: number;
  component: Component;
}
export function createWorkspaceState() {
  let active = true;
  const views = shallowRef<(ViewEntry & { owner: string })[]>([]),
    renderers = shallowRef<(RendererEntry & { owner: string })[]>([]);
  const workspaceViews = shallowReadonly(views),
    workspaceRenderers = shallowReadonly(renderers);
  /** 受信任 UI 的注册插槽，所有者自动回收，旧句柄不能删除后来注册的同名项。 */
  function createWorkspaceRegistration(
    owner: string,
    own: (cleanup: () => void) => void | (() => void),
  ) {
    let live = true;
    own(() => {
      live = false;
    });
    const check = (id: string) => {
      if (!active || !live)
        throw new ContractError("API_REVOKED", "UI 注册接口已撤销");
      if (typeof id !== "string" || !id.startsWith(owner + "."))
        throw new ContractError(
          "PERMISSION_DENIED",
          "UI 注册 ID 超出所有者命名空间",
        );
    };
    function register<T extends { id: string; component: Component }>(
      items: { value: T[] },
      value: T,
    ): Registration {
      check(value.id);
      if (items.value.some((x) => x.id === value.id))
        throw new ContractError("CONFLICT", "UI 注册 ID 重复");
      if (
        !value.component ||
        !["function", "object"].includes(typeof value.component)
      )
        throw new ContractError("INVALID_REGISTRATION", "UI 必须提供组件");
      const entry = { ...value, component: markRaw(value.component) };
      items.value = [...items.value, entry];
      return ownRegistration(
        own,
        registration(owner, () => {
          items.value = items.value.filter((x) => x !== entry);
        }),
      );
    }
    return {
      addView(value: ViewEntry) {
        if (
          ![
            "graph",
            "catalog",
            "inspector",
            "geometry",
            "preview-controls",
            "stage-tabs",
            "workspace-actions",
            "project-config",
            "project-library",
            "project-examples",
            "project-actions",
            "project-title-actions",
          ].includes(value.slot) ||
          views.value.some((x) => x.slot === value.slot)
        )
          throw Error("视图插槽不存在或已被占用");
        return register(views, { ...value, owner });
      },
      addRenderer(value: RendererEntry) {
        if (
          !["node", "port", "field"].includes(value.kind) ||
          !Array.isArray(value.typeIds) ||
          !value.typeIds.length ||
          value.typeIds.some(
            (type) => typeof type !== "string" || !type.trim(),
          ) ||
          !Number.isFinite(value.priority ?? 0)
        )
          throw Error("渲染器声明无效");
        if (
          renderers.value.some(
            (x) =>
              x.kind === value.kind &&
              (x.priority ?? 0) === (value.priority ?? 0) &&
              x.typeIds.some((t) => value.typeIds.includes(t)),
          )
        )
          throw Error("同优先级的渲染器类型重复");
        return register(renderers, {
          ...value,
          typeIds: [...value.typeIds],
          owner,
        });
      },
    };
  }
  /** 每个实例根据 kind/type 解析，精确匹配优先于通配项，再按显式优先级。 */
  function resolveRenderer(kind: string, type: string) {
    return renderers.value
      .filter(
        (x) =>
          x.kind === kind &&
          (x.typeIds.includes(type) || x.typeIds.includes("*")),
      )
      .sort(
        (a, b) =>
          Number(b.typeIds.includes(type)) - Number(a.typeIds.includes(type)) ||
          (b.priority ?? 0) - (a.priority ?? 0),
      )[0];
  }

  return {
    workspaceViews,
    workspaceRenderers,
    createWorkspaceRegistration,
    resolveRenderer,
    /** 提供者退出时撤销所有工作区接口，旧接口不能重新挂载内容。 */
    dispose() {
      active = false;
      views.value = [];
      renderers.value = [];
    },
  };
}

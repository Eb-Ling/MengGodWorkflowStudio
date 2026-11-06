import type { PluginContext, WorkflowApi, NodeApi } from "./types";
import type { DrawingScene, DrawingPoint } from "./drawing-types";
/** 目录插件远程调用始终异步，参数和结果必须通过有界 JSON 消息。 */
export type AsyncApi<T> = {
  [
    K in keyof T as T[K] extends (...args: any[]) => any ? K : never
  ]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};
/** 当前草稿快照、常用编辑与守卫写入，execute 的应用动作仅允许 UNDO/REDO/SET_STAGE。 */
export type RemoteWorkflowApi = AsyncApi<
  Pick<
    WorkflowApi,
    "snapshot" | "inspect" | "execute" | "edit" | "addNode" | "setProperty"
  >
>;
/** register 在隔离侧同步收集声明，list/get 是异步公开读接口。 */
// 目录脚本在 activate 中收集静态贡献，重载目录即可更新实现。
export type RemoteNodeApi = { register(batch: Parameters<NodeApi["register"]>[0]): { dispose(): void } } &
  AsyncApi<Pick<NodeApi, "list" | "get">>;
type UiBase = { id: string; label?: string; disabled?: boolean };
/** 不含 HTML/CSS/回调。树深最多 8 层、控件最多 256 个，ID 在树内唯一。 */
export type ExtensionUiNode =
  /** 受检二维绘图，interactive 开启时通过 point 事件返回逻辑坐标。 */
  | (UiBase & { type: "drawing"; scene: DrawingScene; interactive?: boolean })
  | (UiBase & { type: "row" | "column" | "panel"; children: ExtensionUiNode[] })
  /** 折叠仅影响显示，不会重置子控件值或停止所属插件。 */
  | (UiBase & {
      type: "disclosure";
      defaultExpanded?: boolean;
      children: ExtensionUiNode[];
    })
  | (UiBase & { type: "text"; text: string })
  | (UiBase & { type: "button" })
  | (UiBase & { type: "toggle"; value: boolean })
  | (UiBase & { type: "input"; value: string })
  /** 多行纯文本，最多 4000 字符，rows 为 2–20（默认 4）。 */
  | (UiBase & { type: "textarea"; value: string; rows?: number })
  | (UiBase & {
      type: "number";
      value: number;
      min?: number;
      max?: number;
      step?: number;
    })
  | (UiBase & {
      type: "select";
      value: string;
      options: { label: string; value: string }[];
    });
export interface ExtensionUiEvent {
  sequence: number;
  panelId: string;
  controlId: string;
  revision: number;
  type: "click" | "change" | "point";
  value: string | number | boolean | null | DrawingPoint;
}
/** 声明式 UI 提供者接口。目录插件用 AsyncApi<ExtensionUiApi> 调用。 */
export interface ExtensionUiApi {
  /** 需要 extension.ui.inspect，只读贡献元数据，不含控件值或事件，不操纵界面。 */
  inspect(request: { owner: string }): {
    panels: {
      id: string;
      owner: string;
      title: string;
      placement: string;
      revision: number;
      controls: { id: string; type: string }[];
    }[];
  };
  /** id 以当前插件 ID 加点号开头，同一所有者最多 8 个面板。 */
  create(request: {
    id: string;
    title: string;
    /** dock 停靠工作区，settings 进入插件设置，dialog 在插件设置提供手动打开窗口的入口。 */
    placement?: "dock" | "settings" | "dialog";
    /** 仅在 dock 模式生效。 */
    side?: "left" | "right" | "bottom";
    tree: ExtensionUiNode;
  }): { id: string; revision: number };
  /** 原子替换受检 UI 树，过期树触发的事件自动丢弃。 */
  update(request: { id: string; tree: ExtensionUiNode }): {
    id: string;
    revision: number;
  };
  /** 只移除当前插件面板，可重复调用，停用时自动回收。 */
  remove(request: { id: string }): { removed: boolean };
  /** 按游标读取自己的事件，高频 change 合并，队列最多 128 项，truncated 表示需提示用户重试。 */
  events(request: { after?: number }): {
    cursor: number;
    events: ExtensionUiEvent[];
    truncated: boolean;
  };
}
/** 相同生命周期模型，远程方法为 Promise。仅提供 JSON 对象 API，不提供本地组件/工厂。 */
export interface ExtensionContext extends Omit<
  PluginContext,
  "api" | "provide"
> {
  api(id: "workflow.editor"): RemoteWorkflowApi;
  api(id: "workflow.nodes"): RemoteNodeApi;
  api(id: "studio.extension-ui"): AsyncApi<ExtensionUiApi>;
  api<T>(id: string): T;
  provide(
    id: string,
    implementation: Record<string, (...args: any[]) => unknown>,
  ): void;
}

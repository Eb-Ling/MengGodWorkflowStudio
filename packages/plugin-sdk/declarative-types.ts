import type { Disposable, WorkflowApi } from "./types";
import type { ExtensionUiApi, ExtensionUiNode } from "./extension-types";
/** 控件引用不执行表达式，只接受与目标参数类型一致的控件值。 */
export type ControlValue<T> = T | { control: string };
export type DeclarationAction = { on: string } & (
  | {
      kind: "move";
      target: "selection" | "all" | "selection-or-all";
      dx: ControlValue<number>;
      dy: ControlValue<number>;
    }
  | {
      kind: "rename";
      target: "selection" | "all" | "selection-or-all";
      title: ControlValue<string>;
    }
  | { kind: "stage"; stage: "vertex" | "fragment" }
  | { kind: "summary" | "undo" | "redo" }
);
/** 单文件声明式插件的数据部分，安装时和挂载时都会校验。 */
export interface Declaration {
  schemaVersion: 1;
  panel: {
    id: string;
    title: string;
    /** 默认 dock，独立窗口由用户在插件设置中主动打开。 */
    placement?: "dock" | "settings" | "dialog";
    side?: "left" | "right" | "bottom";
  };
  tree: ExtensionUiNode;
  actions: DeclarationAction[];
}
/** 受信任宿主传入当前消费者的公开代理，提供者不借用自己的权限执行用户动作。 */
export interface DeclarationPorts {
  ui: ExtensionUiApi;
  workflow: WorkflowApi;
}
/** local API 仅供宿主装配，纯 JSON 目录和隔离脚本均无法自行传入函数。 */
export interface DeclarationApi {
  /** 创建面板、绑定动作，返回可重复释放句柄，停用时按消费者兜底回收。 */
  mount(definition: Declaration, ports: DeclarationPorts): Disposable;
}

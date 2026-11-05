import type { GraphNode, GraphSnapshot, Disposable } from "../plugin-sdk/types";
import type { LayoutOptions } from "./types";

/** 策略收到递归冻结的独立副本，不能借返回值以外的方式修改文档。 */
type ReadonlyInput<T> = T extends object
  ? { readonly [K in keyof T]: ReadonlyInput<T[K]> }
  : T;
export interface NodeBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface StrategyInputs {
  /** bounds 与 box 均为画布世界坐标，bounds 使用节点实际测量尺寸。 */
  selection: {
    nodes: GraphNode[];
    bounds: NodeBounds[];
    box: Omit<NodeBounds, "id">;
  };
  layers: { nodes: GraphNode[]; selection: string[] };
  layout: LayoutOptions & { graph: GraphSnapshot };
}
export interface StrategyOutputs {
  selection: { nodeIds: string[] };
  /** 从后到前的完整节点排列，必须包含全部节点且不能重复。 */
  layers: { nodeIds: string[] };
  layout: { positions: { nodeId: string; x: number; y: number }[] };
}
export type StrategyKind = keyof StrategyInputs;
export type StrategyResult<K extends StrategyKind> = K extends "layout"
  ? StrategyOutputs[K] | Promise<StrategyOutputs[K]>
  : StrategyOutputs[K];
export type StrategyDefinition = {
  [K in StrategyKind]: {
    /** ID 必须以当前插件 ID 加点号为前缀。 */
    id: string;
    title: string;
    kind: K;
    /** 选择/显示顺序必须同步，布局允许异步。 */
    run(input: ReadonlyInput<StrategyInputs[K]>): StrategyResult<K>;
  };
}[StrategyKind];
export interface StrategyDescriptor {
  id: string;
  title: string;
  kind: StrategyKind;
  owner: string;
  active: boolean;
}
/** 显示层顺序只决定画布遮挡，不改变 GLSL 执行顺序或游戏渲染层。 */
export interface InteractionApi {
  /** 返回可重复清理的句柄，插件停用时内核自动清理。注册不会切换当前策略。 */
  register(definition: StrategyDefinition): Disposable;
  list(): StrategyDescriptor[];
  /** 显式选择策略，插件停用时自动退回默认策略。 */
  activate(request: { kind: StrategyKind; id: string }): void;
  /** 订阅注册、移除与当前策略变化，返回取消订阅函数。 */
  subscribe(listener: () => void): () => void;
  /** 返回意图，不修改文档，调用方应使用原快照守卫提交。迟到或非法结果会被拒绝。 */
  evaluate<K extends StrategyKind>(request: {
    kind: K;
    input: StrategyInputs[K];
  }): StrategyResult<K>;
}

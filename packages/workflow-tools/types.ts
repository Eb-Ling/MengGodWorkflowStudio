import type { GraphSnapshot, GraphNode, GraphLink } from "../plugin-sdk/types";
/** 与实现解耦的 JSON 请求，像素大小与视框缩放相互独立。 */
export interface PreviewRequest {
  document?: Record<string, unknown>;
  stage?: "vertex" | "fragment";
  nodeId?: string;
  socket?: string;
  width?: number;
  height?: number;
  /** 省略时跟随编辑器播放，传入秒数可固定采样。 */
  time?: number;
  longEdge?: number;
  geometry?: {
    count?: number;
    selected?: number;
    overrides?: Record<string, unknown>;
  };
}
export interface PreviewFrame {
  width: number;
  height: number;
  /** 此帧实际使用的 u_time，单位为秒。 */
  time: number;
  dataUrl: string;
  stage: string;
  nodeId?: string;
  socket?: string;
}
export interface PreviewApi {
  /** 设置共享时间或播放状态。挂载画布静态取样，连续绘制仅发生在可见的高清视框。 */
  setPlayback(input: { time?: number; playing?: boolean }): PreviewPlayback;
  /** 立即取得时间状态并订阅后续变化，返回解除订阅的函数。 */
  subscribePlayback(listener: (state: PreviewPlayback) => void): () => void;
  /** 通过编译 API 读取容量与命中统计，不接触编译插件实现。 */
  compilationStatus(): Promise<Record<string, unknown>>;
  /** 真正重新渲染并返回 PNG，不会打开视框或改动工作流。 */
  frame(request?: PreviewRequest): Promise<PreviewFrame>;
  /** 将当前节点输出放入可缩放的高清视框。 */
  open(
    request?: PreviewRequest,
  ): Promise<
    { opened: false } | { opened: true; width: number; height: number }
  >;
  /** 只关闭当前调用者打开的视框，插件停用还会回收全部 GPU 资源。 */
  close(request?: Record<string, never>): { closed: boolean };
  /** 挂载调用方自己的画布，不需要登记编号或操作内部渲染端口。 */
  mount(canvas: HTMLCanvasElement, defaults?: PreviewRequest): PreviewView;
  status(request?: Record<string, never>): Record<string, unknown>;
}
export interface PreviewPlayback {
  time: number;
  playing: boolean;
  /** 当前工作流的顶点或片段图含有时间节点。 */
  available: boolean;
}
export interface TemplateItem {
  id: string;
  title: string;
  preset: boolean;
  description: string;
  graph: { nodes: GraphNode[]; links: GraphLink[] };
}
/** 模板服务不导入节点实现，展开的内容由公开图事务校验。 */
export interface TemplateApi {
  list(request: Record<string, never>): { items: TemplateItem[] };
  /** 保存当前选择与内部连线，返回独立数据副本。 */
  save(request: { title?: string }): TemplateItem;
  remove(request: { id: string }): { removed: boolean };
  /** 每次重新分配节点 ID，一次操作对应一次撤销。 */
  expand(request: { id: string; x?: number; y?: number }): {
    ok: true;
    title: string;
    nodeIds: string[];
  };
  example(request: {
    id: "mingGod" | "instancedWave";
  }): Record<string, unknown>;
}
export interface LayoutOptions {
  direction?: "LR" | "TB";
  gapX?: number;
  gapY?: number;
  startX?: number;
  startY?: number;
}
/** 布局只改变坐标，控制区域整体平移。 */
export interface LayoutApi {
  /** 只计算，不写图。gapX/gapY 是节点组外边界间距，至少 16。 */
  plan(request: LayoutOptions & { graph: GraphSnapshot }): {
    positions: { nodeId: string; x: number; y: number }[];
    groups: number;
    layers: number;
  };
  /** 读取当前公开快照，经同一公开命令入口原子提交全部位置。 */
  arrange(request: LayoutOptions): { ok: true; moved: number };
}
/** 挂载句柄不跨进程，参数及画布代次由能力内部管理。 */
export interface PreviewView {
  /** 绘制最新请求，过期帧不覆盖新画面，合并跳过时 presented=false 且宽高为 0。 */
  render(
    request?: PreviewRequest,
  ): Promise<{ width: number; height: number; presented: boolean }>;
  /** 沿用最近一次绘制参数，默认以 2048 长边打开高清图。 */
  open(request?: PreviewRequest): ReturnType<PreviewApi["open"]>;
  /** 可重复调用，消费插件和预览插件停用时也会自动释放。 */
  dispose(): void;
}

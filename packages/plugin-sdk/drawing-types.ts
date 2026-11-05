/** 场景使用逻辑像素，颜色仅允许 #RRGGBB / #RRGGBBAA。 */
export type DrawingCommand =
  | ({
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    } & DrawingPaint)
  | ({ kind: "circle"; cx: number; cy: number; r: number } & DrawingPaint)
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      lineWidth?: number;
    }
  | {
      kind: "polyline";
      points: [number, number][];
      stroke: string;
      lineWidth?: number;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      color: string;
      fontSize?: number;
      align?: "left" | "center" | "right";
    };
/** 填充、描边至少提供一项，线宽范围 0.25–64。 */
export interface DrawingPaint {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
}
export interface DrawingScene {
  /** 各维 16–2048，总像素最多 1048576，不会乘设备像素比而扩大预算。 */
  width: number;
  height: number;
  background?: string;
  /** 最多 512 图元，全部折线合计最多 2048 个点。 */
  commands: DrawingCommand[];
}
/** 校验并复制场景，失败抛出中文错误，不修改原始数据。 */
export declare function readDrawing(input: unknown): DrawingScene;
export declare function defaultDrawing(): DrawingScene;
/** 点击坐标已经换算为场景逻辑像素，键盘 Enter/空格返回画布中心。 */
export interface DrawingPoint {
  x: number;
  y: number;
}

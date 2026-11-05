import { extensionJson } from "./extension-protocol.mjs";
/** 只接受有限二维图元，没有脚本、路径字符串、图片 URL、字体加载或原生绘图句柄。 */
export function readDrawing(input) {
  const scene = extensionJson(input);
  const exact = (value, keys) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some((k) => !keys.includes(k))
    )
      throw Error("绘图含未开放字段");
  };
  const number = (v, min = -100000, max = 100000) => {
    if (!Number.isFinite(v) || v < min || v > max)
      throw Error("绘图数值超出范围");
  };
  const color = (v) => {
    if (typeof v !== "string" || !/^#(?:[\da-f]{6}|[\da-f]{8})$/i.test(v))
      throw Error("绘图颜色须为 #RRGGBB 或 #RRGGBBAA");
  };
  exact(scene, ["width", "height", "background", "commands"]);
  for (const key of ["width", "height"])
    if (!Number.isInteger(scene[key]) || scene[key] < 16 || scene[key] > 2048)
      throw Error("画布宽高须为 16–2048 整数");
  if (scene.width * scene.height > 1048576)
    throw Error("单画布最多 1048576 像素");
  if (scene.background !== undefined) color(scene.background);
  if (!Array.isArray(scene.commands) || scene.commands.length > 512)
    throw Error("单画布最多 512 个图元");
  let points = 0;
  for (const c of scene.commands) {
    const fields = {
      rect: ["x", "y", "width", "height"],
      circle: ["cx", "cy", "r"],
      line: ["x1", "y1", "x2", "y2"],
      polyline: ["points"],
      text: ["x", "y", "text", "color", "fontSize", "align"],
    }[c?.kind];
    if (!fields) throw Error("未支持的绘图图元");
    const shape = ["rect", "circle"].includes(c.kind),
      stroke = c.kind !== "text";
    exact(c, [
      "kind",
      ...fields,
      ...(shape ? ["fill"] : []),
      ...(stroke ? ["stroke", "lineWidth"] : []),
    ]);
    if (c.kind === "polyline") {
      if (
        !Array.isArray(c.points) ||
        c.points.length < 2 ||
        (points += c.points.length) > 2048
      )
        throw Error("画布折线至少 2 点，合计最多 2048 点");
      for (const p of c.points) {
        if (!Array.isArray(p) || p.length !== 2)
          throw Error("折线坐标为 [x,y]");
        p.forEach((v) => number(v));
      }
    } else {
      for (const key of fields.filter(
        (k) => !["text", "color", "fontSize", "align"].includes(k),
      ))
        number(c[key]);
    }
    if (shape) {
      for (const key of c.kind === "rect" ? ["width", "height"] : ["r"])
        number(c[key], 0);
      if (c.fill === undefined && c.stroke === undefined)
        throw Error("形状至少需要填充或描边");
      if (c.fill !== undefined) color(c.fill);
    }
    if (stroke) {
      if (!shape || c.stroke !== undefined) color(c.stroke);
      if (c.lineWidth !== undefined) number(c.lineWidth, 0.25, 64);
    } else {
      if (typeof c.text !== "string" || c.text.length > 500)
        throw Error("绘图文字最多 500 字符");
      color(c.color);
      if (c.fontSize !== undefined) number(c.fontSize, 6, 128);
      if (
        c.align !== undefined &&
        !["left", "center", "right"].includes(c.align)
      )
        throw Error("绘图文字对齐无效");
    }
  }
  return scene;
}
/** 返回可直接编辑的教学图，每次调用都创建独立数据。 */
export function defaultDrawing() {
  return {
    width: 480,
    height: 240,
    background: "#151a22",
    commands: [
      { kind: "rect", x: 16, y: 16, width: 448, height: 208, fill: "#202b3d" },
      {
        kind: "polyline",
        points: Array.from({ length: 81 }, (_, i) => [
          24 + i * 5.4,
          130 + Math.sin(i / 8) * 48,
        ]),
        stroke: "#77aaff",
        lineWidth: 3,
      },
      { kind: "circle", cx: 420, cy: 55, r: 16, fill: "#f59e5c" },
      {
        kind: "text",
        x: 28,
        y: 44,
        text: "二维绘图",
        color: "#e8eef8",
        fontSize: 20,
      },
    ],
  };
}

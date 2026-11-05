import { readDrawing } from "../plugin-sdk/drawing.mjs";
/** 通过公开 Canvas2D 接口绘制已受检场景，输入无效时保留上一幅画面。 */
export function paintDrawing(canvas, input) {
  const scene = readDrawing(input),
    ctx = canvas.getContext("2d");
  if (!ctx) throw Error("当前环境无法创建二维画布");
  canvas.width = scene.width;
  canvas.height = scene.height;
  if (scene.background) {
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, scene.width, scene.height);
  }
  for (const c of scene.commands) {
    ctx.save();
    try {
      ctx.lineWidth = c.lineWidth ?? 1;
      if (c.kind === "text") {
        ctx.fillStyle = c.color;
        ctx.font = `${c.fontSize ?? 16}px sans-serif`;
        ctx.textAlign = c.align ?? "left";
        ctx.fillText(c.text, c.x, c.y);
        continue;
      }
      ctx.beginPath();
      if (c.kind === "rect") ctx.rect(c.x, c.y, c.width, c.height);
      else if (c.kind === "circle") ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
      else if (c.kind === "line") {
        ctx.moveTo(c.x1, c.y1);
        ctx.lineTo(c.x2, c.y2);
      } else {
        ctx.moveTo(...c.points[0]);
        for (const p of c.points.slice(1)) ctx.lineTo(...p);
      }
      if (c.fill) {
        ctx.fillStyle = c.fill;
        ctx.fill();
      }
      if (c.stroke) {
        ctx.strokeStyle = c.stroke;
        ctx.stroke();
      }
    } finally {
      ctx.restore();
    }
  }
  return scene;
}
/** CSS 缩放后的指针位置转回逻辑坐标，隐藏或零尺寸画布不产生事件。 */
export function drawingPoint(scene, rect, clientX, clientY) {
  if (
    !(rect.width > 0 && rect.height > 0) ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY)
  )
    return null;
  return {
    x: Math.max(
      0,
      Math.min(scene.width, ((clientX - rect.left) * scene.width) / rect.width),
    ),
    y: Math.max(
      0,
      Math.min(
        scene.height,
        ((clientY - rect.top) * scene.height) / rect.height,
      ),
    ),
  };
}

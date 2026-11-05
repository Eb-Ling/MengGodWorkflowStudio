/** 指针锚定缩放与适应窗口的纯计算，坐标为视框左上角的 CSS 像素。 */
export function fitView(width, height, viewportWidth, viewportHeight) {
  const scale = Math.min(
    (viewportWidth - 32) / width,
    (viewportHeight - 32) / height,
    1,
  );
  return {
    scale: Math.max(0.01, scale),
    x: (viewportWidth - width * scale) / 2,
    y: (viewportHeight - height * scale) / 2,
  };
}
export function zoomView(view, nextScale, anchor) {
  const scale = Math.max(0.01, Math.min(8, nextScale)),
    ratio = scale / view.scale;
  return {
    scale,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  };
}

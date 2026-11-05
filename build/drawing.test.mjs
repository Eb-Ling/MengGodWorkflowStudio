import test from "node:test";
import assert from "node:assert/strict";
import {
  readDrawing,
  defaultDrawing,
} from "../packages/plugin-sdk/drawing.mjs";
import { readUiTree } from "../packages/plugin-sdk/extension-ui.mjs";
import { paintDrawing, drawingPoint } from "../packages/ui-kit/drawing.mjs";
import { createExtensionUiService } from "../plugins/extension-ui/service.mjs";
test("绘图契约拒绝无界数据、外部资源与非公开指令", () => {
  const scene = defaultDrawing();
  assert.deepEqual(readDrawing(scene), scene);
  for (const change of [
    { width: 0 },
    { width: 2049 },
    { width: 2048, height: 2048 },
    { background: "url(https://example.com)" },
    { commands: [{ kind: "image", url: "https://example.com" }] },
    { commands: Array(513).fill(scene.commands[0]) },
    {
      commands: [
        { kind: "text", x: 0, y: 0, text: "x".repeat(501), color: "#ffffff" },
      ],
    },
    {
      commands: [
        {
          kind: "polyline",
          points: Array(2049).fill([1, 1]),
          stroke: "#ffffff",
        },
      ],
    },
  ])
    assert.throws(() => readDrawing({ ...scene, ...change }));
  for (const c of [
    { kind: "circle", cx: 0, cy: 0, r: -1, fill: "#ffffff" },
    { kind: "line", x1: 0, y1: 0, x2: 1, y2: 1, stroke: "#fff" },
    { kind: "rect", x: 0, y: 0, width: 10, height: 10 },
    {
      kind: "text",
      x: 0,
      y: 0,
      text: "x",
      color: "#ffffff",
      fontSize: Infinity,
    },
  ])
    assert.throws(() => readDrawing({ ...scene, commands: [c] }));
  const clone = readDrawing(scene);
  clone.commands[0].fill = "#000000";
  assert.notEqual(scene.commands[0].fill, clone.commands[0].fill);
});
test("整棵控件树有合计绘图预算，不能用多个合法画布绕过", () => {
  const node = (i) => ({
    id: "c" + i,
    type: "drawing",
    scene: { width: 1024, height: 1024, commands: [] },
  });
  assert.throws(
    () =>
      readUiTree({
        id: "root",
        type: "column",
        children: Array.from({ length: 5 }, (_, i) => node(i)),
      }),
    /总预算/,
  );
  const shape = {
    kind: "rect",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    fill: "#ffffff",
  };
  assert.throws(
    () =>
      readUiTree({
        id: "root",
        type: "column",
        children: Array.from({ length: 5 }, (_, i) => ({
          ...node(i),
          scene: { width: 16, height: 16, commands: Array(512).fill(shape) },
        })),
      }),
    /总预算/,
  );
  assert.throws(() => readUiTree({ ...node(1), interactive: "true" }), /布尔/);
});
test("无效场景不擦除现有画布，绘图状态成对恢复，缩放坐标按逻辑像素返回", () => {
  const operations = [],
    ctx = new Proxy(
      {},
      {
        get:
          (_, key) =>
          (...args) =>
            operations.push([key, ...args]),
        set: () => true,
      },
    );
  const canvas = { width: 12, height: 14, getContext: () => ctx };
  assert.throws(() => paintDrawing(canvas, { ...defaultDrawing(), width: 0 }));
  assert.equal(canvas.width, 12);
  assert.equal(operations.length, 0);
  paintDrawing(canvas, defaultDrawing());
  assert.equal(canvas.width, 480);
  assert.equal(operations.filter((a) => a[0] === "save").length, 4);
  assert.equal(operations.filter((a) => a[0] === "restore").length, 4);
  assert.deepEqual(
    drawingPoint(
      defaultDrawing(),
      { left: 10, top: 20, width: 240, height: 120 },
      70,
      50,
    ),
    { x: 120, y: 60 },
  );
  assert.equal(
    drawingPoint(
      defaultDrawing(),
      { left: 0, top: 0, width: 0, height: 0 },
      0,
      0,
    ),
    null,
  );
});
test("坐标事件复制隔离，原子更新失败保留画面，旧修订与旧面板事件失效", () => {
  let mounted;
  const stops = [];
  const service = createExtensionUiService(
    (p) => {
      mounted = p;
      return { dispose() {} };
    },
    (x) => x,
  );
  const ui = service.scoped("local.draw", (f) => stops.push(f)),
    id = "local.draw.panel",
    tree = {
      id: "plot",
      type: "drawing",
      scene: defaultDrawing(),
      interactive: true,
    };
  ui.create({ id, title: "test", tree });
  const stale = mounted,
    value = { x: 10, y: 20 };
  mounted.send({ controlId: "plot", type: "point", value, revision: 1 });
  value.x = 999;
  const events = ui.events({ after: 0 });
  assert.equal(events.events[0].value.x, 10);
  events.events[0].value.x = 998;
  assert.equal(ui.events({ after: 0 }).events[0].value.x, 10);
  assert.throws(() =>
    ui.update({ id, tree: { ...tree, scene: { ...tree.scene, width: 0 } } }),
  );
  assert.equal(mounted.model.revision, 1);
  ui.update({ id, tree });
  mounted.send({ controlId: "plot", type: "point", value, revision: 1 });
  assert.equal(ui.events({ after: 0 }).events.length, 0);
  ui.remove({ id });
  ui.create({ id, title: "new", tree });
  stale.send({ controlId: "plot", type: "point", value, revision: 1 });
  assert.equal(ui.events({ after: 0 }).events.length, 0);
  stops.forEach((f) => f());
  assert.throws(() => ui.events({}), /撤销/);
  service.dispose();
});

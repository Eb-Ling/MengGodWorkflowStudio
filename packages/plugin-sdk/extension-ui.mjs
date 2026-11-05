import { extensionJson } from "./extension-protocol.mjs";
import { readDrawing } from "./drawing.mjs";
export const extensionUiApi = "studio.extension-ui";
/** 界面放置方式由能力插件解释，不开放任意宿主插槽、DOM 或自动弹窗。 */
export function readPanelPlacement({
  placement = "dock",
  side = "bottom",
} = {}) {
  if (
    !["dock", "settings", "dialog"].includes(placement) ||
    !["left", "right", "bottom"].includes(side)
  )
    throw Error("面板放置方式或停靠位置无效");
  return { placement, side };
}
/** 声明式 UI 只描述公开控件，不接受 HTML、脚本、CSS、DOM 或组件实例。 */
export function readUiTree(input) {
  const tree = extensionJson(input),
    ids = new Set();
  let count = 0,
    drawingPixels = 0,
    drawingCommands = 0,
    drawingPoints = 0;
  function visit(node, depth = 0) {
    if (
      !node ||
      typeof node !== "object" ||
      Array.isArray(node) ||
      depth > 8 ||
      ++count > 256
    )
      throw Error("UI 树最多 256 个控件、8 层");
    if (!/^[A-Za-z][\w.-]{0,99}$/.test(node.id || "") || ids.has(node.id))
      throw Error("控件 ID 无效或重复");
    ids.add(node.id);
    if (
      ![
        "text",
        "drawing",
        "button",
        "toggle",
        "input",
        "textarea",
        "number",
        "select",
        "row",
        "column",
        "panel",
        "disclosure",
      ].includes(node.type)
    )
      throw Error("未支持的声明式控件");
    const keys = new Set(["id", "type", "label", "text", "disabled"]);
    if (node.type === "drawing") {
      keys.add("scene");
      keys.add("interactive");
      node.scene = readDrawing(node.scene);
      if (
        node.interactive !== undefined &&
        typeof node.interactive !== "boolean"
      )
        throw Error("绘图 interactive 必须为布尔值");
      drawingPixels += node.scene.width * node.scene.height;
      drawingCommands += node.scene.commands.length;
      drawingPoints += node.scene.commands.reduce(
        (n, c) => n + (c.points?.length || 0),
        0,
      );
      if (
        drawingPixels > 4194304 ||
        drawingCommands > 2048 ||
        drawingPoints > 8192
      )
        throw Error("面板绘图总预算：4194304 像素、2048 图元、8192 折线点");
    }
    if (["row", "column", "panel", "disclosure"].includes(node.type)) {
      keys.add("children");
      if (!Array.isArray(node.children) || node.children.length > 64)
        throw Error("容器需提供 children");
      node.children.forEach((x) => visit(x, depth + 1));
    }
    if (node.type === "disclosure") {
      keys.add("defaultExpanded");
      if (
        node.defaultExpanded !== undefined &&
        typeof node.defaultExpanded !== "boolean"
      )
        throw Error("折叠分组 defaultExpanded 必须为布尔值");
    }
    if (node.type === "textarea") {
      keys.add("rows");
      if (
        node.rows !== undefined &&
        (!Number.isInteger(node.rows) || node.rows < 2 || node.rows > 20)
      )
        throw Error("多行输入 rows 必须为 2–20 的整数");
    }
    if (["toggle", "input", "textarea", "number", "select"].includes(node.type))
      keys.add("value");
    if (node.type === "toggle" && typeof node.value !== "boolean")
      throw Error("开关 value 必须是布尔值");
    if (
      ["input", "textarea", "select"].includes(node.type) &&
      typeof node.value !== "string"
    )
      throw Error("文本/选择 value 必须为字符串");
    if (node.type === "number") {
      for (const name of ["min", "max", "step"]) keys.add(name);
      if (
        !Number.isFinite(node.value) ||
        ["min", "max", "step"].some(
          (k) => node[k] !== undefined && !Number.isFinite(node[k]),
        ) ||
        node.min > node.max ||
        (node.step !== undefined && node.step <= 0)
      )
        throw Error("数值控件范围无效");
    }
    if (node.type === "select") {
      keys.add("options");
      if (
        !Array.isArray(node.options) ||
        node.options.length > 100 ||
        node.options.some(
          (o) =>
            !o ||
            typeof o.label !== "string" ||
            typeof o.value !== "string" ||
            o.label.length > 200 ||
            o.value.length > 200 ||
            Object.keys(o).some((k) => !["label", "value"].includes(k)),
        ) ||
        new Set(node.options.map((o) => o.value)).size !==
          node.options.length ||
        !node.options.some((o) => o.value === node.value)
      )
        throw Error("选项无效或当前值不在选项中");
    }
    if (Object.keys(node).some((k) => !keys.has(k)))
      throw Error("UI 声明含未开放字段");
    for (const k of ["label", "text", "value"])
      if (typeof node[k] === "string" && node[k].length > 4000)
        throw Error("控件文本过长");
    for (const k of ["label", "text"])
      if (node[k] !== undefined && typeof node[k] !== "string")
        throw Error("控件文字必须是字符串");
    if (node.disabled !== undefined && typeof node.disabled !== "boolean")
      throw Error("disabled 必须是布尔值");
  }
  visit(tree);
  return tree;
}
export const extensionUiContract = {
  version: "1.0.0",
  transport: "json",
  scoped: true,
  methods: {
    inspect: {
      capability: "extension.ui.inspect",
      arguments: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: {
          type: "object",
          properties: {
            owner: { type: "string", minLength: 1, maxLength: 160 },
          },
          required: ["owner"],
          additionalProperties: false,
        },
      },
      returns: { type: "object" },
    },
    ...Object.fromEntries(
      ["create", "update", "remove", "events"].map((name) => [
        name,
        {
          capability: "extension.ui",
          arguments: {
            type: "array",
            minItems: 1,
            maxItems: 1,
            items: { type: "object" },
          },
          returns: { type: "object" },
        },
      ]),
    ),
  },
};

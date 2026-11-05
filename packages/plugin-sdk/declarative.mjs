import { extensionJson } from "./extension-protocol.mjs";
import { readUiTree, readPanelPlacement } from "./extension-ui.mjs";
export const declarationApi = "studio.declarations";
const targets = ["selection", "all", "selection-or-all"];
/** 仅描述有限控件和已公开的工作流操作，不接受脚本、表达式或任意 API 名称。 */
export function readDeclaration(input) {
  const d = extensionJson(input);
  const exact = (v, keys, message) => {
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).some((k) => !keys.includes(k))
    )
      throw Error(message);
  };
  exact(d, ["schemaVersion", "panel", "tree", "actions"], "声明式插件字段无效");
  if (d.schemaVersion !== 1) throw Error("声明式插件仅支持 schemaVersion 1");
  exact(d.panel, ["id", "title", "side", "placement"], "面板声明无效");
  Object.assign(d.panel, readPanelPlacement(d.panel));
  if (
    !/^[a-z][a-z0-9.-]{0,59}$/.test(d.panel.id || "") ||
    typeof d.panel.title !== "string" ||
    !d.panel.title.trim() ||
    d.panel.title.length > 100 ||
    !["left", "right", "bottom"].includes(d.panel.side)
  )
    throw Error("面板 ID、标题或位置无效");
  d.tree = readUiTree(d.tree);
  const controls = new Map();
  const collect = (n) => {
    if (n.id.startsWith("declaration-"))
      throw Error("declaration- 是保留控件前缀");
    controls.set(n.id, n);
    n.children?.forEach(collect);
  };
  collect(d.tree);
  readUiTree({
    id: "declaration-root",
    type: "column",
    children: [d.tree, { id: "declaration-status", type: "text", text: "" }],
  });
  if (controls.size > 250) throw Error("声明式插件最多 250 个自定义控件");
  if (!Array.isArray(d.actions) || d.actions.length > 64)
    throw Error("最多声明 64 个按钮动作");
  const seen = new Set();
  const binding = (value, type) => {
    if (
      typeof value === type &&
      (type !== "number" ||
        (Number.isFinite(value) && Math.abs(value) <= 100000))
    )
      return;
    exact(value, ["control"], "动作参数必须是常量或控件引用");
    const n = controls.get(value.control);
    if (
      !n ||
      (type === "number"
        ? n.type !== "number"
        : !["input", "textarea", "select"].includes(n.type))
    )
      throw Error("动作参数引用的控件不存在或类型错误");
  };
  for (const a of d.actions) {
    exact(
      a,
      ["on", "kind", "target", "dx", "dy", "title", "stage"],
      "动作字段无效",
    );
    if (controls.get(a.on)?.type !== "button" || seen.has(a.on))
      throw Error("每个动作必须绑定唯一按钮");
    seen.add(a.on);
    const keys = ["on", "kind"];
    if (a.kind === "move") {
      keys.push("target", "dx", "dy");
      binding(a.dx, "number");
      binding(a.dy, "number");
    } else if (a.kind === "rename") {
      keys.push("target", "title");
      binding(a.title, "string");
      if (typeof a.title === "string" && a.title.length > 100)
        throw Error("节点名称过长");
    } else if (a.kind === "stage") {
      keys.push("stage");
      if (!["vertex", "fragment"].includes(a.stage)) throw Error("阶段无效");
    } else if (!["summary", "undo", "redo"].includes(a.kind))
      throw Error("未开放的声明式动作");
    if (["move", "rename"].includes(a.kind) && !targets.includes(a.target))
      throw Error("节点目标无效");
    if (Object.keys(a).some((k) => !keys.includes(k)))
      throw Error("动作含不适用的参数");
  }
  return d;
}
/** 权限由实际动作推导，不允许声明文件隐瞒写权限或调用其他服务。 */
export function declarationRequirements(definition) {
  const d = readDeclaration(definition);
  return {
    requiredApis: {
      "studio.declarations": "^1.0.0",
      "studio.extension-ui": "^1.0.0",
      "workflow.editor": "^1.0.0",
    },
    capabilities: [
      "declarations.mount",
      "extension.ui",
      "workflow.read",
      ...(d.actions.some((a) => a.kind !== "summary")
        ? ["workflow.write"]
        : []),
    ],
  };
}
/** 新建表单的可编辑默认值，只有 JSON，不生成入口脚本。 */
export function defaultDeclaration() {
  return {
    schemaVersion: 1,
    panel: { id: "panel", title: "声明式节点工具", side: "bottom" },
    tree: {
      id: "root",
      type: "column",
      children: [
        {
          id: "dx",
          type: "number",
          label: "水平位移",
          value: 32,
          min: -100000,
          max: 100000,
        },
        {
          id: "dy",
          type: "number",
          label: "垂直位移",
          value: 0,
          min: -100000,
          max: 100000,
        },
        { id: "move", type: "button", label: "移动节点" },
        { id: "undo", type: "button", label: "撤销" },
        { id: "summary", type: "button", label: "读取工作流信息" },
      ],
    },
    actions: [
      {
        on: "move",
        kind: "move",
        target: "selection-or-all",
        dx: { control: "dx" },
        dy: { control: "dy" },
      },
      { on: "undo", kind: "undo" },
      { on: "summary", kind: "summary" },
    ],
  };
}

import { readDeclaration } from "../../packages/plugin-sdk/declarative.mjs";
export const containerTypes = ["column", "row", "panel", "disclosure"];
/** 编辑器只操作声明副本，路径是子节点索引，与用户可编辑的 ID 分离。 */
export function layoutRows(tree) {
  const rows = [];
  function visit(node, path = [], parent = null, index = 0) {
    rows.push({ node, path, parent, index });
    node.children?.forEach((child, i) => visit(child, [...path, i], node, i));
  }
  visit(tree);
  return rows;
}
export function nodeAt(tree, path) {
  let node = tree;
  for (const index of path) {
    if (!Number.isInteger(index) || index < 0 || !node.children?.[index])
      throw Error("控件位置已变化，请重新选择");
    node = node.children[index];
  }
  return node;
}
const contains = (ancestor, path) =>
  ancestor.length <= path.length && ancestor.every((n, i) => n === path[i]);
/** 原子移动整个子树，禁止移入自己或后代，超出深度/数量限制时保留原声明。 */
export function moveControl(definition, source, destination) {
  if (!source.length) throw Error("不能移动根布局");
  if (contains(source, destination)) throw Error("不能将分组移动到自己或后代");
  const d = structuredClone(definition),
    node = nodeAt(d.tree, source),
    target = nodeAt(d.tree, destination);
  if (!containerTypes.includes(target.type)) throw Error("目标必须是布局容器");
  const parent = nodeAt(d.tree, source.slice(0, -1));
  if (parent === target) return d;
  parent.children.splice(source.at(-1), 1);
  target.children.push(node);
  return readDeclaration(d);
}
/** 删除整个分组时，一并删除内部按钮动作，外部按钮仍引用其中字段则拒绝。 */
export function removeControl(definition, path) {
  if (!path.length) throw Error("不能删除根布局");
  const d = structuredClone(definition),
    node = nodeAt(d.tree, path);
  const ids = new Set(layoutRows(node).map((r) => r.node.id));
  const remaining = d.actions.filter((a) => !ids.has(a.on));
  if (
    remaining.some((a) =>
      ["dx", "dy", "title"].some((k) => ids.has(a[k]?.control)),
    )
  )
    throw Error("该分组或字段仍被外部按钮引用，请先修改按钮参数");
  d.actions = remaining;
  nodeAt(d.tree, path.slice(0, -1)).children.splice(path.at(-1), 1);
  return readDeclaration(d);
}
/** 改名保留跨容器的按钮绑定，完整提交仍通过 SDK 校验。 */
export function renameControl(definition, path, id) {
  const d = structuredClone(definition),
    node = nodeAt(d.tree, path),
    old = node.id;
  node.id = id;
  for (const a of d.actions) {
    if (a.on === old) a.on = id;
    for (const k of ["dx", "dy", "title"])
      if (a[k]?.control === old) a[k] = { control: id };
  }
  return d;
}

/** 快捷键的公开纯数据工具。Mod 表示 Windows/Linux Ctrl 或 macOS Command。 */
export function normalizeShortcut(text) {
  if (typeof text !== "string" || text.length > 80) throw Error("无效快捷键");
  const parts = text.split("+").map((x) => x.trim());
  const key = parts.pop();
  if (
    !key ||
    parts.some((x) => !["Mod", "Shift", "Alt"].includes(x)) ||
    new Set(parts).size !== parts.length
  )
    throw Error("使用 Mod、Shift、Alt 加一个按键，例如 Mod+Shift+Z");
  const name = key.length === 1 ? key.toUpperCase() : key;
  if (
    !/^(?:[A-Z0-9=,./;\[\]`'\\-]|F(?:[1-9]|1[0-2])|Backspace|Delete|Escape|Home|End|PageUp|PageDown|Arrow(?:Left|Right|Up|Down)|Space|Enter|Tab)$/.test(
      name,
    )
  )
    throw Error("不支持的按键：" + key);
  return [
    ...["Mod", "Alt", "Shift"].filter((x) => parts.includes(x)),
    name,
  ].join("+");
}
/** 只描述按键，组合输入、AltGr 与纯修饰键不作为应用命令。 */
export function shortcutFromEvent(event) {
  if (
    event.isComposing ||
    event.keyCode === 229 ||
    event.getModifierState?.("AltGraph")
  )
    return null;
  let key = event.key;
  if (["Control", "Meta", "Alt", "Shift", "Dead", "Process"].includes(key))
    return null;
  if (key === " ") key = "Space";
  if (key === "+") key = "=";
  try {
    return normalizeShortcut(
      [
        ...(event.ctrlKey || event.metaKey ? ["Mod"] : []),
        ...(event.altKey ? ["Alt"] : []),
        ...(event.shiftKey ? ["Shift"] : []),
        key,
      ].join("+"),
    );
  } catch {
    return null;
  }
}
/** 编辑控件使用自己的文字/导航行为，热键不得拦截文本删除或输入法。 */
export function isShortcutEditing(target) {
  return !!target?.closest?.(
    'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
  );
}

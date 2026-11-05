import { isShortcutEditing } from "../../packages/plugin-sdk/shortcuts.mjs";
/** 按键只在当前画布执行，输入框、对话框和输入法保持自己的行为。 */
export function createGraphKeyboard(
  s: any,
  root: any,
  menu: any,
  selection: any,
  world: any,
  cancel: () => void,
) {
  const center = () => {
    const r = root.value.getBoundingClientRect();
    return world(r.x + r.width / 2, r.y + r.height / 2);
  };
  const zoom = (factor: number, absolute = false) => {
    const v = s.snapshot.value.view,
      p = center(),
      r = root.value.getBoundingClientRect();
    const z = Math.min(
      2.5,
      Math.max(0.25, absolute ? factor : v.zoom * factor),
    );
    return s.action("SET_VIEW", {
      zoom: z,
      x: r.width / 2 - p.x * z,
      y: r.height / 2 - p.y * z,
    });
  };
  const fit = () => {
    const nodes = s.snapshot.value.graph.nodes;
    if (!nodes.length) return;
    const x = Math.min(...nodes.map((n: any) => n.canvasX)),
      y = Math.min(...nodes.map((n: any) => n.canvasY));
    const right = Math.max(
      ...nodes.map(
        (n: any) =>
          n.canvasX +
          (root.value.querySelector(`[data-id="${CSS.escape(n.id)}"]`)
            ?.offsetWidth || 220),
      ),
    );
    const bottom = Math.max(
      ...nodes.map(
        (n: any) =>
          n.canvasY +
          (root.value.querySelector(`[data-id="${CSS.escape(n.id)}"]`)
            ?.offsetHeight || 240),
      ),
    );
    const r = root.value.getBoundingClientRect(),
      z = Math.min(
        1.5,
        Math.max(
          0.25,
          Math.min(
            (r.width - 80) / (right - x),
            (r.height - 80) / (bottom - y),
          ),
        ),
      );
    return s.action("SET_VIEW", {
      zoom: z,
      x: (r.width - (right - x) * z) / 2 - x * z,
      y: (r.height - (bottom - y) * z) / 2 - y * z,
    });
  };
  return function keyboard(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (
      (!root.value?.contains(target) && !target?.closest('[data-stage]')) ||
      isShortcutEditing(target) ||
      target.closest("dialog,[role=dialog]")
    )
      return;
    const id = s.shortcuts
      .resolve(event, "graph")
      ?.replace("studio.workflow-ui.", "");
    if (!id) return;
    const selected = selection.value.length > 0;
    const actions: Record<string, () => unknown> = {
      "select-all": () =>
        s.select(s.snapshot.value.graph.nodes.map((n: any) => n.id)),
      deselect: () => s.select([]),
      copy: () => selected && s.copy(),
      cut: () => selected && s.cut(),
      paste: () =>
        s.hasClipboard() && s.paste(menu.visible ? menu.world : center()),
      duplicate: async () => {
        if (selected) {
          s.copy();
          await s.paste(center());
        }
      },
      undo: () => s.action("UNDO"),
      redo: () => s.action("REDO"),
      delete: () => selected && s.action("DELETE_SELECTED"),
      cancel: () => {
        menu.visible = false;
        cancel();
        return s.select([]);
      },
      rename: () => {
        if (selected) s.model.renameSignal++;
      },
      preview: () => selected && s.action("TOGGLE_SELECTED_PREVIEW"),
      disconnect: () => selected && s.action("DISCONNECT_SELECTED"),
      layout: () => s.action("AUTO_LAYOUT"),
      fit,
      "zoom-in": () => zoom(1.15),
      "zoom-out": () => zoom(1 / 1.15),
      "zoom-reset": () => zoom(1, true),
      stage: () =>
        s.action("SET_STAGE", {
          stage: s.snapshot.value.stage === "vertex" ? "fragment" : "vertex",
        }),
    };
    if (actions[id]) {
      event.preventDefault();
      void s.run(actions[id]);
    }
  };
}

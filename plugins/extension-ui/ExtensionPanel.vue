<script lang="ts">
import { defineComponent, h, type PropType, type Component } from "vue";
/** 只将受检 JSON 映射到公共组件，没有 v-html、动态脚本或私有 DOM 访问。 */
export default defineComponent({
  props: {
    controls: {
      type: Object as PropType<Readonly<Record<string, Component>>>,
      required: true,
    },
    model: { type: Object, required: true },
    send: { type: Function, required: true },
  },
  setup(props) {
    function render(node: any): any {
      const revision = props.model.revision;
      const c = props.controls,
        emit = (type: string, value: unknown = null) =>
          props.send({ controlId: node.id, type, value, revision });
      const base = {
        key: node.id,
        disabled: !!node.disabled,
        "aria-label": node.label || node.id,
        "data-extension-control": node.id,
      };
      if (node.type === "text")
        return h("p", { key: node.id }, node.text || node.label || "");
      if (node.type === "drawing")
        return h(c.UiDrawingSurface, {
          ...base,
          scene: node.scene,
          label: node.label || node.id,
          interactive: !!node.interactive,
          onPoint: (value: unknown) => emit("point", value),
        });
      if (node.type === "disclosure")
        return h(
          c.UiDisclosure,
          {
            key: node.id,
            title: node.label || node.id,
            defaultExpanded: !!node.defaultExpanded,
            "data-extension-control": node.id,
          },
          () =>
            h(
              "div",
              { class: "extension-group column" },
              node.children.map(render),
            ),
        );
      if (["row", "column", "panel"].includes(node.type))
        return h(
          "div",
          { key: node.id, class: ["extension-group", node.type] },
          [
            node.label ? h("strong", node.label) : null,
            ...node.children.map(render),
          ],
        );
      if (node.type === "button")
        return h(
          c.UiButton,
          { ...base, onClick: () => emit("click") },
          () => node.label || node.id,
        );
      if (node.type === "toggle")
        return h(c.UiToggle, {
          ...base,
          modelValue: node.value,
          label: node.label,
          "onUpdate:modelValue": (v: boolean) => emit("change", v),
        });
      const control =
        node.type === "select"
          ? c.UiSelect
          : node.type === "textarea"
            ? c.UiTextarea
            : c.UiInput;
      const field = h(control, {
        ...base,
        ...(node.type === "number"
          ? { type: "number", min: node.min, max: node.max, step: node.step }
          : {}),
        ...(node.type === "select" ? { options: node.options } : {}),
        ...(node.type === "textarea"
          ? { rows: node.rows || 4, maxlength: 4000 }
          : {}),
        modelValue: node.value,
        "onUpdate:modelValue": (v: unknown) => {
          const value = node.type === "number" ? Number(v) : String(v);
          if (
            node.type !== "number" ||
            (Number.isFinite(value) &&
              !(Number(value) < node.min || Number(value) > node.max))
          )
            emit("change", value);
        },
      });
      return h(
        c.UiField,
        { key: node.id, label: node.label || node.id },
        () => field,
      );
    }
    return () =>
      h("div", { class: "extension-panel" }, [render(props.model.tree)]);
  },
});
</script>
<style scoped>
.extension-panel {
  padding: 10px;
  overflow: auto;
  min-width: 0;
}
.extension-group {
  display: flex;
  gap: 8px;
  min-width: 0;
}
.column,
.panel {
  flex-direction: column;
}
.row {
  flex-wrap: wrap;
  align-items: center;
}
.panel {
  padding: 10px;
  border: 1px solid var(--color-border);
}
.extension-group p {
  margin: 4px 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>

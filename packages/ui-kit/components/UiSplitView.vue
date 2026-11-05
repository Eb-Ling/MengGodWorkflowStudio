<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import type { UiSplitViewProps } from "../types";
const props = withDefaults(defineProps<UiSplitViewProps>(), {
  size: 222,
  min: 120,
  max: 600,
  reserve: 180,
  label: "调整面板大小",
});
const emit = defineEmits<{ "update:size": [value: number] }>();
const root = ref<HTMLElement>(),
  separator = ref<HTMLElement>(),
  length = ref(10000);
const maximum = computed(() =>
  Math.max(0, Math.min(props.max, length.value - props.reserve - 6)),
);
const minimum = computed(() => Math.min(props.min, maximum.value));
const size = computed(() =>
  Math.max(minimum.value, Math.min(maximum.value, props.size)),
);
let drag: { id: number; origin: number; size: number } | null = null,
  observer: ResizeObserver | undefined;
const clamp = (v: number) =>
  Math.max(minimum.value, Math.min(maximum.value, v));
function start(e: PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  separator.value?.focus();
  separator.value?.setPointerCapture(e.pointerId);
  drag = {
    id: e.pointerId,
    origin: props.vertical ? e.clientY : e.clientX,
    size: size.value,
  };
}
function move(e: PointerEvent) {
  if (!drag || drag.id !== e.pointerId) return;
  emit(
    "update:size",
    clamp(
      drag.size +
        ((props.vertical ? e.clientY : e.clientX) - drag.origin) *
          (props.reverse ? -1 : 1),
    ),
  );
}
function stop() {
  if (drag && separator.value?.hasPointerCapture(drag.id))
    separator.value.releasePointerCapture(drag.id);
  drag = null;
}
function key(e: KeyboardEvent) {
  let next: number | undefined;
  const step = e.shiftKey ? 32 : 8;
  if (e.key === "Home") next = minimum.value;
  else if (e.key === "End") next = maximum.value;
  else if (
    [
      props.vertical ? "ArrowUp" : "ArrowLeft",
      props.vertical ? "ArrowDown" : "ArrowRight",
    ].includes(e.key)
  )
    next =
      size.value +
      (e.key === (props.vertical ? "ArrowUp" : "ArrowLeft") ? -step : step) *
        (props.reverse ? -1 : 1);
  if (next !== undefined) {
    e.preventDefault();
    emit("update:size", clamp(next));
  }
}
watch(() => props.vertical, stop);
onMounted(() => {
  observer = new ResizeObserver(() => {
    length.value = props.vertical
      ? root.value!.clientHeight
      : root.value!.clientWidth;
  });
  observer.observe(root.value!);
});
onBeforeUnmount(() => {
  stop();
  observer?.disconnect();
});
const fixed = computed(() => ({ flex: "0 0 " + size.value + "px" }));
</script>
<template>
  <div ref="root" class="ui-split-view" :class="{ vertical }">
    <div class="ui-split-pane" :style="reverse ? undefined : fixed">
      <slot name="first" />
    </div>
    <div
      ref="separator"
      class="ui-split-separator"
      role="separator"
      tabindex="0"
      :aria-label="label"
      :aria-orientation="vertical ? 'horizontal' : 'vertical'"
      :aria-valuemin="Math.round(minimum)"
      :aria-valuemax="Math.round(maximum)"
      :aria-valuenow="Math.round(size)"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="stop"
      @pointercancel="stop"
      @lostpointercapture="stop"
      @keydown="key"
    />
    <div class="ui-split-pane" :style="reverse ? fixed : undefined">
      <slot name="second" />
    </div>
  </div>
</template>
<style scoped>
.ui-split-view {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  height: 100%;
  width: 100%;
}
.ui-split-view.vertical {
  flex-direction: column;
}
.ui-split-pane {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
}
.ui-split-separator {
  flex: 0 0 6px;
  cursor: col-resize;
  background: var(--color-bg);
  touch-action: none;
}
.vertical > .ui-split-separator {
  cursor: row-resize;
}
.ui-split-separator:hover,
.ui-split-separator:focus-visible {
  background: var(--color-primary);
  outline: none;
}
</style>

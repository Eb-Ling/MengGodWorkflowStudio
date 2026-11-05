<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import type {
  DrawingScene,
  DrawingPoint,
} from "../../plugin-sdk/drawing-types";
import { paintDrawing, drawingPoint } from "../drawing.mjs";
const props = defineProps<{
  scene: DrawingScene;
  label: string;
  interactive?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ point: [value: DrawingPoint] }>();
const canvas = ref<HTMLCanvasElement>(),
  error = ref("");
let frame = 0,
  ready = false,
  rendered: DrawingScene;
function queue() {
  ready = false;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (!canvas.value) return;
    try {
      rendered = paintDrawing(canvas.value, props.scene);
      error.value = "";
      ready = true;
    } catch (e) {
      error.value = String(e);
    }
  });
}
function point(event: MouseEvent) {
  if (
    !props.interactive ||
    props.disabled ||
    !ready ||
    event.button !== 0 ||
    !canvas.value
  )
    return;
  const value = drawingPoint(
    rendered,
    canvas.value.getBoundingClientRect(),
    event.clientX,
    event.clientY,
  );
  if (value) emit("point", value);
}
function key(event: KeyboardEvent) {
  if (
    !props.interactive ||
    props.disabled ||
    !ready ||
    !["Enter", " "].includes(event.key)
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat)
    emit("point", { x: rendered.width / 2, y: rendered.height / 2 });
}
watch(() => props.scene, queue, { deep: true, flush: "post" });
onMounted(queue);
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  ready = false;
  if (canvas.value) {
    canvas.value.width = 1;
    canvas.value.height = 1;
  }
});
</script>
<template>
  <div class="ui-drawing-surface">
    <canvas
      ref="canvas"
      :role="interactive ? 'button' : 'img'"
      :aria-label="label"
      :aria-disabled="disabled || undefined"
      :tabindex="interactive && !disabled ? 0 : undefined"
      @click="point"
      @keydown="key"
      >{{ label }}</canvas
    >
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
<style scoped>
.ui-drawing-surface {
  min-width: 0;
  max-width: 100%;
}
canvas {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md, 6px);
}
canvas[role="button"] {
  cursor: crosshair;
}
canvas:focus-visible {
  outline: 2px solid var(--color-accent, #77aaff);
  outline-offset: 2px;
}
canvas[aria-disabled="true"] {
  cursor: default;
  opacity: 0.6;
}
p {
  color: var(--color-danger, #ef8888);
}
</style>

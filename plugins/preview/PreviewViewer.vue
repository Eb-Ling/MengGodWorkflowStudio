<script setup lang="ts">
import {
  ref,
  reactive,
  watch,
  nextTick,
  onBeforeUnmount,
  onMounted,
} from "vue";
import type { Component } from "vue";
import { fitView, zoomView } from "./view-transform.mjs";
const props = defineProps<{
  shortcuts: any;
  controls: Record<string, Component>;
  model: {
    visible: boolean;
    busy: boolean;
    error: string;
    width: number;
    height: number;
    longEdge: number;
    time: number;
    playing: boolean;
    title: string;
    outputs: { name: string; type: string }[];
    socket: string;
  };
  actions: {
    attachCanvas(target: HTMLCanvasElement | null): void;
    setPlayback(input: { playing?: boolean; time?: number }): void;
    setPageVisible(visible: boolean): void;
    setViewport(region: {left:number;top:number;right:number;bottom:number} | null | undefined): void;
    refresh(): void;
    close(): void;
    selectSocket(socket: string): void;
  };
}>();
const { UiDialog, UiButton, UiInput, UiToggle } = props.controls;
const viewport = ref<HTMLElement>(), canvas = ref<HTMLCanvasElement>(),
  view = reactive({ scale: 1, x: 0, y: 0 });
let observer: ResizeObserver | undefined,
  drag: { x: number; y: number; left: number; top: number; id: number } | null =
    null;
function fit() {
  const box = viewport.value?.getBoundingClientRect();
  if (box && props.model.width)
    Object.assign(
      view,
      fitView(props.model.width, props.model.height, box.width, box.height),
    );
}
function zoom(scale: number, anchor?: { x: number; y: number }) {
  const box = viewport.value?.getBoundingClientRect();
  if (box)
    Object.assign(
      view,
      zoomView(view, scale, anchor || { x: box.width / 2, y: box.height / 2 }),
    );
}
function wheel(event: WheelEvent) {
  const box = viewport.value!.getBoundingClientRect();
  zoom(view.scale * Math.exp(-event.deltaY * 0.002), {
    x: event.clientX - box.left,
    y: event.clientY - box.top,
  });
}
function down(event: PointerEvent) {
  if (event.button !== 0) return;
  viewport.value!.setPointerCapture(event.pointerId);
  drag = {
    x: event.clientX,
    y: event.clientY,
    left: view.x,
    top: view.y,
    id: event.pointerId,
  };
}
function move(event: PointerEvent) {
  if (drag?.id === event.pointerId) {
    view.x = drag.left + event.clientX - drag.x;
    view.y = drag.top + event.clientY - drag.y;
  }
}
function up() {
  drag = null;
}
function resolution(edge: number) {
  props.model.longEdge = edge;
  props.actions.refresh();
}
function keyboard(event: KeyboardEvent) {
  const id = props.shortcuts.resolve(event, "preview");
  const actions: Record<string, () => void> = {
    "studio.preview.fit": fit,
    "studio.preview.actual": () => zoom(1),
    "studio.preview.zoom-in": () => zoom(view.scale * 1.25),
    "studio.preview.zoom-out": () => zoom(view.scale / 1.25),
  };
  if (id && actions[id]) {
    event.preventDefault();
    actions[id]();
  }
}
let visibilityFrame = 0;
let onScreen: IntersectionObserver | undefined;
function updateRegion() {
  visibilityFrame = 0;
  if (!props.model.visible || !canvas.value || !viewport.value || !props.model.width) return;
  const image = canvas.value.getBoundingClientRect(), box = viewport.value.getBoundingClientRect();
  const left = Math.max(0, box.left, image.left), top = Math.max(0, box.top, image.top);
  const right = Math.min(window.innerWidth, box.right, image.right), bottom = Math.min(window.innerHeight, box.bottom, image.bottom);
  if (right <= left || bottom <= top) props.actions.setViewport(null);
  else if (left === image.left && right === image.right && top === image.top && bottom === image.bottom)
    props.actions.setViewport(undefined);
  else props.actions.setViewport({ left: (left - image.left) / image.width, top: (top - image.top) / image.height,
    right: (right - image.left) / image.width, bottom: (bottom - image.top) / image.height });
}
function scheduleRegion() {
  if (!visibilityFrame) visibilityFrame = requestAnimationFrame(updateRegion);
}
watch([() => view.x, () => view.y, () => view.scale, () => props.model.width, () => props.model.height], scheduleRegion, { flush: "post" });
watch(canvas, (element) => {
  onScreen?.disconnect();
  props.actions.attachCanvas(element ?? null);
  if (element) {
    onScreen = new IntersectionObserver(scheduleRegion);
    onScreen.observe(element);
    scheduleRegion();
  }
}, { flush: "post" });
function pageVisibility() {
  props.actions.setPageVisible(!document.hidden);
  if (!document.hidden) scheduleRegion();
}
onMounted(() => {
  pageVisibility();
  document.addEventListener("visibilitychange", pageVisibility);
});
function seek(event: Event) {
  const input = event.target as HTMLInputElement;
  if (Number.isFinite(input.valueAsNumber)) props.actions.setPlayback({ time: input.valueAsNumber, playing: false });
  else input.value = String(props.model.time);
}
watch(
  () => [props.model.width, props.model.height, props.model.visible],
  async () => {
    await nextTick();
    fit();
  },
);
watch(viewport, (element) => {
  observer?.disconnect();
  if (element) {
    observer = new ResizeObserver(() => { fit(); scheduleRegion(); });
    observer.observe(element);
  }
}, { flush: "post" });
onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", pageVisibility);
  cancelAnimationFrame(visibilityFrame);
  onScreen?.disconnect();
  observer?.disconnect();
  props.actions.attachCanvas(null);
});
</script>
<template>
  <UiDialog
    id="gpu-preview-viewer"
    class="gpu-preview-dialog"
    :title="model.title || 'GPU 高清预览'"
    :visible="model.visible"
    description="独立 GPU 重新渲染 · 滚轮缩放 · 按住拖动 · 不修改工作流分辨率"
    @close="actions.close"
  >
    <div class="preview-tools">
      <span>长边像素</span
      ><UiButton
        v-for="edge in [1024, 2048, 4096]"
        :key="edge"
        :data-resolution="edge"
        :aria-pressed="model.longEdge === edge"
        :disabled="model.busy && !model.width"
        @click="resolution(edge)"
        >{{ edge }}</UiButton
      >
      <UiButton data-preview-action="fit" @click="fit">适应窗口</UiButton
      ><UiButton data-preview-action="actual" @click="zoom(1)">1:1</UiButton>
      <UiButton aria-label="缩小预览" @click="zoom(view.scale / 1.25)"
        >−</UiButton
      ><span class="preview-scale">{{ Math.round(view.scale * 100) }}%</span
      ><UiButton aria-label="放大预览" @click="zoom(view.scale * 1.25)"
        >＋</UiButton
      >
      <label
        >时间（秒）<UiInput
          data-preview-time
          type="number"
          step="0.1"
          :model-value="String(Number(model.time.toFixed(2)))"
          :readonly="model.playing"
          @change="seek" /></label
      ><UiToggle
        :model-value="model.playing"
        @update:model-value="actions.setPlayback({ playing: $event })"
        >{{ model.playing ? "暂停" : "播放" }}</UiToggle
      ><UiButton
        data-preview-action="refresh"
        :disabled="model.busy && !model.width"
        @click="actions.refresh"
        >重新渲染</UiButton
      >
    </div>
    <div v-if="model.outputs.length > 1" class="preview-tools">
      <span>节点输出</span
      ><UiButton
        v-for="port in model.outputs"
        :key="port.name"
        :data-preview-socket="port.name"
        :aria-pressed="model.socket === port.name"
          :disabled="model.busy && !model.width"
        @click="actions.selectSocket(port.name)"
        >{{ port.name }} · {{ port.type }}</UiButton
      >
    </div>
    <div
      v-if="model.visible"
      ref="viewport"
      class="preview-viewport"
      tabindex="0"
      aria-label="可缩放 GPU 预览"
      @wheel.prevent="wheel"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
      @lostpointercapture="up"
      @keydown="keyboard"
    >
      <canvas
        ref="canvas"
        aria-label="GPU 高清预览渲染结果"
        :style="{
          transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`,
        }"
      />
      <div
        v-if="(model.busy && !model.width) || model.error"
        class="preview-notice"
        role="status"
      >
        {{ model.error || "正在 GPU 渲染…" }}
      </div>
    </div>
    <div class="preview-info" aria-live="polite">
      <span data-preview-size>{{ model.width }} × {{ model.height }} 像素</span
      ><span>缩放只改变查看比例，更高清晰度请选择更大的长边像素。</span>
    </div>
  </UiDialog>
</template>
<style scoped>
.gpu-preview-dialog {
  width: min(1240px, 94vw);
  max-width: 94vw;
}
.preview-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.preview-tools label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.preview-tools :deep(input) {
  width: 90px;
}
.preview-tools [aria-pressed="true"] {
  outline: 1px solid var(--accent, #60a5fa);
}
.preview-viewport {
  height: min(65vh, 800px);
  min-height: 240px;
  position: relative;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  border: 1px solid var(--border, #374151);
  border-radius: 8px;
  background-color: #171c25;
  background-image:
    linear-gradient(45deg, #242b36 25%, transparent 25%),
    linear-gradient(-45deg, #242b36 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #242b36 75%),
    linear-gradient(-45deg, transparent 75%, #242b36 75%);
  background-size: 24px 24px;
  background-position:
    0 0,
    0 12px,
    12px -12px,
    -12px 0;
}
.preview-viewport:active {
  cursor: grabbing;
}
.preview-viewport canvas {
  position: absolute;
  left: 0;
  top: 0;
  max-width: none;
  max-height: none;
  transform-origin: 0 0;
  pointer-events: none;
  user-select: none;
}
.preview-notice {
  position: absolute;
  inset: 16px auto auto 16px;
  max-width: calc(100% - 32px);
  white-space: pre-wrap;
  padding: 12px;
  background: #18202ded;
  color: #e1e9f6;
  border-radius: 6px;
}
.preview-info {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 10px;
  font-size: 12px;
}
.preview-scale {
  min-width: 45px;
  text-align: center;
}
</style>

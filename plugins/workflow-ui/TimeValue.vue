<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
const props = defineProps<{ preview: any; controls?: any; field?: any; onCommit?: (value: string) => Promise<unknown> }>();
const display = ref("0.00"), draft = ref(""), editing = ref(false), error = ref("");
let dirty = false, live = true;
const label = ref<HTMLElement>();
let observer: IntersectionObserver | undefined, stop: (() => void) | undefined;
function observeTime(visible: boolean) {
  if (!visible) { stop?.(); stop = undefined; }
  else if (live && !stop) stop = props.preview.subscribePlayback(({ time }: { time: number }) => {
    display.value = time.toFixed(2);
  });
}
onMounted(() => {
  if (!label.value) { observeTime(true); return; }
  observer = new IntersectionObserver(([entry]) => observeTime(entry.isIntersecting),
    { root: label.value.closest(".graph-editor") });
  observer.observe(label.value);
});
onBeforeUnmount(() => { live = false; observer?.disconnect(); observeTime(false); });
function focus() {
  editing.value = true;
  dirty = false;
  draft.value = display.value;
}
function input(value: string) { dirty = true; draft.value = value; }
async function finish() {
  if (!editing.value) return;
  editing.value = false;
  if (!dirty) return;
  try {
    const n = Number(draft.value);
    if (!draft.value.trim() || !Number.isFinite(n)) throw Error("请输入有效的预览秒数。");
    await props.onCommit?.(String(n));
    error.value = "";
  } catch (e: any) { error.value = e.message; }
}
function escape(event: KeyboardEvent) {
  dirty = false;
  (event.target as HTMLInputElement).blur();
}
</script>
<template>
  <component v-if="field" :is="controls.UiField" class="field" :label="field.label" :error="error"
    hint="输入秒数后按回车，或点击别处确认。播放时从新时间继续，暂停时停在该值。">
    <component :is="controls.UiInput" :model-value="editing ? draft : display" :aria-label="field.label"
      inputmode="decimal" @focus="focus" @update:model-value="input" @blur="finish"
      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()" @keydown.esc.prevent="escape" />
  </component>
  <span v-else ref="label" class="node-time">{{ display }} 秒</span>
</template>
<style scoped>
.node-time { display: block; padding: 2px 10px; font-variant-numeric: tabular-nums; color: var(--color-text-muted); }
</style>

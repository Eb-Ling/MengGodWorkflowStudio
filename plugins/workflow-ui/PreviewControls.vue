<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from "vue";
const props = defineProps<{ session: any }>(),
  { UiToggle } = props.session.ui.components;
const clock = computed(() =>
  props.session.snapshot.value.graph.nodes.find(
    (n: any) => n.typeId === "input.time",
  ),
);
let timer: ReturnType<typeof setInterval> | undefined,
  start = 0;
const stop = () => {
  if (timer) clearInterval(timer);
  timer = undefined;
};
watch(
  [
    () => props.session.model.timeEnabled,
    () => clock.value?.id,
    () => clock.value?.properties.defaultValue,
    () => props.session.snapshot.value.stage,
  ],
  () => {
    stop();
    const base = Number(clock.value?.properties.defaultValue) || 0;
    props.session.model.time = base;
    if (props.session.model.timeEnabled && clock.value) {
      start = performance.now();
      timer = setInterval(
        () =>
          (props.session.model.time =
            base + (performance.now() - start) / 1000),
        83,
      );
    }
  },
  { immediate: true },
);
onBeforeUnmount(stop);
</script>
<template>
  <UiToggle
    v-if="clock"
    id="preview-time-toggle"
    title="仅驱动编辑器节点预览"
    v-model="session.model.timeEnabled"
    >预览时间：{{ session.model.timeEnabled ? "开" : "关" }}</UiToggle
  >
</template>

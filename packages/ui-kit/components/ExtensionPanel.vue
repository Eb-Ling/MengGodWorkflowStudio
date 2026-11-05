<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import type { Disposable } from "../../plugin-sdk/types";
const props = defineProps<{ mount(target: HTMLElement): Disposable }>();
const target = ref<HTMLElement>();
let instance: Disposable | undefined;
onMounted(() => {
  if (target.value) instance = props.mount(target.value);
});
onBeforeUnmount(() => {
  instance?.dispose();
});
</script>
<template><div ref="target" class="extension-panel-target"></div></template>

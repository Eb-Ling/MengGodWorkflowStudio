<script setup lang="ts">
import { ref } from "vue";
import UiButton from "./UiButton.vue";
defineProps<{
  items: { id: string; label: string; disabled?: boolean }[];
  label?: string;
}>();
const model = defineModel<string>({ default: "" });
const root = ref<HTMLElement>();
function key(event: KeyboardEvent) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const buttons = Array.from(
    root.value!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  );
  if (!buttons.length) return;
  event.preventDefault();
  let index = buttons.indexOf(event.target as HTMLButtonElement);
  index =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
          buttons.length;
  buttons[index].focus();
  buttons[index].click();
}
</script>
<template>
  <div
    ref="root"
    role="tablist"
    :aria-label="label"
    class="ui-tabs"
    @keydown="key"
  >
    <UiButton
      v-for="item in items"
      :key="item.id"
      role="tab"
      :aria-selected="model === item.id"
      :tabindex="model === item.id ? 0 : -1"
      :disabled="item.disabled"
      @click="model = item.id"
      >{{ item.label }}</UiButton
    >
  </div>
  <slot :active="model" />
</template>
<style scoped>
.ui-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ui-tabs [aria-selected="true"] {
  outline: 1px solid var(--color-primary);
}
</style>

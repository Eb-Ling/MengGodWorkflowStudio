<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from "vue";
import UiButton from "./UiButton.vue";
const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  items: { id: string; label: string; disabled?: boolean; danger?: boolean }[];
}>();
const emit = defineEmits<{ choose: [id: string]; close: [] }>();
const root = ref<HTMLElement>(),
  left = ref(0),
  top = ref(0);
const outside = (event: PointerEvent) => {
  if (!root.value?.contains(event.target as Node)) emit("close");
};
watch(
  () => [props.visible, props.x, props.y],
  async () => {
    window.removeEventListener("pointerdown", outside);
    if (!props.visible) return;
    await nextTick();
    const box = root.value?.getBoundingClientRect();
    if (!box) return;
    left.value = Math.max(
      8,
      Math.min(props.x, window.innerWidth - box.width - 8),
    );
    top.value = Math.max(
      8,
      Math.min(props.y, window.innerHeight - box.height - 8),
    );
    root.value
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    window.addEventListener("pointerdown", outside);
  },
  { immediate: true },
);
onBeforeUnmount(() => window.removeEventListener("pointerdown", outside));
function key(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const items = Array.from(
    root.value!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  );
  if (!items.length) return;
  const index = items.indexOf(event.target as HTMLButtonElement);
  items[
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
          items.length
  ].focus();
}
</script>
<template>
  <menu
    v-show="visible"
    ref="root"
    class="context-menu ui-menu"
    role="menu"
    :style="{ left: left + 'px', top: top + 'px' }"
    @keydown="key"
  >
    <UiButton
      v-for="item in items"
      :key="item.id"
      role="menuitem"
      :data-action="item.id"
      :disabled="item.disabled"
      :class="{ danger: item.danger }"
      @click="emit('choose', item.id)"
      >{{ item.label }}</UiButton
    >
  </menu>
</template>
<style scoped>
.ui-menu {
  position: fixed;
  z-index: 1000;
  margin: 0;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  overflow: auto;
}
</style>

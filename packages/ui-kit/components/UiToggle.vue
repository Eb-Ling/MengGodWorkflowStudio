<script setup lang="ts">
import UiButton from "./UiButton.vue";
import type { UiToggleProps } from "../types";
defineProps<UiToggleProps>();
defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>
<template>
  <UiButton
    class="ui-toggle"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="$emit('update:modelValue', !modelValue)"
    ><span
      class="ui-toggle-track"
      :class="{ checked: modelValue }"
      aria-hidden="true"
      ><span /></span
    ><slot>{{ label }}</slot></UiButton
  >
</template>
<style scoped>
.ui-toggle-track {
  display: inline-flex;
  width: 28px;
  height: 16px;
  border-radius: 9px;
  background: var(--color-border-strong);
  align-items: center;
  margin-right: 7px;
  padding: 2px;
  box-sizing: border-box;
}
.ui-toggle-track span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-text);
}
.ui-toggle-track.checked {
  background: var(--color-primary);
}
.checked span {
  transform: translateX(12px);
  background: var(--color-primary-text);
}
</style>

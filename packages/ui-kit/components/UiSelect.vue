<script setup lang="ts">
/** 原生选择框保留键盘与表单行为，选项可由 props 或插槽提供。 */
defineProps<{
  options?: { value: string; label: string; disabled?: boolean }[];
}>();
const model = defineModel<string>({ default: "" });
</script>
<template>
  <select v-model="model" class="ui-select">
    <slot
      ><option
        v-for="item in options"
        :key="item.value"
        :value="item.value"
        :disabled="item.disabled"
      >
        {{ item.label }}
      </option></slot
    >
  </select>
</template>
<style scoped>
.ui-select {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
}
.ui-select:focus {
  outline: 1px solid var(--color-primary);
}
</style>

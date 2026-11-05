<script setup lang="ts">
/** 多行输入支持原生 rows/spellcheck/键盘事件和 v-model。 */
const model = defineModel<string>({ default: "" });
</script>
<template><textarea v-model="model" class="ui-textarea" /></template>
<style scoped>
.ui-textarea {
  box-sizing: border-box;
  width: 100%;
  resize: vertical;
  padding: 8px 10px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
}
.ui-textarea:focus {
  outline: 1px solid var(--color-primary);
}
</style>

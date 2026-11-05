<script setup lang="ts">
/** 公共文本输入：支持原生表单属性、键盘和 v-model，统一使用主题令牌。 */
const model = defineModel<string>({ default: "" });
</script>
<template><input v-model="model" class="ui-input" /></template>
<style scoped>
.ui-input {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
}
.ui-input:focus {
  outline: 1px solid var(--color-primary);
}
.ui-input:read-only {
  color: var(--color-text-muted);
}
</style>

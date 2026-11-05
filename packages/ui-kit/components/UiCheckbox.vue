<script setup lang="ts">
/** 公共布尔输入：原生焦点与可访问标签，样式随主题变化。 */
const model = defineModel<boolean>({ default: false });
defineProps<{ id?: string; disabled?: boolean }>();
defineOptions({ inheritAttrs: false });
</script>
<template>
  <label class="ui-checkbox"
    ><input
      v-bind="$attrs"
      :id="id"
      type="checkbox"
      v-model="model"
      :disabled="disabled" /><span><slot /></span
  ></label>
</template>
<style scoped>
.ui-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ui-checkbox input {
  width: auto;
  accent-color: var(--color-primary);
}
</style>

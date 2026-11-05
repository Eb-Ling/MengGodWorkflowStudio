<script setup lang="ts">
import UiButton from "./UiButton.vue";
/** 公共关闭按钮：固定 SVG 尺寸与点击区域，保留键盘焦点和无障碍名称。 */
withDefaults(defineProps<{ label?: string }>(), { label: "关闭" });
</script>
<template>
  <UiButton
    class="ui-close-button"
    variant="ghost"
    :aria-label="label"
    :title="label"
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  </UiButton>
</template>
<style scoped>
.ui-close-button {
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  flex-shrink: 0;
  color: var(--color-text);
}
.ui-close-button svg {
  display: block;
  flex-shrink: 0;
}
</style>

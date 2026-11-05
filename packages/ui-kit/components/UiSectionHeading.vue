<script setup lang="ts">
import UiButton from "./UiButton.vue";
/** 可折叠的分区标题，沿用公共按钮的焦点与键盘行为。 */
withDefaults(
  defineProps<{
    title: string;
    count?: number;
    expanded?: boolean;
    controlsId?: string;
  }>(),
  { expanded: undefined },
);
defineEmits<{ toggle: [] }>();
</script>
<template>
  <h3 class="ui-section-heading">
    <UiButton
      v-if="expanded !== undefined"
      variant="ghost"
      class="ui-section-heading-trigger"
      :aria-expanded="expanded"
      :aria-controls="controlsId"
      :aria-label="title"
      @click="$emit('toggle')"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        :class="{ expanded }"
        aria-hidden="true"
      >
        <path d="m5 3 4 4-4 4" />
      </svg>
      <span class="ui-section-heading-text">{{ title }}</span>
      <span
        v-if="count !== undefined"
        class="ui-section-heading-count"
        aria-hidden="true"
        >{{ count }}</span
      >
    </UiButton>
    <span v-else class="ui-section-heading-static"
      >{{ title }}<small v-if="count !== undefined">{{ count }}</small></span
    >
  </h3>
</template>
<style scoped>
.ui-section-heading {
  margin: 18px 0 6px;
  border-top: 1px solid var(--color-border);
  padding-top: 10px;
}
.ui-section-heading :deep(button.ui-section-heading-trigger) {
  width: 100%;
  height: 32px;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 650;
  color: var(--color-text);
  text-align: left;
}
.ui-section-heading :deep(.n-button__content) {
  display: flex;
  width: 100%;
  gap: 8px;
  min-width: 0;
}
.ui-section-heading-text {
  flex: 1;
  overflow-wrap: anywhere;
  white-space: normal;
}
.ui-section-heading-count,
.ui-section-heading-static small {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: var(--color-text-muted);
}
.ui-section-heading svg {
  transition: transform 0.15s;
}
.ui-section-heading svg.expanded {
  transform: rotate(90deg);
}
.ui-section-heading-static {
  display: flex;
  gap: 8px;
  padding: 4px;
  font-size: 13px;
  font-weight: 650;
  color: var(--color-text);
}
</style>

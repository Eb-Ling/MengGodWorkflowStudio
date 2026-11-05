<script setup lang="ts">
import { ref, useId } from "vue";
import UiButton from "./UiButton.vue";
/** 首次展开时创建内容，收起只隐藏，保留输入和组件实例，卸载时正常清理。 */
const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    defaultExpanded?: boolean;
    label?: string;
  }>(),
  { defaultExpanded: false, label: "配置" },
);
const expanded = ref(props.defaultExpanded);
const visited = ref(props.defaultExpanded);
const contentId = useId();
function toggle() {
  expanded.value = !expanded.value;
  if (expanded.value) visited.value = true;
}
</script>
<template>
  <section class="ui-disclosure">
    <UiButton
      class="ui-disclosure-toggle"
      variant="ghost"
      :aria-label="(expanded ? '收起' : '展开') + label + ' ' + title"
      :aria-expanded="expanded"
      :aria-controls="contentId"
      @click="toggle"
    >
      <span class="ui-disclosure-heading">
        <strong>{{ title }}</strong>
        <small v-if="description">{{ description }}</small>
      </span>
      <span class="ui-disclosure-action">{{ expanded ? "收起" : "展开" }}</span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="{ expanded }"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </UiButton>
    <div :id="contentId" v-show="expanded" class="ui-disclosure-content">
      <slot v-if="visited" />
    </div>
  </section>
</template>
<style scoped>
.ui-disclosure {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-panel);
}
.ui-disclosure-toggle {
  width: 100%;
  height: auto !important;
  min-height: 64px;
  padding: 16px !important;
  border-radius: 9px;
}
.ui-disclosure-toggle :deep(.n-button__content) {
  width: 100%;
  gap: 12px;
  white-space: normal;
  text-align: left;
}
.ui-disclosure-heading {
  display: grid;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.ui-disclosure-heading strong {
  font-size: 15px;
}
.ui-disclosure-heading small,
.ui-disclosure-action {
  color: var(--color-text-muted);
}
.ui-disclosure-action {
  flex-shrink: 0;
}
.ui-disclosure-toggle svg {
  flex-shrink: 0;
  transition: transform 0.15s;
}
.ui-disclosure-toggle svg.expanded {
  transform: rotate(180deg);
}
.ui-disclosure-content {
  padding: 0 16px 16px;
  min-width: 0;
}
</style>

<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { UiPanel, UiField } from "../../packages/ui-kit/index";
withDefaults(defineProps<{ title?: string; accent?: string }>(), {
  title: "波形控制面板",
  accent: "#82adff",
});
const emit = defineEmits<{ change: [value: number] }>();
const amplitude = ref(20);
const amplitudeId = useId();
const points = computed(() =>
  Array.from(
    { length: 81 },
    (_, i) => `${i * 5},${64 - Math.sin(i / 6) * amplitude.value}`,
  ).join(" "),
);
</script>
<template>
  <UiPanel
    :title="title"
    description="自定义视图 + 内置字段组件"
    class="wave-controls"
  >
    <svg viewBox="0 0 400 128" role="img" aria-label="可调节的波形预览">
      <path d="M0 64H400" stroke="var(--color-border)" />
      <polyline
        :points="points"
        fill="none"
        :stroke="accent"
        stroke-width="2"
      />
    </svg>
    <UiField
      label="波幅"
      :for="amplitudeId"
      hint="此示例的局部状态不修改当前工作流。"
    >
      <input
        :id="amplitudeId"
        v-model.number="amplitude"
        type="range"
        min="0"
        max="55"
        @input="
          emit('change', Number(($event.target as HTMLInputElement).value))
        "
      />
      <output data-testid="example-amplitude-value">{{ amplitude }}</output>
    </UiField>
    <template #footer
      ><slot name="footer">支持属性更新、事件和插槽</slot></template
    >
  </UiPanel>
</template>

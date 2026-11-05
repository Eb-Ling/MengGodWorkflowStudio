<script setup lang="ts">
import { ref, watch } from "vue";
const props = defineProps<{
  controls: Record<string, any>;
  field: any;
  nodeId: string;
  onCommit: (value: unknown) => Promise<unknown>;
}>();
const value = ref(String(props.field.value)),
  error = ref("");
watch([() => props.field.value, () => props.nodeId], () => {
  value.value = String(props.field.value);
  error.value = "";
});
async function commit() {
  try {
    await props.onCommit(value.value);
    error.value = "";
  } catch (e: any) {
    error.value = e.message;
  }
}
</script>
<template>
  <component
    :is="controls.UiField"
    class="field custom-tint-field"
    :label="field.label"
    :error="error"
    hint="自定义字段：文本与滑杆共享当前实例状态。"
    ><component
      :is="controls.UiInput"
      v-model="value"
      :aria-label="field.label"
      @change="commit" /><component
      :is="controls.UiInput"
      v-model="value"
      type="range"
      min="0"
      max="1"
      step="0.01"
      :aria-label="field.label + ' 滑杆'"
      @change="commit"
  /></component>
</template>
<style scoped>
.custom-tint-field {
  border-left: 2px solid var(--color-accent);
  padding-left: 8px;
}
</style>

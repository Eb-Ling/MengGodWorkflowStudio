<script setup lang="ts">
import { ref, watch } from "vue";
const props = defineProps<{
  field: any;
  controls: Record<string, any>;
  nodeId: string;
  onCommit: (value: unknown) => Promise<unknown>;
}>();
const { UiField, UiInput, UiSelect, UiCheckbox, UiFileInput } = props.controls;
const value = ref(props.field.value),
  error = ref(props.field.error || "");
watch([() => props.field.value, () => props.nodeId], () => {
  value.value = props.field.value;
  error.value = props.field.error || "";
});
async function commit(next: any = value.value, commitValue = props.onCommit) {
  try {
    await commitValue(next);
    error.value = "";
  } catch (e: any) {
    error.value = e.message;
  }
}
async function file(files: File[]) {
  if (!files[0]) return;
  try {
    const commitValue = props.onCommit;
    const reader = new FileReader();
    const data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(Error("图片读取失败"));
      reader.readAsDataURL(files[0]);
    });
    await commit(data, commitValue);
  } catch (e: any) {
    error.value = e.message;
  }
}
</script>
<template>
  <UiField
    class="field"
    :class="{
      'texture-input-field': field.kind === 'file',
      'preview-toggle': field.kind === 'toggle',
    }"
    :label="field.kind === 'toggle' ? '' : field.label"
    :for="field.id"
    :hint="field.hint"
    :error="error"
    ><div v-if="field.kind === 'readonly'" class="readonly">
      {{ field.value }}
    </div>
    <UiSelect
      v-else-if="field.kind === 'select'"
      v-model="value"
      :options="field.options"
      :aria-label="field.ariaLabel || field.label"
      :aria-invalid="!!error"
      @change="commit()" /><UiCheckbox
      v-else-if="field.kind === 'toggle'"
      v-model="value"
      :aria-label="field.label"
      @change="commit()"
      >{{ field.label }}</UiCheckbox
    ><template v-else-if="field.kind === 'file'"
      ><UiFileInput
        accept="image/*"
        :aria-label="field.label"
        @select="file" /><img
        v-if="field.value"
        class="texture-source-preview"
        :src="field.value"
        alt="纹理预览" /></template
    ><UiInput
      v-else
      :id="field.id"
      v-model="value"
      :aria-label="field.ariaLabel || field.label"
      :aria-invalid="!!error"
      @change="commit()"
      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
  /></UiField>
</template>

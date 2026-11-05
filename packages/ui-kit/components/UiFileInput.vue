<script setup lang="ts">
import { ref } from "vue";
/** 文件只通过当前组件的用户选择事件交付，不读取或设置其他组件 DOM。 */
defineProps<{ accept?: string; multiple?: boolean }>();
const emit = defineEmits<{ select: [files: File[]] }>();
const input = ref<HTMLInputElement>();
/** 仅响应调用方的用户点击打开原生选择器，重复选择同一文件也会触发 select。 */
defineExpose({ open: () => input.value?.click() });
function selected(event: Event) {
  const element = event.target as HTMLInputElement;
  emit("select", Array.from(element.files || []));
  element.value = "";
}
</script>
<template>
  <input
    ref="input"
    type="file"
    :accept="accept"
    :multiple="multiple"
    @change="selected"
  />
</template>

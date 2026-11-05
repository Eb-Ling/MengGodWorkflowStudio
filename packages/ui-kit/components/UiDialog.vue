<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import UiCloseButton from "./UiCloseButton.vue";
const props = defineProps<{
  title: string;
  description?: string;
  closeLabel?: string;
  closeId?: string;
  visible?: boolean;
}>();
const emit = defineEmits<{ close: []; "update:visible": [value: boolean] }>();
const element = ref<HTMLDialogElement>();
function setVisible(value: boolean | undefined) {
  if (value === true && !element.value?.open) element.value?.showModal();
  if (value === false) element.value?.close();
}
onMounted(() => setVisible(props.visible));
watch(() => props.visible, setVisible);
defineExpose({
  open: () => {
    if (!element.value?.open) element.value?.showModal();
  },
  close: () => element.value?.close(),
});
</script>
<template>
  <dialog
    ref="element"
    class="ui-dialog"
    @close="
      emit('update:visible', false);
      emit('close');
    "
  >
    <header class="ui-dialog-heading">
      <div>
        <strong>{{ title }}</strong>
        <p v-if="description">{{ description }}</p>
      </div>
      <UiCloseButton
        :id="closeId"
        class="dialog-close"
        :label="closeLabel || '关闭'"
        @click="element?.close()"
      />
    </header>
    <div class="ui-dialog-body"><slot /></div>
    <div v-if="$slots.footer" class="ui-dialog-footer">
      <slot name="footer" />
    </div>
  </dialog>
</template>

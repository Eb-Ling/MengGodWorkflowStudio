<script setup lang="ts">
import { computed, ref, watch, onErrorCaptured } from "vue";
import { uiSurface } from "../surface";
const props = defineProps<{
    kind: string;
    type: string;
    value: Record<string, unknown>;
  }>(),
  error = ref("");
const entry = computed(() =>
  uiSurface.value?.resolveRenderer(props.kind, props.type),
);
watch(
  () => entry.value,
  () => (error.value = ""),
);
onErrorCaptured((e) => {
  error.value = String(e);
  return false;
});
</script>
<template>
  <span v-if="error" class="ui-field-error" role="alert"
    >渲染器错误：{{ error }}</span
  ><component
    v-else-if="entry"
    :is="entry.component"
    :key="entry.id"
    v-bind="value"
    ><template v-for="(_, name) in $slots" #[name]="slotProps"
      ><slot :name="name" v-bind="slotProps || {}" /></template></component
  ><slot v-else />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { uiSurface } from "../../../packages/ui-kit/surface";
import type { UiApi } from "../../../packages/plugin-sdk/types";
type ViewSlot = Parameters<UiApi["addView"]>[0]["slot"];
const props = defineProps<{
  name: ViewSlot;
  params?: Record<string, unknown>;
}>();
const view = computed(() =>
  uiSurface.value?.workspaceViews.value.find((x: any) => x.slot === props.name),
);
</script>
<template>
  <component
    v-if="view"
    :is="view.component"
    :key="view.id"
    v-bind="{ ...view.props, ...params }"
  /><slot v-else
    ><p
      v-if="['graph', 'catalog', 'inspector'].includes(name)"
      class="readonly"
    >
      工作流视图插件已停用，可在“工作流 → 插件管理”恢复。
    </p></slot
  >
</template>

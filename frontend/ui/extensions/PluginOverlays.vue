<script setup lang="ts">
import { computed } from "vue";
import { uiSurface } from "../../../packages/ui-kit/surface";
const pluginOverlays = computed(
  () => uiSurface.value?.pluginOverlays.value || [],
);
</script>
<template>
  <component
    v-for="entry in pluginOverlays"
    :key="entry.id"
    :is="entry.component"
    v-bind="entry.props"
  />
</template>

<script setup lang="ts">
import { useId } from "vue";
defineProps<{ text: string }>();
const id = useId();
</script>
<template>
  <span class="ui-tooltip" :aria-describedby="id" tabindex="0"
    ><slot /><span :id="id" role="tooltip">{{ text }}</span></span
  >
</template>
<style scoped>
.ui-tooltip {
  position: relative;
  display: inline-flex;
}
.ui-tooltip [role="tooltip"] {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  background: var(--color-panel);
  color: var(--color-text);
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  width: max-content;
  max-width: 260px;
  z-index: 20;
}
.ui-tooltip:hover [role="tooltip"],
.ui-tooltip:focus-within [role="tooltip"] {
  display: block;
}
</style>

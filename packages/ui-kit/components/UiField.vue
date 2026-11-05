<script setup lang="ts">
const props = defineProps<{
  label: string;
  for?: string;
  hint?: string;
  error?: string;
}>();
</script>
<template>
  <div class="ui-field">
    <label :for="props.for">{{ label }}</label>
    <slot />
    <small v-if="error" role="alert" class="ui-field-error">{{ error }}</small>
    <small v-else-if="hint" class="ui-field-hint">{{ hint }}</small>
  </div>
</template>

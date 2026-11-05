<script setup lang="ts">
import { NButton } from "naive-ui";
withDefaults(
  defineProps<{
    variant?: "default" | "primary" | "danger" | "ghost";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  { variant: "default", type: "button", disabled: false },
);
</script>

<template>
  <NButton
    class="ui-button"
    size="small"
    :attr-type="type"
    :disabled="disabled"
    :type="
      variant === 'primary'
        ? 'primary'
        : variant === 'danger'
          ? 'error'
          : 'default'
    "
    :quaternary="variant === 'ghost'"
  >
    <template v-if="$slots.icon" #icon><slot name="icon" /></template>
    <slot />
  </NButton>
</template>

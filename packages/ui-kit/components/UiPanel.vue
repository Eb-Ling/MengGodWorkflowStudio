<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; description?: string; compact?: boolean }>(),
  { compact: false },
);
</script>

<template>
  <section class="ui-panel" :class="{ 'ui-panel-compact': compact }">
    <header class="ui-panel-header">
      <div>
        <h2>{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ui-panel-actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="ui-panel-body"><slot /></div>
    <div v-if="$slots.footer" class="ui-panel-footer">
      <slot name="footer" />
    </div>
  </section>
</template>

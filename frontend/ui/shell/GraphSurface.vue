<script setup lang="ts">import PluginView from '../extensions/PluginView.vue';</script>
<template>
  <section
    id="canvas-shell"
    class="canvas-shell"
    aria-label="工作流画布"
    data-ui-slot="graph"
  >
    <PluginView name="graph"/>
  </section>
</template>

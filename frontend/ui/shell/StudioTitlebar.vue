<script setup lang="ts">
import { Diamond, Save, Download, PanelsTopLeft } from "@lucide/vue";
import { UiButton } from "../api";
import PluginView from "../extensions/PluginView.vue";
defineEmits<{ gallery: [] }>();
</script>
<template>
  <header class="studio-titlebar">
    <div class="studio-brand">
      <Diamond :size="17" /><strong>MengGod</strong><span>Workflow Studio</span>
    </div>
    <div class="studio-project">
      <span class="status-dot" /><span id="workflow-name">未命名流程</span>
    </div>
    <div class="studio-title-actions">
      <UiButton
        id="ui-component-gallery"
        variant="ghost"
        title="组件工坊"
        aria-label="打开组件工坊"
        @click="$emit('gallery')"
        ><PanelsTopLeft :size="16"
      /></UiButton>
      <PluginView name="project-title-actions"><span /></PluginView>
    </div>
  </header>
</template>

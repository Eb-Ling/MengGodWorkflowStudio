<script setup lang="ts">
import { FolderOpen, Package } from "@lucide/vue";
import { UiButton } from "../api";
import PluginView from "../extensions/PluginView.vue";
defineEmits<{ manager: []; plugins: [] }>();
</script>
<template>
  <div class="studio-workspace-bar">
    <PluginView name="stage-tabs"><span /></PluginView>
    <div class="toolbar">
      <PluginView name="preview-controls"><span /></PluginView>
      <PluginView name="geometry"><span /></PluginView>
      <UiButton id="workflow-manager" variant="ghost" @click="$emit('manager')"
        ><template #icon><FolderOpen :size="14" /></template>工作流</UiButton
      >
      <UiButton
        id="plugin-center-open"
        variant="ghost"
        @click="$emit('plugins')"
        ><template #icon><Package :size="14" /></template>插件</UiButton
      >
      <PluginView name="project-actions"><span /></PluginView>
      <PluginView name="workspace-actions"><span /></PluginView>
    </div>
  </div>
</template>

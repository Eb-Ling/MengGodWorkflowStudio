<script setup lang="ts">
import { UiDialog } from "../api";
import PluginView from "../extensions/PluginView.vue";
defineProps<{ visible: boolean }>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();
const close = () => emit("update:visible", false);
</script>
<template>
  <UiDialog
    id="workflow-dialog"
    class="workflow-dialog"
    title="工作流"
    description="当前工作区与已保存流程"
    close-id="close-workflow-dialog"
    :visible="visible"
    @close="close"
    ><div class="workflow-manager-layout">
      <section class="workflow-create">
        <PluginView name="project-config" :params="{ visible }"
          ><p class="readonly">
            项目界面插件已停用，可从顶部“插件”入口恢复。
          </p></PluginView
        >
      </section>
      <section class="workflow-list-section">
        <h3>已保存工作流</h3>
        <PluginView
          name="project-library"
          :params="{ onRequestClose: close }"
        />
      </section>
      <section class="workflow-list-section">
        <h3>示例工作流</h3>
        <PluginView
          name="project-examples"
          :params="{ onRequestClose: close }"
        />
      </section></div
  ></UiDialog>
</template>

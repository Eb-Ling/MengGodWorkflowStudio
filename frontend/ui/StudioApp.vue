<script setup lang="ts">
import { ref, watch } from "vue";
import { AppFrame, ThemeProvider } from "./api";
import StudioTitlebar from "./shell/StudioTitlebar.vue";
import StudioToolbar from "./shell/StudioToolbar.vue";
import NodeLibrary from "./shell/NodeLibrary.vue";
import InspectorPanel from "./shell/InspectorPanel.vue";
import GraphSurface from "./shell/GraphSurface.vue";
import StatusBar from "./shell/StatusBar.vue";
import WorkflowDialog from "./dialogs/WorkflowDialog.vue";
import PluginCenter from "./dialogs/PluginCenter.vue";
import { uiSurface } from "../../packages/ui-kit/surface";
import { uiRecovery } from "../application/ui-recovery";
import { UiButton } from "./api";
import PluginOverlays from "./extensions/PluginOverlays.vue";
const managerVisible = ref(false),
  pluginsVisible = ref(false);
watch(uiSurface, (value) => {
  if (!value) {
    managerVisible.value = false;
    pluginsVisible.value = false;
  }
});
</script>
<template>
  <ThemeProvider>
    <AppFrame>
      <template #titlebar
        ><StudioTitlebar @gallery="uiSurface?.openWorkshop()"
      /></template>
      <template #toolbar
        ><StudioToolbar
          @manager="managerVisible = true"
          @plugins="pluginsVisible = true"
      /></template>
      <template #navigation><NodeLibrary /></template>
      <GraphSurface />
      <template #inspector><InspectorPanel /></template>
      <template #statusbar><StatusBar /></template>
    </AppFrame>
    <WorkflowDialog v-model:visible="managerVisible" />
    <PluginCenter v-model:visible="pluginsVisible" />
    <div v-if="!uiSurface && uiRecovery.ready" class="ui-recovery" role="alert">
      基础 UI 已停用。文档仍保留。<UiButton
        id="restore-core-ui"
        :disabled="uiRecovery.busy || uiRecovery.pending"
        @click="uiRecovery.run()"
        >恢复界面</UiButton
      ><span>{{ uiRecovery.error }}</span>
    </div>
    <PluginOverlays />
  </ThemeProvider>
</template>

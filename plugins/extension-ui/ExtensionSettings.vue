<script setup lang="ts">
import { ref, type Component } from "vue";
import ExtensionPanel from "./ExtensionPanel.vue";
/** 设置页和手动打开的窗口共用同一份受检树，不向目录插件暴露 Vue 或原生窗口。 */
const props = defineProps<{
  controls: Readonly<Record<string, Component>>;
  title: string;
  placement: "settings" | "dialog";
  model: any;
  send: (event: unknown) => void;
}>();
const { UiPanel, UiButton, UiDialog } = props.controls;
const open = ref(false);
</script>
<template>
  <UiPanel
    :title="title"
    :description="
      placement === 'dialog' ? '在独立窗口中使用此插件工具' : undefined
    "
  >
    <ExtensionPanel
      v-if="placement === 'settings'"
      :controls="controls"
      :model="model"
      :send="send"
    />
    <template v-else>
      <UiButton
        class="extension-dialog-open"
        :aria-label="'打开插件窗口 ' + title"
        @click="open = true"
        >打开窗口</UiButton
      >
      <UiDialog
        :title="title"
        :visible="open"
        :close-label="'关闭插件窗口 ' + title"
        @close="open = false"
      >
        <ExtensionPanel
          v-if="open"
          :controls="controls"
          :model="model"
          :send="send"
        />
      </UiDialog>
    </template>
  </UiPanel>
</template>

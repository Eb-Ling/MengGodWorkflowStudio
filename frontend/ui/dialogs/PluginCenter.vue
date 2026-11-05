<script setup lang="ts">
import { ref } from "vue";
import { UiDialog, UiTabs } from "../api";
import PluginSettings from "../extensions/PluginSettings.vue";
defineProps<{ visible: boolean }>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();
const category = ref<"management" | "settings" | "developer">("management");
</script>
<template>
  <UiDialog
    id="plugin-center"
    title="插件中心"
    description="管理扩展与连接设置"
    close-id="close-plugin-center"
    close-label="关闭插件中心"
    :visible="visible"
    @close="emit('update:visible', false)"
  >
    <UiTabs
      v-model="category"
      label="插件中心分区"
      :items="[
        { id: 'management', label: '插件管理' },
        { id: 'settings', label: '插件设置' },
        { id: 'developer', label: '开发者示例' },
      ]"
    />
    <div class="plugin-center-content" role="tabpanel">
      <p v-if="category === 'developer'" class="developer-intro">
        以下示例用于学习和验证插件
        API。启用后会增加演示节点或面板，操作按钮可能修改当前草稿。
      </p>
      <PluginSettings v-if="visible" :category="category" />
    </div>
  </UiDialog>
</template>
<style scoped>
#plugin-center {
  width: min(960px, calc(100vw - 48px));
}
.plugin-center-content {
  margin-top: 22px;
  min-width: 0;
}
.developer-intro {
  color: var(--color-text-muted);
  margin: 0 0 18px;
}
</style>

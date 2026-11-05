<script setup lang="ts">
import type { Component } from "vue";
import type { PluginDisableImpact } from "../../packages/plugin-sdk/types";
defineProps<{
  controls: Record<string, Component>;
  impact: PluginDisableImpact | null;
  remove: boolean;
  busy: boolean;
  error: string;
}>();
defineEmits<{ confirm: []; cancel: [] }>();
</script>
<template>
  <component
    :is="controls.UiDialog"
    id="plugin-impact-dialog"
    :visible="!!impact"
    :title="remove ? '确认移除插件登记' : '确认停用插件'"
    close-label="取消插件变更"
    @close="$emit('cancel')"
  >
    <template v-if="impact">
      <p>
        即将{{ remove ? "移除登记" : "停用" }} <strong>{{ impact.name }}</strong
        >。
      </p>
      <template v-if="impact.stop.some((p) => p.id !== impact?.id)">
        <h3>以下依赖插件将同时停用</h3>
        <ul>
          <li
            v-for="p in impact.stop.filter((p) => p.id !== impact?.id)"
            :key="p.id"
          >
            {{ p.name }} <small>{{ p.id }}</small>
          </li>
        </ul>
      </template>
      <template v-if="impact.restart.length">
        <h3>以下插件将重新绑定可选能力</h3>
        <ul>
          <li v-for="p in impact.restart" :key="p.id">
            {{ p.name }} <small>{{ p.id }}</small>
          </li>
        </ul>
      </template>
      <p>工作流数据会保留，使用这些插件节点的流程可能暂时无法预览或导出。</p>
      <p v-if="remove">只移除登记，源文件保留。</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="impact-actions">
        <component
          :is="controls.UiButton"
          id="plugin-impact-cancel"
          :disabled="busy"
          @click="$emit('cancel')"
          >取消</component
        >
        <component
          :is="controls.UiButton"
          id="plugin-impact-confirm"
          variant="danger"
          :disabled="busy"
          @click="$emit('confirm')"
          >{{ remove ? "确认移除登记" : "确认停用" }}</component
        >
      </div>
    </template>
  </component>
</template>
<style scoped>
li {
  margin: 8px 0;
  overflow-wrap: anywhere;
}
small {
  display: block;
  color: var(--color-text-muted);
}
.impact-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 22px;
}
</style>

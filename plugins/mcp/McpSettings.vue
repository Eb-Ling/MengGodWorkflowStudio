<script setup lang="ts">
import type { Component } from "vue";
import { ref } from "vue";
const manual = ref(false);
defineProps<{
  controls: Record<string, Component>;
  model: {
    port: string;
    status: string;
    prompt: string;
    configuration: string;
    busy: boolean;
    mode: "read" | "write";
  };
  actions: {
    setMode(value: string): void;
    activate(): Promise<void>;
    selfTest(): Promise<void>;
    showConfig(): Promise<void>;
    copyGuide(): Promise<void>;
    revoke(): Promise<void>;
  };
}>();
</script>
<template>
  <component
    :is="controls.UiPanel"
    title="MCP 接入"
    description="首次配置后自动连接，告诉 AI 工作流名称即可开始"
  >
    <component :is="controls.UiField" label="桥接端口" for="bridge-port">
      <component
        :is="controls.UiInput"
        id="bridge-port"
        type="number"
        min="1"
        max="65535"
        :model-value="model.port"
        readonly
      />
    </component>
    <component
      :is="controls.UiField"
      label="外部 AI 权限"
      for="bridge-access-mode"
    >
      <component
        :is="controls.UiSelect"
        id="bridge-access-mode"
        :model-value="model.mode"
        :disabled="model.busy"
        @update:model-value="actions.setMode"
      >
        <option value="read">只读（查看草稿、源码结果与预览）</option>
        <option value="write">可编辑（包含保存与导出）</option>
      </component>
    </component>
    <p id="bridge-status" class="readonly" role="status">{{ model.status }}</p>
    <div class="mcp-actions">
      <component
        :is="controls.UiButton"
        id="bridge-check"
        :disabled="model.busy"
        @click="actions.activate"
        >重新连接</component
      >
      <component
        :is="controls.UiButton"
        id="bridge-self-test"
        :disabled="model.busy"
        @click="actions.selfTest"
        >运行 MCP 自检</component
      >
      <component
        :is="controls.UiButton"
        id="bridge-copy-prompt"
        :disabled="model.busy"
        @click="actions.copyGuide"
        >复制配置说明给 AI</component
      >
    </div>
    <component
      :is="controls.UiButton"
      id="bridge-manual"
      :disabled="model.busy"
      @click="
        manual = !manual;
        manual && actions.showConfig();
      "
      >{{ manual ? "收起手动配置" : "手动配置" }}</component
    >
    <component
      :is="controls.UiButton"
      id="bridge-revoke"
      :disabled="model.busy"
      @click="actions.revoke"
      >撤销外部接入</component
    >
    <component
      :is="controls.UiTextarea"
      v-if="model.prompt"
      id="bridge-prompt"
      class="bridge-prompt"
      aria-label="MCP 配置与接入提示"
      readonly
      :model-value="model.prompt"
      :rows="12"
    />
    <component
      :is="controls.UiTextarea"
      v-if="manual && model.configuration"
      id="bridge-config"
      class="bridge-prompt"
      aria-label="MCP 手动配置 JSON"
      readonly
      :model-value="model.configuration"
      :rows="12"
    />
    <small class="type-hint"
      >同一台电脑的当前用户配置目录只需配置一次，重启或端口变化会自动连接。
      更改权限后复制新配置才会生效，同一权限重复复制不会使旧配置失效。 AI
      会先列出草稿和工作流，按你指定的目标读取后再操作。重名时会先询问。
      自检不会影响外部接入，撤销后旧配置立即失效。</small
    >
  </component>
</template>
<style scoped>
.mcp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0;
  min-width: 0;
}
.mcp-actions :deep(button) {
  max-width: 100%;
}
.bridge-prompt {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin-bottom: 12px;
}
#bridge-status {
  overflow-wrap: anywhere;
}
</style>

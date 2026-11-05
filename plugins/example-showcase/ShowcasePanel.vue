<script setup lang="ts">
import type { Component } from "vue";
defineProps<{
  controls: Record<string, Component>;
  model: { status: string; customView: boolean; canvasExtended: boolean };
  actions: {
    create(): void;
    undo(): void;
    redo(): void;
    arrange(): void;
    toggleView(): void;
    toggleCanvas(): void;
  };
}>();
</script>
<template>
  <component
    :is="controls.UiPanel"
    title="插件 API 演示"
    description="开发用途 · 双阶段事务、节点与画布扩展"
  >
    <p>
      一次在顶点与片段各创建一个颜色节点，并连接片段输出，任一阶段失败都不会留下修改。
    </p>
    <div class="editor-actions">
      <component
        :is="controls.UiButton"
        id="example-create-both"
        @click="actions.create"
        >双阶段创建示例</component
      >
      <component :is="controls.UiButton" id="example-undo" @click="actions.undo"
        >撤销示例操作</component
      >
      <component :is="controls.UiButton" id="example-redo" @click="actions.redo"
        >重做示例操作</component
      >
      <component
        :is="controls.UiButton"
        id="example-arrange"
        @click="actions.arrange"
        >排列当前选中节点</component
      >
      <component
        :is="controls.UiButton"
        id="example-toggle-view"
        @click="actions.toggleView"
        >{{
          model.customView ? "还原默认节点视图" : "注册自定义节点与字段视图"
        }}</component
      >
      <component
        :is="controls.UiButton"
        id="example-canvas-extension"
        @click="actions.toggleCanvas"
        >{{
          model.canvasExtended ? "移除画布扩展示例" : "注册画布扩展示例"
        }}</component
      >
    </div>
    <p role="status" id="example-status">{{ model.status }}</p>
  </component>
</template>
<style scoped>
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0;
}
</style>

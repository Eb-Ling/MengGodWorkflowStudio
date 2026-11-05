<script setup lang="ts">
defineProps<{ controls: any; model: any }>();
</script>
<template>
  <div class="canvas-extension">
    <component
      :is="controls.UiToggle"
      v-model="model.fine"
      label="使用 32 像素步长"
      >使用 32 像素步长</component
    >
    <p>
      已提供中心点框选、名称显示顺序和整体右移布局。请在右侧“画布策略”选择并应用。
    </p>
    <small
      >当前右移步长：{{
        model.fine ? 32 : 64
      }}
      px，不修改节点、连线或渲染参数。</small
    >
  </div>
</template>
<style scoped>
.canvas-extension {
  padding: 10px;
}
.canvas-extension p {
  margin: 6px 0;
}
</style>

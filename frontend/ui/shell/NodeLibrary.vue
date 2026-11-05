<script setup lang="ts">
import { Search, Boxes } from "@lucide/vue";
import PluginView from '../extensions/PluginView.vue';
</script>
<template>
  <aside class="sidebar left-panel">
    <PluginView name="catalog"/>
    <section class="help">
      <h3>连接节点</h3>
      <p>拖动输出端口连接输入。连接已有输入时，将替换原连线。</p>
    </section>
  </aside>
</template>

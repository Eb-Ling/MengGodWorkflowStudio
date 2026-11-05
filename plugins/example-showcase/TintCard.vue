<script setup lang="ts">
import { computed } from "vue";
/** 外部渲染器只接公开展示数据、控件、事件和插槽，没有编辑器会话对象。 */
const props = defineProps<{
  controls: Record<string, any>;
  entry: any;
  position: { x: number; y: number };
  selected: boolean;
  pending: any;
  onNodeDown: (e: PointerEvent, node: any) => void;
  onPortDown: (e: PointerEvent, port: any) => void;
  onContext: (e: MouseEvent, id: string) => void;
}>();
const color = computed(() => {
  const p = props.entry.node.properties;
  return `rgba(${Number(p.red) * 255},${Number(p.green) * 255},${Number(p.blue) * 255},${Number(p.alpha)})`;
});
</script>
<template>
  <article
    class="workflow-node custom-tint-card"
    :class="{ selected }"
    :data-id="entry.node.id"
    :data-type="entry.node.typeId"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @pointerdown="onNodeDown($event, entry.node)"
    @contextmenu="onContext($event, entry.node.id)"
  >
    <header class="node-header">
      <span class="tint-swatch" :style="{ background: color }" /><span>{{
        entry.node.title
      }}</span
      ><span class="node-id">{{ entry.node.id }}</span>
    </header>
    <p class="tint-caption">由示例插件提供的节点视图</p>
    <slot name="preview" />
    <div class="node-body">
      <component
        :is="controls.UiRenderer"
        v-for="port in entry.definition.outputs"
        :key="port.name"
        kind="port"
        :type="port.type"
        :value="{
          nodeId: entry.node.id,
          port,
          direction: 'output',
          compatible:
            pending?.direction === 'input' &&
            (pending.type === port.type || pending.type === 'AUTO'),
          onPortDown,
        }"
      />
    </div>
  </article>
</template>
<style scoped>
.custom-tint-card {
  border-color: var(--color-accent);
  border-top-width: 3px;
}
.tint-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}
.tint-caption {
  font-size: 11px;
  color: var(--color-accent);
  margin: 6px 10px;
}
</style>

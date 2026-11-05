<script setup lang="ts">
const props = defineProps<{
  controls: Record<string, any>;
  entry: any;
  position: { x: number; y: number };
  selected: boolean;
  pending: any;
  onNodeDown: (event: PointerEvent, node: any) => void;
  onPortDown: (event: PointerEvent, port: any) => void;
  onContext: (event: MouseEvent, nodeId: string) => void;
}>();
const { UiRenderer } = props.controls;
const compatible = (type: string, direction: string) =>
  props.pending &&
  props.pending.direction !== direction &&
  (props.pending.type === type ||
    props.pending.type === "AUTO" ||
    type === "AUTO");
</script>
<template>
  <article
    :class="['workflow-node', { selected }]"
    :data-id="entry.node.id"
    :data-type="entry.node.typeId"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @pointerdown="onNodeDown($event, entry.node)"
    @contextmenu="onContext($event, entry.node.id)"
  >
    <header class="node-header">
      <slot name="header"
        ><span class="type-icon" /><span>{{
          entry.node.title || entry.definition.title
        }}</span
        ><span class="node-id" :title="entry.node.id">{{ entry.node.id }}</span></slot
      >
    </header>
    <slot name="preview" />
    <div class="node-body">
      <slot
        ><template v-for="direction in ['input', 'output']" :key="direction"
          ><UiRenderer
            v-for="port in entry.definition[direction + 's']"
            :key="direction + port.name"
            kind="port"
            :type="port.type"
            :value="{
              nodeId: entry.node.id,
              port,
              direction,
              compatible: compatible(port.type, direction),
              onPortDown,
            }" /></template
      ></slot>
    </div>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  nodeId: string;
  port: { name: string; type: string };
  direction: string;
  compatible?: boolean;
  onPortDown: (event: PointerEvent, port: unknown) => void;
}>();
</script>
<template>
  <div :class="['port-row', direction]">
    <i
      :class="['port', direction, { compatible }]"
      :data-port-id="`${nodeId}:${direction}:${port.name}`"
      :data-node-id="nodeId"
      :data-socket="port.name"
      :data-direction="direction"
      :data-value-type="port.type"
      role="button"
      :aria-label="`${direction === 'input' ? '输入' : '输出'} ${port.name} ${port.type}`"
      @pointerdown="
        onPortDown($event, {
          nodeId,
          socket: port.name,
          direction,
          type: port.type,
        })
      "
    /><template v-if="direction === 'input'"
      ><span class="port-label">{{ port.name }}</span
      ><span class="port-type">{{ port.type.toLowerCase() }}</span></template
    ><template v-else
      ><span class="port-type">{{ port.type.toLowerCase() }}</span
      ><span class="port-label">{{ port.name }}</span></template
    >
  </div>
</template>

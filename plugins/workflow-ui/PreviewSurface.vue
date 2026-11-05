<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
const props = defineProps<{ session: any; nodeId: string; socket: string }>(),
  canvas = ref<HTMLCanvasElement>();
let live = true, view: any = null;
async function draw() {
  if (!live || !canvas.value) return;
  const s = props.session.snapshot.value;
  try {
    view ||= props.session.preview.mount(canvas.value);
    await view.render({
      document: props.session.document(),
      stage: s.stage,
      nodeId: props.nodeId,
      socket: props.socket,
      width: s.project.previewWidth,
      height: s.project.previewHeight,
      time: props.session.model.time,
    });
  } catch { /* 预览能力已在画布显示错误。 */ }
}
watch(
  [
    () => props.session.snapshot.value.documentToken,
    () => props.session.snapshot.value.documentRevision,
    () => props.session.snapshot.value.catalogRevision,
    () => props.session.snapshot.value.stage,
    () => props.session.model.time,
    () => props.socket,
  ],
  () => {
    void draw();
  },
);
onMounted(draw);
onBeforeUnmount(() => {
  live = false;
  view?.dispose();
  view = null;
});
</script>
<template>
  <canvas
    ref="canvas"
    class="node-preview"
    width="112"
    height="112"
    title="节点输出预览"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
const props = defineProps<{ session: any; nodeId: string; socket: string; navigating: boolean }>(),
  canvas = ref<HTMLCanvasElement>();
let live = true, visible = false, view: any = null, observer: IntersectionObserver | undefined;
async function draw() {
  if (!live || !visible || props.navigating || document.hidden || !canvas.value) return;
  const s = props.session.snapshot.value;
  try {
    view ||= props.session.preview.mount(canvas.value);
    // 缩略图只绘制显示所需像素，输出图与高清窗口各自保留原尺寸。
    const scale = Math.min(canvas.value.width / s.project.previewWidth, canvas.value.height / s.project.previewHeight, 1);
    await view.render({
      stage: s.stage,
      nodeId: props.nodeId,
      socket: props.socket,
      width: Math.max(1, Math.round(s.project.previewWidth * scale)),
      height: Math.max(1, Math.round(s.project.previewHeight * scale)),
    });
  } catch { /* 预览能力已在画布显示错误。 */ }
}
let invalid = true;
function requestDraw() {
  if (!live || !visible || props.navigating || document.hidden || !invalid) return;
  invalid = false;
  void draw();
}
watch(
  [
    () => props.session.snapshot.value.documentToken,
    () => props.session.snapshot.value.documentRevision,
    () => props.session.snapshot.value.catalogRevision,
    () => props.session.snapshot.value.stage,
    () => props.socket,
    () => props.nodeId,
  ],
  () => {
    invalid = true;
    requestDraw();
  },
);
function syncActivity() {
  view?.setActive(visible && !props.navigating && !document.hidden);
  requestDraw();
}
watch(() => props.navigating, syncActivity);
onMounted(() => {
  document.addEventListener("visibilitychange", syncActivity);
  if (!canvas.value) return;
  observer = new IntersectionObserver(([entry]) => {
    if (!live || !entry || visible === entry.isIntersecting) return;
    visible = entry.isIntersecting;
    if (visible) requestDraw();
    else { invalid = true; view?.dispose(); view = null; }
  }, { root: canvas.value.closest(".graph-editor") });
  observer.observe(canvas.value);
});
onBeforeUnmount(() => {
  live = false;
  observer?.disconnect();
  document.removeEventListener("visibilitychange", syncActivity);
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

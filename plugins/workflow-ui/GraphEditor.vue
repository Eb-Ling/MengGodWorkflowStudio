<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  watch,
  watchEffect,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { createGraphGestures } from "./gestures";
import { createGraphKeyboard } from "./keyboard";
import TimeValue from "./TimeValue.vue";
import PreviewSurface from "./PreviewSurface.vue";
const props = defineProps<{ session: any }>(),
  s = props.session,
  { UiRenderer, UiMenu, UiDialog, UiInput, UiButton } = s.ui.components;
const root = ref<HTMLElement>(),
  layerError = ref(""),
  transform = ref<HTMLElement>(),
  wires = ref<any[]>([]),
  menu = reactive({
    visible: false,
    x: 0,
    y: 0,
    nodeId: null as string | null,
    world: { x: 0, y: 0 },
  }),
  save = reactive({ visible: false, title: "", summary: "" });
let scheduled = false,
  live = true;
const {
  draft,
  view,
  world,
  nodeDown,
  portDown,
  branchDown,
  background,
  wheel,
  cancel,
} = createGraphGestures(s, root, measure);
const selection = computed(() => s.snapshot.value.selection);
const entries = computed(() => {
    const nodes = s.projection.value.nodes;
    s.model.serial;
    try {
      const ids = s.interaction.evaluate({
        kind: "layers",
        input: {
          nodes: nodes.map((e: any) => e.node),
          selection: selection.value,
        },
      }).nodeIds;
      const map = new Map(nodes.map((e: any) => [e.node.id, e]));
      layerError.value = "";
      return ids.map((id: string) => map.get(id));
    } catch (error) {
      layerError.value = "显示顺序策略失败，已使用文档顺序：" + String(error);
      return nodes;
    }
  });
const keyboard = createGraphKeyboard(s, root, menu, selection, world, cancel);
const position = (node: any) =>
  Object.freeze({
    ...(draft.positions[node.id] || { x: node.canvasX, y: node.canvasY }),
  });
function path(a: any, b: any) {
  const d = Math.max(56, Math.abs(b.x - a.x) * 0.55);
  return `M ${a.x} ${a.y} C ${a.x + d} ${a.y}, ${b.x - d} ${b.y}, ${b.x} ${b.y}`;
}
// 节点和 SVG 共用世界坐标。平移或缩放只更新这个容器，不触发节点树渲染。
watchEffect(() => {
  if (transform.value) {
    const { x, y, zoom } = view.value;
    transform.value.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
  }
}, { flush: "sync" });
let measureFrame = 0;
function measure() {
  if (scheduled || !live) return;
  scheduled = true;
  measureFrame = requestAnimationFrame(() => {
    scheduled = false;
    if (!live || !root.value) return;
    const bounds = root.value.getBoundingClientRect(), { x, y, zoom } = view.value;
    const centers = new Map<string, { x: number; y: number } | null>();
    function center(nodeId: string, direction: string, name: string) {
      const id = nodeId + ":" + direction + ":" + name;
      if (!centers.has(id)) {
        const port = root.value?.querySelector<HTMLElement>(`[data-port-id="${CSS.escape(id)}"]`);
        const b = port?.getBoundingClientRect();
        centers.set(id, b ? { x: (b.x + b.width / 2 - bounds.left - x) / zoom,
          y: (b.y + b.height / 2 - bounds.top - y) / zoom } : null);
      }
      return centers.get(id);
    }
    const result = [];
    for (const link of s.snapshot.value.graph.links) {
      const a = center(link.fromNode, "output", link.fromSocket);
      const b = center(link.toNode, "input", link.toSocket);
      if (a && b) result.push({ key: JSON.stringify(link), d: path(a, b), link });
    }
    if (draft.pending) {
      const p = draft.pending, a = center(p.nodeId, p.direction, p.socket);
      if (a) result.push({ key: "pending", d: p.direction === "input" ? path(p.cursor, a) : path(a, p.cursor), pending: true });
    }
    wires.value = result;
  });
}
watch([() => s.projection.value, () => draft.positions, () => draft.pending], measure, { flush: "post" });
watch(
  [() => s.snapshot.value.documentToken, () => s.snapshot.value.stage],
  () => {
    cancel();
    menu.visible = false;
    save.visible = false;
  },
);
function doubleClick(event: MouseEvent) {
  // 指针捕获会把 click/dblclick 的 target 重定向到画布，按实际命中点判断空白区域。
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  if (
    !hit ||
    !root.value?.contains(hit) ||
    hit.closest(".workflow-node,.context-menu,dialog,.if-branches,.for-branch")
  )
    return;
  void s.run(() => {
    const p = world(event.clientX, event.clientY);
    return s.add("studio.math.constant", p.x, p.y);
  });
}
async function context(event: MouseEvent, nodeId: string | null = null) {
  event.preventDefault();
  event.stopPropagation();
  if (nodeId && !selection.value.includes(nodeId))
    await s.run(() => s.select([nodeId]));
  Object.assign(menu, {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    nodeId,
    world: world(event.clientX, event.clientY),
  });
}
const menuItems = computed(() => {
  const selected = selection.value.length > 0,
    entry = entries.value.find((e: any) => e.node.id === menu.nodeId);
  return [
    ...(selected
      ? [
          { id: "copy", label: "复制选中节点" },
          { id: "cut", label: "剪切选中节点" },
        ]
      : []),
    ...(s.hasClipboard() ? [{ id: "paste", label: "粘贴" }] : []),
    ...(entry?.definition.outputs.length
      ? [{ id: "open-preview", label: "打开放大预览图" }]
      : []),
    ...(selected
      ? [
          {
            id: "toggle-preview",
            label: entries.value
              .filter((e: any) => selection.value.includes(e.node.id))
              .every((e: any) => e.node.properties.previewEnabled)
              ? "关闭选中预览"
              : "开启选中预览",
          },
          { id: "disconnect", label: "断开所有连线" },
          { id: "save-workflow-node", label: "保存选中内容为工作流节点" },
          { id: "delete", label: "删除节点", danger: true },
        ]
      : []),
  ];
});
function openSave() {
  const graph = s.snapshot.value.graph,
    ids = new Set(selection.value);
  save.title =
    "工作流节点 " +
    (s.snapshot.value.workflowNodes.filter((n: any) => !n.preset).length + 1);
  save.summary = `将保存 ${ids.size} 个节点和 ${graph.links.filter((l: any) => ids.has(l.fromNode) && ids.has(l.toNode)).length} 条内部连线。`;
  save.visible = true;
}
async function choose(id: string) {
  const nodeId = menu.nodeId,
    p = { ...menu.world };
  menu.visible = false;
  await s.run(async () => {
    if (id === "copy") s.copy();
    else if (id === "cut") await s.cut();
    else if (id === "paste") await s.paste(p);
    else if (id === "open-preview")
      await s.preview.open({ nodeId });
    else if (id === "toggle-preview") await s.action("TOGGLE_SELECTED_PREVIEW");
    else if (id === "disconnect") await s.action("DISCONNECT_SELECTED");
    else if (id === "delete") await s.action("DELETE_SELECTED");
    else if (id === "save-workflow-node") openSave();
  });
}
async function drop(event: DragEvent) {
  event.preventDefault();
  const p = world(event.clientX, event.clientY),
    template = event.dataTransfer?.getData("workflow-node-id"),
    type = event.dataTransfer?.getData("node-type");
  await s.run(() =>
    template
      ? s.action("EXPAND_WORKFLOW_NODE", {
          workflowNodeId: template,
          canvasX: p.x,
          canvasY: p.y,
        })
      : type
        ? s.add(type, p.x, p.y)
        : null,
  );
}
onMounted(() => {
  window.addEventListener("keydown", keyboard);
  void measure();
});
onBeforeUnmount(() => {
  live = false;
  cancelAnimationFrame(measureFrame);
  cancel();
  window.removeEventListener("keydown", keyboard);
});
</script>
<template>
  <div
    ref="root"
    class="graph-editor"
    tabindex="0"
    @pointerdown="background"
    @wheel="wheel"
    @contextmenu="context($event)"
    @dragover.prevent
    @drop="drop"
    @dblclick="doubleClick"
  >
    <div v-if="layerError" class="canvas-strategy-error" role="alert">
      {{ layerError }}
    </div>
    <div v-if="!entries.length" class="canvas-hint">
      从节点库拖入节点，开始构建特效
    </div>
    <div
      id="graph-transform"
      ref="transform"
      class="graph-transform"
    >
      <svg id="wire-layer" class="wire-layer" aria-hidden="true">
        <path
          v-for="w in wires"
          :key="w.key"
          :d="w.d"
          :class="['wire', { pending: w.pending }]"
          @dblclick.stop="
            !w.pending &&
            s.run(() =>
              s.batch([{ type: 'DISCONNECT', payload: { link: w.link } }]),
            )
          "
        />
      </svg>
      <div id="node-layer" class="node-layer">
        <template v-for="entry in entries" :key="entry.node.id"
          ><section
            v-if="entry.node.typeId === 'logic.if'"
            class="if-branches"
            :style="{
              left: position(entry.node).x + 'px',
              top: position(entry.node).y + 42 + 'px',
            }"
            @pointerdown="branchDown($event, entry.node)"
          >
            <div
              v-for="branch in ['true', 'false']"
              :key="branch"
              :class="['if-branch', branch]"
              :style="{
                width: (entry.node.properties[branch + 'Width'] || 430) + 'px',
                height:
                  (entry.node.properties[branch + 'Height'] || 300) + 'px',
              }"
            >
              <span>{{ branch.toUpperCase() }} 分支</span>
            </div>
          </section>
          <section
            v-else-if="entry.node.typeId === 'logic.for'"
            class="for-branch"
            :style="{
              left: position(entry.node).x + 'px',
              top: position(entry.node).y + 42 + 'px',
              width: (entry.node.properties.width || 430) + 'px',
              height: (entry.node.properties.height || 300) + 'px',
            }"
            @pointerdown="branchDown($event, entry.node)"
          >
            <span>FOR 循环体 · 使用 i 输出作为索引</span>
          </section>
          <UiRenderer
            kind="node"
            :type="entry.node.typeId"
            :value="{
              controls: s.ui.components,
              entry,
              position: position(entry.node),
              selected: selection.includes(entry.node.id),
              pending: draft.pending
                ? {
                    direction: draft.pending.direction,
                    type: draft.pending.type,
                  }
                : null,
              onNodeDown: nodeDown,
              onPortDown: portDown,
              onContext: context,
            }"
            ><template #preview
              ><TimeValue v-if="entry.node.typeId === 'input.time'" :preview="s.preview" />
              <PreviewSurface
                v-if="
                  entry.definition.outputs.length &&
                  entry.node.properties.previewEnabled
                "
                :session="s"
                :navigating="draft.navigating"
                :node-id="entry.node.id"
                :socket="
                  entry.definition.outputs[0].name
                " /></template></UiRenderer
        ></template>
      </div>
      <div
        v-if="draft.box"
        class="selection-box"
        :style="{
          left: draft.box.x + 'px',
          top: draft.box.y + 'px',
          width: draft.box.width + 'px',
          height: draft.box.height + 'px',
        }"
      />
    </div>
    <UiMenu
      id="node-context-menu"
      v-bind="menu"
      :items="menuItems"
      @choose="choose"
      @close="menu.visible = false"
    /><UiDialog
      id="workflow-node-save-dialog"
      title="保存工作流节点"
      :visible="save.visible"
      @close="save.visible = false"
      ><p id="workflow-node-save-summary">{{ save.summary }}</p>
      <UiInput
        id="workflow-node-save-title"
        v-model="save.title"
        aria-label="工作流节点名称"
      /><UiButton
        id="confirm-workflow-node-save"
        @click="
          s.run(async () => {
            await s.action('SAVE_SELECTION_AS_WORKFLOW_NODE', {
              title: save.title,
            });
            s.model.search = '';
            save.visible = false;
          })
        "
        >保存</UiButton
      ></UiDialog
    >
  </div>
</template>
<style scoped>
.graph-editor {
  position: absolute;
  inset: 0;
  overflow: hidden;
  outline: none;
  touch-action: none;
}
.canvas-strategy-error {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 50;
  max-width: 75%;
  padding: 8px;
  background: var(--panel);
  color: var(--color-danger);
  pointer-events: none;
}
.graph-editor :deep(.graph-transform) {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
}
.graph-editor :deep(.wire-layer) {
  overflow: visible;
}
.graph-editor :deep(.selection-box) {
  pointer-events: none;
}
</style>

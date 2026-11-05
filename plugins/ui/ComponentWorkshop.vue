<script setup lang="ts">
import { h, onBeforeUnmount, ref, nextTick, watch } from "vue";
import {
  UiButton,
  UiDialog,
  type UiInstance,
} from "../../packages/ui-kit/index";
import WaveControls from "./WaveControls.vue";
const dialog = ref<InstanceType<typeof UiDialog>>();
const target = ref<HTMLElement>();
const active = ref(false),
  siblingActive = ref(false),
  lastEvent = ref("尚未调整波幅");
const props = defineProps<{ registry: any; model: { open: boolean } }>();
const scope = props.registry.createScope("studio.ui.workshop");
scope.register({
  id: "studio.ui.workshop.wave",
  version: "1.0.0",
  component: WaveControls,
});
let instance: UiInstance | null = null;
let sibling: UiInstance | null = null;
function createSibling() {
  if (!target.value || sibling || !instance) return;
  sibling = scope.create("studio.ui.workshop.wave", target.value, {
    title: "独立波形面板",
    accent: "#7dd7b1",
    onChange: (value: number) => {
      lastEvent.value = `独立面板波幅变化：${value}`;
    },
  });
  siblingActive.value = true;
}
function create() {
  if (!target.value || instance) return;
  instance = scope.create(
    "studio.ui.workshop.wave",
    target.value,
    {
      onChange: (value: number) => {
        lastEvent.value = `收到波幅变化：${value}`;
      },
    },
    {
      footer: () => [
        h("span", { class: "workshop-slot" }, "由调用方提供的 footer 插槽"),
      ],
    },
  );
  active.value = true;
}
function dispose() {
  sibling?.dispose();
  sibling = null;
  siblingActive.value = false;
  instance?.dispose();
  instance = null;
  active.value = false;
}
async function open() {
  dialog.value?.open();
  await nextTick();
  create();
}
onBeforeUnmount(() => {
  dispose();
  scope.dispose();
});
watch(
  () => props.model.open,
  (value) => {
    if (value) void open();
  },
);
</script>
<template>
  <UiDialog
    id="component-workshop"
    ref="dialog"
    title="组件工坊"
    description="内置 UI API · 受信任模块示例"
    close-label="关闭组件工坊"
    @close="
      dispose();
      model.open = false;
    "
  >
    <p class="workshop-intro">
      这个面板通过组件注册与创建接口生成。它组合内置控件、自定义波形视图和调用方插槽。
    </p>
    <div class="dialog-actions">
      <UiButton id="create-example-panel" :disabled="active" @click="create"
        >创建面板</UiButton
      >
      <UiButton
        id="update-example-panel"
        :disabled="!active"
        @click="
          instance?.update({ title: '已更新的波形面板', accent: '#bda4ff' })
        "
        >更新标题与颜色</UiButton
      >
      <UiButton id="dispose-example-panel" :disabled="!active" @click="dispose"
        >销毁面板</UiButton
      >
      <UiButton
        id="create-sibling-panel"
        :disabled="!active || siblingActive"
        @click="createSibling"
        >添加独立面板</UiButton
      >
    </div>
    <div ref="target" id="component-example-target"></div>
    <p v-if="!active" class="workshop-empty">面板已卸载，可以再次创建。</p>
    <output class="workshop-event" aria-live="polite">{{ lastEvent }}</output>
    <details>
      <summary>组件接口</summary>
      <pre>
scope.register({ id, version, component });
const panel = scope.create(id, target, props, slots);
panel.update({ title, accent });
panel.dispose();</pre>
      <small
        >组件与面板由内核管理所有者和生命周期。通用第三方 UI
        的目录安装与执行隔离仍在 P6 计划中。</small
      >
    </details>
  </UiDialog>
</template>

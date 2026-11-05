<script setup lang="ts">
import { reactive, watch, ref, onBeforeUnmount } from "vue";
import WorkflowStorage from "./WorkflowStorage.vue";
const props = defineProps<{ session: any; visible?: boolean }>(),
  s = props.session,
  { UiInput, UiSelect, UiButton, UiField } = s.ui.components;
const form = reactive({
    title: "",
    className: "",
    shaderDir: "",
    blendMode: "alpha",
    previewWidth: "1024",
    previewHeight: "1024",
  }),
  error = ref(""),
  guide = ref("");
let generation = 0,
  source: any;
onBeforeUnmount(() => {
  generation++;
});
function load() {
  source = s.workflow.snapshot();
  const p = source.project;
  Object.assign(form, {
    title: p.title,
    className: p.className,
    shaderDir: p.shaderDir,
    blendMode: p.blendMode || "alpha",
    previewWidth: String(p.previewWidth || 1024),
    previewHeight: String(p.previewHeight || 1024),
  });
  error.value = "";
}
watch(
  [() => props.visible, () => s.snapshot.value.documentToken],
  () => {
    if (props.visible) load();
  },
  { immediate: true },
);
watch(
  [() => props.visible, () => s.model.serial],
  async () => {
    const turn = ++generation;
    if (!props.visible) return;
    const snapshot = s.workflow.snapshot();
    try {
      const r = await s.exporter.guide( {
        document: {
          config: snapshot.project,
          fragment: snapshot.fragmentGraph,
          geometry: snapshot.vertexTransform,
        },
      });
      if (turn === generation) guide.value = r.description;
    } catch (e: any) {
      if (turn === generation) guide.value = "参数接口无法生成：" + e.message;
    }
  },
  { immediate: true },
);
async function save(create = false) {
  try {
    await s.action(
      create ? "NEW_WORKFLOW" : "SAVE_WORKFLOW",
      create
        ? { ...form, id: "workflow_" + crypto.randomUUID() }
        : { config: { ...form, id: source.project.id } },
      source,
    );
    load();
    error.value = "";
  } catch (e: any) {
    error.value = e.message;
    s.report(e.message);
  }
}
async function prepareFileSave() {
  await s.action(
    "SET_PROJECT_CONFIG",
    {
      ...form,
      previewWidth: Number(form.previewWidth),
      previewHeight: Number(form.previewHeight),
    },
    source,
  );
  load();
}
</script>
<template>
  <h3>工作流配置</h3>
  <UiField label="工作流名称" for="workflow-title"
    ><UiInput id="workflow-title" v-model="form.title"
  /></UiField>
  <UiField label="导出 Java 类名" for="plugin-class-name"
    ><UiInput id="plugin-class-name" v-model="form.className"
  /></UiField>
  <UiField label="着色器目录" for="shader-directory"
    ><UiInput id="shader-directory" v-model="form.shaderDir"
  /></UiField>
  <UiField label="混合方式" for="blend-mode"
    ><UiSelect
      id="blend-mode"
      v-model="form.blendMode"
      :options="[
        { value: 'alpha', label: '普通透明' },
        { value: 'additive', label: '叠加发光' },
      ]"
  /></UiField>
  <div class="resolution-fields">
    <UiField label="预览画布宽度" for="preview-canvas-width"
      ><UiInput
        id="preview-canvas-width"
        v-model="form.previewWidth"
        type="number"
        min="64"
        max="4096" /></UiField
    ><UiField label="预览画布高度" for="preview-canvas-height"
      ><UiInput
        id="preview-canvas-height"
        v-model="form.previewHeight"
        type="number"
        min="64"
        max="4096"
    /></UiField>
  </div>
  <small class="type-hint"
    >控制节点 GPU 预览的内部渲染分辨率，节点显示按比例留边。</small
  >
  <p v-if="error" role="alert" class="ui-field-error">{{ error }}</p>
  <div class="dialog-actions">
    <UiButton id="create-workflow" @click="save(true)">新建并打开</UiButton
    ><UiButton id="save-current-workflow" @click="save()">保存当前</UiButton>
  </div>
  <details class="constructor-contract">
    <summary>Plugin 构造参数（随输入节点变化）</summary>
    <pre id="constructor-contract">{{ guide }}</pre>
  </details>
  <WorkflowStorage
    :session="s"
    :visible="visible"
    :prepare-save="prepareFileSave"
  />
</template>

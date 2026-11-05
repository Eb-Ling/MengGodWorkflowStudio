<script setup lang="ts">
import { ref, reactive, watch, onBeforeUnmount } from "vue";
const props = defineProps<{ session: any }>(),
  s = props.session,
  { UiDialog, UiButton, UiInput, UiField, UiFileInput } = s.ui.components;
const fileInput = ref<any>(),
  importStatus = ref("尚未选择文件。"),
  runtime = reactive({
    path: "",
    location: "",
    source: "",
    status: "",
    ready: false,
    valid: false,
    busy: false,
    error: "",
  });
let generation = 0,
  live = true,
  importGeneration = 0;
watch(
  () => s.model.importOpen,
  (open) => {
    importGeneration++;
    if (open) importStatus.value = "尚未选择文件。";
  },
);
async function importFile(files: File[]) {
  if (!files[0]) return;
  const turn = ++importGeneration,
    source = s.workflow.snapshot();
  try {
    const workflow = JSON.parse(await files[0].text());
    if (!live || turn !== importGeneration) return;
    await s.action("IMPORT_WORKFLOW_DATA", { workflow }, source);
    if (!live) return;
    importStatus.value = "导入成功：" + s.workflow.snapshot().project.title;
    s.model.importOpen = true;
  } catch (e: any) {
    if (live && turn === importGeneration)
      importStatus.value = "导入失败：" + e.message;
  }
}
async function prepare(commit = false) {
  const turn = ++generation,
    source = s.workflow.snapshot();
  runtime.valid = false;
  runtime.ready = false;
  try {
    const prepared = await s.exporter.prepareDependency({runtimePath:runtime.path}),
      info=prepared.configuration.runtime,path=info.path,dependency=prepared.dependency;
    if (
      !live ||
      turn !== generation ||
      source.documentToken !== s.workflow.snapshot().documentToken
    )
      return null;
    if (commit && s.workflow.snapshot().project.runtimePath !== path)
      await s.action("SET_RUNTIME_PATH", { path }, source);
    if (!live || turn !== generation) return null;
    const status = prepared.status;
    runtime.location = `依赖文件放置位置：${info.sourcePath}\n\n依赖源码：package ${info.packageName};\n特效源码：import ${info.importName};`;
    runtime.source = dependency.content;
    runtime.error = "";
    runtime.valid = true;
    runtime.ready = status.state === "current";
    runtime.status = runtime.ready
      ? "此版本、此路径的依赖曾导出，丢失文件时可重新导出。"
      : status.state === "outdated"
        ? "运行依赖已有更新，请重新导出下方单个 Java 文件，替换 Mod 中的旧版本，再继续导出特效。"
        : "此路径尚未导出依赖，请先导出下方单个 Java 文件，再继续导出特效。";
    return { path, dependency, sourcePath:info.sourcePath };
  } catch (e: any) {
    if (live && turn === generation) {
      runtime.error = e.message;
      runtime.source = "";
      runtime.status = e.message;
      runtime.valid = false;
      runtime.ready = false;
    }
    return null;
  }
}
watch([() => s.model.runtimeOpen, () => s.operationIds.value.join(",")], () => {
  generation++;
  if (s.model.runtimeOpen) {
    runtime.path = s.workflow.snapshot().project.runtimePath || "data/method";
    void prepare();
  }
});
async function download() {
  runtime.busy = true;
  try {
    const r = await prepare(true);
    if (!r) return;
    await s.exporter.exportDependency({runtimePath:r.path,download:true});
    await prepare();
    runtime.status = `已开始下载 WorkflowRuntime.java，请放到源码根目录下 ${r.sourcePath}。`;
  } finally {
    runtime.busy = false;
  }
}
async function proceed() {
  runtime.busy = true;
  try {
    const r = await prepare(true);
    if (r && runtime.ready) await s.continueExport();
  } catch (e: any) {
    runtime.status = e.message;
  } finally {
    runtime.busy = false;
  }
}
onBeforeUnmount(() => {
  live = false;
  generation++;
  importGeneration++;
});
</script>
<template>
  <UiDialog
    id="import-dialog"
    class="workflow-dialog"
    title="导入工作流文件"
    close-id="close-import-dialog"
    v-model:visible="s.model.importOpen"
    ><p class="readonly">
      仅支持当前 v1.0
      文档：必须包含顶点与片段两张图。旧格式会被拒绝，校验失败不会替换当前草稿。
    </p>
    <pre class="import-format">
{ "kind": "studio.document", "schemaVersion": 1,
  "documentVersion": "1.0.0", "revision": 0,
  "project": {...}, "graphs": { "vertex": {...}, "fragment": {...} },
  "geometry": {...}, "requiredPlugins": {} }</pre>
    <UiButton
      id="choose-workflow-file"
      variant="primary"
      @click="fileInput?.open()"
      >选择 JSON 文件</UiButton
    ><UiFileInput
      ref="fileInput"
      id="workflow-file-input"
      accept=".json,.workflow.json,application/json"
      hidden
      @select="importFile"
    />
    <h3>导入结果</h3>
    <div id="import-status" class="readonly">{{ importStatus }}</div></UiDialog
  >
  <UiDialog
    id="runtime-dependency-dialog"
    class="workflow-dialog runtime-dependency-dialog"
    title="运行依赖源码设置"
    close-label="关闭运行依赖设置"
    v-model:visible="s.model.runtimeOpen"
    ><p>
      共用代码合并在一个 WorkflowRuntime.java 中，只需放入 Mod
      源码一次。每个特效仍只导出一个 Java 和两个着色器。
    </p>
    <UiField
      label="依赖源码包路径"
      for="runtime-source-path"
      hint="填写相对源码根目录的包路径，例如 data/method，也接受 data.method。依赖的 package 和特效的 import 会自动保持一致。"
      :error="runtime.error"
      ><UiInput
        id="runtime-source-path"
        v-model="runtime.path"
        aria-label="依赖源码包路径"
        placeholder="data/method"
        :spellcheck="false"
        :aria-invalid="!!runtime.error"
        @input="prepare()"
        @change="prepare(true)"
    /></UiField>
    <pre id="runtime-source-location">{{ runtime.location }}</pre>
    <output id="runtime-dependency-status" aria-live="polite">{{
      runtime.status
    }}</output>
    <details>
      <summary>查看依赖源码</summary>
      <pre id="runtime-source-preview">{{ runtime.source }}</pre>
    </details>
    <div class="dialog-actions">
      <UiButton
        id="export-runtime-source"
        :disabled="!runtime.valid || runtime.busy"
        @click="download"
        >导出单个依赖 Java</UiButton
      ><UiButton
        v-show="s.model.pendingExport"
        id="continue-effect-export"
        variant="primary"
        :disabled="!runtime.ready || runtime.busy"
        @click="proceed"
        >继续导出三文件特效</UiButton
      >
    </div></UiDialog
  >
</template>

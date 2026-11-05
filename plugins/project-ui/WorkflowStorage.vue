<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
const props = defineProps<{
    session: any;
    visible?: boolean;
    prepareSave: () => Promise<void>;
  }>(),
  s = props.session;
const { UiButton, UiFileInput } = s.ui.components;
const state = ref<any>(null),
  message = ref(""),
  confirmOverwrite = ref(false),
  fileInput = ref<any>();
let live = true,
  refreshing = false;
async function refresh() {
  if (!live || refreshing) return;
  refreshing = true;
  try {
    const value = await s.files.status();
    if (live) state.value = value;
  } catch (e: any) {
    if (live) message.value = e.message;
  } finally {
    refreshing = false;
  }
}
async function run(method: string, input?: any) {
  message.value = "";
  confirmOverwrite.value = false;
  try {
    if (method === "saveAs") await props.prepareSave();
    const result = await s.files[method](
      ...(input === undefined ? [] : [input]),
    );
    message.value = result.cancelled
      ? "已取消文件选择"
      : method === "save" || method === "saveAs"
        ? "工作流已保存"
        : "已载入工作流，被替换的未保存修改可从恢复草稿中找回。";
  } catch (e: any) {
    message.value = e.message;
  }
  await refresh();
}
async function openFile(files: File[]) {
  if (!files[0]) return;
  const source = s.workflow.snapshot();
  try {
    await s.picker.openFile(files[0]);
    message.value = "工作流已打开，保存会同步更新源文件和工作流库。";
  } catch (e: any) {
    message.value = e.message;
  }
  await refresh();
}
async function exportCopy() {
  await s.run(async () => {
    await props.prepareSave();
    const document = s.workflow.snapshot().document;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    Object.assign(window.document.createElement("a"), {
      href: url,
      download: (document.project.className || "workflow") + ".workflow.json",
    }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.value = "已导出工作流副本，当前保存位置不变。";
  });
}
watch(
  () => props.visible,
  (open) => {
    if (open) void refresh();
  },
  { immediate: true },
);
watch(
  () => s.model.serial,
  () => {
    if (props.visible) void refresh();
  },
);
const timer = setInterval(() => {
  if (props.visible) void refresh();
}, 800);
onBeforeUnmount(() => {
  live = false;
  clearInterval(timer);
});
</script>
<template>
  <section id="workflow-storage" aria-label="工作流存储与恢复">
    <h3>保存与恢复</h3>
    <p id="workflow-save-location">
      {{
        state?.file
          ? "保存到：" + state.file.path + "（工作流库已关联）"
          : "保存到：工作流库"
      }}
    </p>
    <p id="workflow-save-state">
      {{
        state?.dirty ? "有未保存的修改" : "已保存"
      }}。工具栏“保存工作流”、上方“保存当前”和 Ctrl+S 使用相同的保存流程。
    </p>
    <div class="dialog-actions">
      <UiButton
        id="open-workflow-file"
        :disabled="state?.busy || !state?.available"
        @click="fileInput?.open()"
        >打开工作流文件</UiButton
      >
      <UiFileInput
        ref="fileInput"
        id="open-workflow-file-input"
        hidden
        accept=".workflow.json"
        @select="openFile"
      />
      <UiButton
        id="save-workflow-as"
        :disabled="state?.busy || !state?.available"
        @click="run('saveAs')"
        >另存为工作流文件</UiButton
      >
      <UiButton
        id="export-workflow-copy"
        :disabled="state?.busy"
        @click="exportCopy"
        >导出工作流副本</UiButton
      >
      <UiButton
        id="reload-workflow"
        :disabled="state?.busy || !state?.saved"
        @click="run('reload')"
        >重新载入已保存内容</UiButton
      >
      <UiButton
        id="restore-workflow-backup"
        :disabled="state?.busy || !state?.saved"
        @click="run('backup')"
        >恢复上次保存前的备份</UiButton
      >
    </div>
    <small
      >打开文件保留节点 ID
      并关联源文件，“导入工作流”仍按依次新建节点的规则导入副本。</small
    >
    <div v-if="state?.conflict" id="workflow-save-conflict" role="alert">
      <p>
        源文件已被外部修改，本次保存未覆盖它。可重新载入、另存，或确认覆盖检测到的版本。
      </p>
      <UiButton v-if="!confirmOverwrite" @click="confirmOverwrite = true"
        >覆盖外部版本…</UiButton
      >
      <template v-else
        ><p>覆盖前保留外部版本的备份，如果文件再次变化，仍会停止保存。</p>
        <UiButton
          id="confirm-workflow-overwrite"
          :disabled="state.busy"
          @click="run('save', { conflictVersion: state.conflict.version })"
          >确认覆盖外部版本</UiButton
        >
        <UiButton @click="confirmOverwrite = false">取消</UiButton>
      </template>
    </div>
    <output id="workflow-storage-message" aria-live="polite">{{
      message || state?.error
    }}</output>
    <details>
      <summary>恢复未保存的草稿（{{ state?.recoveries.length || 0 }}）</summary>
      <p>自动保留未保存修改，正常关闭时补存。恢复后仍需保存工作流。</p>
      <div
        v-for="item in state?.recoveries || []"
        :key="item.id"
        class="workflow-recovery-row"
        :data-recovery-id="item.id"
      >
        <span
          >{{ item.title
          }}<small>{{ item.updatedAt }} {{ item.path }}</small></span
        >
        <UiButton
          :disabled="state.busy"
          @click="run('recover', { recoveryId: item.id })"
          >恢复此草稿</UiButton
        >
      </div>
    </details>
  </section>
</template>
<style scoped>
#workflow-storage .dialog-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 8px;
}
#workflow-storage .dialog-actions :deep(button) {
  max-width: 100%;
  white-space: normal;
}
#workflow-storage {
  border-top: 1px solid var(--border);
  margin-top: 20px;
  padding-top: 12px;
  min-width: 0;
}
#workflow-save-location,
.workflow-recovery-row span {
  overflow-wrap: anywhere;
  min-width: 0;
}
.workflow-recovery-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--border);
  padding: 12px 0;
}
.workflow-recovery-row span {
  flex: 1;
}
.workflow-recovery-row small {
  display: block;
  opacity: 0.7;
}
.workflow-recovery-row button {
  flex-shrink: 0;
}
#workflow-save-conflict {
  border-left: 3px solid var(--accent);
  padding: 0 12px;
  margin: 16px 0;
}
#workflow-storage-message {
  display: block;
  margin: 12px 0;
}
</style>

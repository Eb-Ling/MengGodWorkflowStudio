<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { shortcutFromEvent } from "../../packages/plugin-sdk/shortcuts.mjs";
const props = defineProps<{ controls: Record<string, any>; service: any }>();
const { UiButton, UiInput, UiPanel } = props.controls;
const serial = ref(0),
  search = ref(""),
  error = ref(""),
  recording = ref("");
const off = props.service.subscribe(() => serial.value++);
onBeforeUnmount(off);
const rows = computed(() => {
  serial.value;
  return props.service
    .list()
    .filter((e: any) =>
      (e.title + e.id + e.scope)
        .toLowerCase()
        .includes(search.value.toLowerCase()),
    );
});
const scopeName = (s: string) =>
  ({ graph: "工作流画布", preview: "高清预览", workspace: "工作区" })[
    s as "graph"
  ] || s;
// 界面使用键帽名称，公共协议与已保存配置仍使用平台无关的 Mod。
const shortcutLabel = (value: string) =>
  value
    .split("+")
    .map((part) => (part === "Mod" ? "Ctrl" : part))
    .join("+");
function update(id: string, keys: string[]) {
  try {
    props.service.configure(id, keys);
    error.value = "";
    recording.value = "";
  } catch (e) {
    error.value = String(e);
  }
}
function capture(event: KeyboardEvent, row: any) {
  event.stopPropagation();
  event.preventDefault();
  const key = shortcutFromEvent(event);
  if (!key || event.repeat) return;
  update(
    row.id,
    recording.value.endsWith(":add") ? [...row.bindings, key] : [key],
  );
}
function reset(id?: string) {
  try {
    props.service.reset(id);
    error.value = "";
  } catch (e) {
    error.value = String(e);
  }
}
</script>
<template>
  <UiPanel
    title="快捷键"
    description="自定义操作热键 · 顶点与片段共用 · 自动保存"
  >
    <section id="shortcut-settings">
      <p>
        点击“重新录制”后按组合键，例如 Ctrl+Z。配置自动保存，
        顶点与片段共用，输入框内保留文字编辑行为。
        “移除”只取消旁边这一条快捷键绑定，不删除操作。
      </p>
      <div class="shortcut-toolbar">
        <UiInput
          v-model="search"
          aria-label="搜索快捷键"
          placeholder="搜索操作或作用域"
        /><UiButton id="reset-shortcuts" @click="reset()"
          >恢复全部默认</UiButton
        >
      </div>
      <p v-if="error" role="alert" class="shortcut-error">{{ error }}</p>
      <div
        v-for="row in rows"
        :key="row.id"
        class="shortcut-row"
        :data-shortcut="row.id"
      >
        <div>
          <strong>{{ row.title }}</strong
          ><small
            >{{ scopeName(row.scope) }} · 默认
            {{ row.defaults.map(shortcutLabel).join(" / ") || "未绑定" }}</small
          >
          <p v-if="row.conflicts.length" class="shortcut-error">
            冲突：当前组合暂不执行，请重新配置。
          </p>
        </div>
        <div class="shortcut-bindings">
          <span v-for="key in row.bindings" :key="key" class="shortcut-binding">
            <kbd>{{ shortcutLabel(key) }}</kbd>
            <UiButton
              variant="ghost"
              :aria-label="'移除快捷键 ' + shortcutLabel(key)"
              :title="'取消 ' + shortcutLabel(key) + ' 绑定，保留此操作'"
              @click="
                update(
                  row.id,
                  row.bindings.filter((k: string) => k !== key),
                )
              "
              >移除</UiButton
            > </span
          ><span v-if="!row.bindings.length">未绑定</span>
        </div>
        <div class="shortcut-actions">
          <UiButton
            @click="recording = row.id + ':replace'"
            @keydown="
              recording.startsWith(row.id + ':') && capture($event, row)
            "
            >{{
              recording === row.id + ":replace" ? "请按组合键…" : "重新录制"
            }}</UiButton
          >
          <UiButton
            :disabled="row.bindings.length >= 3"
            @click="recording = row.id + ':add'"
            @keydown="
              recording.startsWith(row.id + ':') && capture($event, row)
            "
            >{{
              recording === row.id + ":add" ? "请按组合键…" : "添加备选"
            }}</UiButton
          >
          <UiButton
            v-if="recording.startsWith(row.id + ':')"
            @click="recording = ''"
            >取消录制</UiButton
          >
          <UiButton @click="update(row.id, [])">清空</UiButton
          ><UiButton @click="reset(row.id)">默认</UiButton>
        </div>
      </div>
      <p>
        Tab/Enter、菜单方向键与对话框 Escape 是标准控件导航，鼠标滚轮和 Shift
        框选是指针手势，不属于此处的操作热键。
      </p>
    </section>
  </UiPanel>
</template>
<style scoped>
.shortcut-toolbar,
.shortcut-bindings,
.shortcut-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.shortcut-toolbar :deep(input) {
  flex: 1;
  min-width: 140px;
}
.shortcut-binding {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}
.shortcut-binding kbd {
  font: inherit;
}
.shortcut-row {
  display: grid;
  grid-template-columns: minmax(170px, 1fr) minmax(120px, 1fr);
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border);
}
.shortcut-row small {
  display: block;
  color: var(--color-text-muted);
  margin-top: 6px;
}
.shortcut-actions {
  grid-column: 1/-1;
}
.shortcut-error {
  color: var(--color-danger);
}
@media (max-width: 650px) {
  .shortcut-row {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from "vue";
import DeclarationEditor from "./DeclarationEditor.vue";
import PluginImpactDialog from "./PluginImpactDialog.vue";
import { declarationRequirements } from "../../packages/plugin-sdk/declarative.mjs";
import type { Declaration } from "../../packages/plugin-sdk/declarative-types";
import {
  pluginManifestDraft,
  readPluginManifest,
} from "../../packages/plugin-sdk/plugin-manifest.mjs";
import type { Component } from "vue";
import type {
  PluginManagementApi,
  PluginDraft,
  LocalPluginManifest,
  PluginDisableImpact,
} from "../../packages/plugin-sdk/types";
const props = defineProps<{
  controls: Record<string, Component>;
  api: PluginManagementApi;
  developer?: boolean;
  downloadKit: () => Promise<void>;
}>();
const kitBusy = ref(false),
  kitError = ref("");
async function downloadKit() {
  if (kitBusy.value) return;
  kitBusy.value = true;
  kitError.value = "";
  try {
    await props.downloadKit();
  } catch (error) {
    kitError.value = String(error);
  } finally {
    kitBusy.value = false;
  }
}
const state = ref(props.api.snapshot()),
  authorizations = ref<Awaited<ReturnType<PluginManagementApi["authorized"]>>>(
    [],
  ),
  draft = ref<PluginDraft | null>(null),
  manifest = ref<LocalPluginManifest | null>(null),
  createTemplate = ref(false),
  permissions = ref(""),
  approved = ref(false),
  formError = ref("");
// 已确认的勾选只对应当时的声明，编辑入口、版本或其他字段后必须重新确认。
watch(
  manifest,
  () => {
    approved.value = false;
  },
  { deep: true, flush: "sync" },
);
const listedPlugins = computed(() =>
  state.value.plugins.filter((p) => !!p.developmentOnly === !!props.developer),
);
const pending = ref<{ impact: PluginDisableImpact; remove: boolean } | null>(
  null,
);
const impactError = ref("");
const unsubscribe = props.api.subscribe((value) => {
  state.value = value;
  if (!value.busy) void refreshAuthorizations();
});
let live = true;
async function refreshAuthorizations() {
  if (!state.value.desktop) return;
  try {
    const items = await props.api.authorized();
    if (live) authorizations.value = items;
  } catch {
    /* 管理 API 报告操作错误。 */
  }
}
void refreshAuthorizations();
onUnmounted(() => {
  live = false;
  unsubscribe();
});
async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch {
    /* API 状态向面板统一报告错误。 */
  }
}
async function changeEnabled(id: string, enabled: boolean) {
  if (enabled) return run(() => props.api.setEnabled(id, true));
  const impact = props.api.previewDisable(id);
  if (impact.stop.some((p) => p.id !== id) || impact.restart.length) {
    impactError.value = "";
    pending.value = { impact, remove: false };
  } else await run(() => props.api.setEnabled(id, false, impact.reviewKey));
}
async function removePlugin(id: string) {
  if (
    state.value.plugins.find((p) => p.id === id)?.error &&
    !state.value.plugins.find((p) => p.id === id)?.enabled
  )
    return run(() => props.api.remove(id));
  impactError.value = "";
  pending.value = { impact: props.api.previewDisable(id), remove: true };
}
async function confirmImpact() {
  if (!pending.value) return;
  const { impact, remove } = pending.value;
  try {
    if (remove) await props.api.remove(impact.id, impact.reviewKey);
    else await props.api.setEnabled(impact.id, false, impact.reviewKey);
    pending.value = null;
  } catch (error) {
    if (!live) return;
    impactError.value = String(error);
    pending.value = { impact: props.api.previewDisable(impact.id), remove };
  }
}
function edit(value: PluginDraft | null) {
  if (!value) return;
  draft.value = value;
  manifest.value = structuredClone(value.manifest);
  createTemplate.value =
    value.manifest.kind !== "declarative" && !value.entries.length;
  formError.value = value.error || "";
  approved.value = !!value.permissionsApproved;
  setPermissions();
}
function setPermissions() {
  const m = manifest.value!;
  permissions.value = JSON.stringify(
    {
      requiredApis: m.requiredApis,
      optionalApis: m.optionalApis || {},
      providesApis: m.providesApis || {},
      capabilities: m.capabilities,
      isolation: m.isolation || {},
    },
    null,
    2,
  );
}
function changeKind(kind: unknown) {
  if (!manifest.value) return;
  const defaults = pluginManifestDraft(
    manifest.value.name,
    manifest.value.entry,
    String(kind),
  ) as LocalPluginManifest;
  manifest.value = {
    ...defaults,
    id: manifest.value.id,
    name: manifest.value.name,
    version: manifest.value.version,
  };
  createTemplate.value =
    defaults.kind !== "declarative" && !draft.value?.entries.length;
  approved.value = false;
  setPermissions();
}
function editDeclaration(value: Declaration) {
  if (manifest.value?.kind !== "declarative") return;
  manifest.value.declaration = value;
  approved.value = false;
  try {
    Object.assign(manifest.value, declarationRequirements(value));
    setPermissions();
    formError.value = "";
  } catch (e) {
    formError.value = String(e);
  }
}
async function choose(id?: string) {
  await run(async () => edit(await props.api.choose(id)));
}
async function inspect(id: string) {
  await run(async () => edit(await props.api.inspect(id)));
}
async function save(authorizeOnly = false) {
  if (!draft.value || !manifest.value) return;
  formError.value = "";
  try {
    const values = JSON.parse(permissions.value);
    const value = readPluginManifest({
      ...manifest.value,
      requiredApis: values.requiredApis,
      optionalApis: values.optionalApis,
      providesApis: values.providesApis,
      capabilities: values.capabilities,
      isolation: values.isolation,
    }) as LocalPluginManifest;
    if (
      (authorizeOnly || value.kind !== "nodes" || draft.value.replaceId) &&
      !approved.value
    )
      throw Error("请审阅下方能力与 API 声明，勾选允许后加载");
    if (authorizeOnly) await props.api.authorize(draft.value, value);
    else
      await props.api.install(
        draft.value,
        value,
        createTemplate.value,
        approved.value,
      );
    draft.value = null;
  } catch (e) {
    formError.value = String(e);
  }
}
</script>
<template>
  <component
    :is="controls.UiPanel"
    :title="developer ? '开发示例插件' : '已安装插件'"
    :description="
      developer ? '用于学习公开 API，可按需启用' : '安装、启用与管理编辑器扩展'
    "
  >
    <template v-if="developer">
      <p>
        下载独立 SDK 与测试包，在 Studio
        源码目录之外检查插件声明、依赖和隔离加载。包内提供中文说明与示例。
      </p>
      <component
        :is="controls.UiButton"
        id="plugin-download-devkit"
        :disabled="kitBusy"
        @click="downloadKit"
        >下载开发者测试包</component
      >
      <p v-if="kitError" role="alert">{{ kitError }}</p>
    </template>
    <p v-if="!developer">
      选择插件文件夹后读取
      studio-plugin.json，没有声明时可配置无脚本面板，或生成脚本入口。
    </p>
    <component
      :is="controls.UiButton"
      v-if="!developer"
      id="plugin-add-local"
      :disabled="state.busy || !state.desktop"
      @click="choose()"
      >添加本地插件</component
    >
    <p v-if="!developer && !state.desktop">请使用桌面版选择本地插件目录。</p>
    <p v-if="state.error" role="alert">{{ state.error }}</p>
    <p v-if="state.notice" role="status">{{ state.notice }}</p>
    <details
      v-if="!developer && authorizations.length"
      id="plugin-authorized-directories"
    >
      <summary>已授权目录（{{ authorizations.length }}）</summary>
      <p>
        AI
        只能登记这里批准的内容，源码变化后需要重新审阅。移除登记会保留授权，撤销授权不影响已加载插件。
      </p>
      <div
        v-for="item in authorizations"
        :key="item.authorizationId"
        class="plugin-entry"
        :data-authorized-id="item.id"
      >
        <div class="plugin-details">
          <strong>{{ item.name }}</strong
          ><small
            >{{ item.id }} · {{ item.version }} ·
            {{ item.registered ? "已登记" : "待登记" }}</small
          >
        </div>
        <div class="plugin-actions">
          <component
            :is="controls.UiButton"
            :disabled="state.busy || item.registered"
            @click="
              run(() => api.registerAuthorized(item.id, item.authorizationId))
            "
            >登记</component
          >
          <component
            :is="controls.UiButton"
            :disabled="state.busy"
            @click="
              run(() => api.revokeAuthorization(item.id, item.authorizationId))
            "
            >撤销 AI 登记授权</component
          >
        </div>
      </div>
    </details>
    <div
      v-for="plugin in listedPlugins"
      :key="plugin.id"
      class="plugin-entry"
      :data-plugin-id="plugin.id"
    >
      <div class="plugin-details">
        <strong>{{ plugin.name }}</strong
        ><small
          >{{ plugin.id }} · {{ plugin.version }} ·
          {{ plugin.source === "local" ? "本地目录" : "内置" }}</small
        >
        <small v-if="plugin.directory">{{ plugin.directory }}</small>
        <small v-if="Object.keys(plugin.requiredApis).length"
          >必需 API：{{ Object.keys(plugin.requiredApis).join("、") }}</small
        >
        <small v-if="plugin.error" role="alert">{{ plugin.error }}</small>
        <details
          v-if="plugin.fingerprint || plugin.bindings || plugin.diagnostic"
        >
          <summary>依赖与加载诊断</summary>
          <small v-if="plugin.fingerprint"
            >已批准内容指纹：{{ plugin.fingerprint }}</small
          >
          <small v-if="plugin.generation"
            >本次加载：{{ plugin.generation }}</small
          >
          <small v-if="plugin.diagnostic"
            >状态：{{ plugin.diagnostic.code }}</small
          >
          <small v-for="(provider, apiId) in plugin.bindings" :key="apiId"
            >{{ apiId }} → {{ provider }}</small
          >
        </details>
      </div>
      <span class="plugin-status">{{
        plugin.activationState === "waiting"
          ? "按需待命"
          : plugin.enabled
            ? "已启用"
            : "已停用"
      }}</span>
      <div class="plugin-actions">
        <component
          v-if="plugin.nativeWindow"
          :is="controls.UiButton"
          :disabled="state.busy || !plugin.enabled"
          :aria-label="'打开独立窗口 ' + plugin.name"
          @click="run(() => api.openWindow(plugin.id))"
          >打开独立窗口</component
        >
        <component
          :is="controls.UiButton"
          :disabled="state.busy || !state.desktop"
          :aria-label="'打开插件文件夹 ' + plugin.name"
          :title="
            state.desktop
              ? '在文件资源管理器中打开此插件目录'
              : '打开文件夹需要桌面版'
          "
          @click="run(() => api.openDirectory(plugin.id))"
          >打开文件夹</component
        >
        <span v-if="plugin.protected">管理入口</span>
        <component
          v-else
          :is="controls.UiButton"
          :disabled="state.busy"
          :aria-label="(plugin.enabled ? '停用 ' : '启用 ') + plugin.name"
          @click="changeEnabled(plugin.id, !plugin.enabled)"
          >{{ plugin.enabled ? "停用" : "启用" }}</component
        >
        <template v-if="plugin.source === 'local'">
          <component
            :is="controls.UiButton"
            :disabled="state.busy"
            @click="inspect(plugin.id)"
            >编辑声明</component
          >
          <component
            :is="controls.UiButton"
            :disabled="state.busy"
            @click="run(() => api.reload(plugin.id))"
            >重新加载</component
          >
          <component
            :is="controls.UiButton"
            :disabled="state.busy"
            @click="choose(plugin.id)"
            >更换目录</component
          >
          <component
            :is="controls.UiButton"
            :disabled="state.busy"
            @click="removePlugin(plugin.id)"
            >移除登记</component
          >
        </template>
      </div>
    </div>
  </component>
  <PluginImpactDialog
    :controls="controls"
    :impact="pending?.impact || null"
    :remove="pending?.remove || false"
    :busy="state.busy"
    :error="impactError"
    @cancel="pending = null"
    @confirm="confirmImpact"
  />
  <component
    :is="controls.UiDialog"
    :visible="!!draft"
    title="本地插件声明"
    close-label="关闭插件声明"
    @close="draft = null"
  >
    <form
      v-if="draft && manifest"
      id="plugin-manifest-form"
      @submit.prevent="save()"
    >
      <p>{{ draft.directory }}</p>
      <p>
        {{
          draft.hasManifest
            ? "已读取声明，可检查或修改后加载。"
            : "未找到 studio-plugin.json，请填写声明。"
        }}
      </p>
      <p v-if="manifest.kind === 'declarative'">
        仅保存 JSON，由内置声明式插件执行受支持的动作，无需脚本入口。
        面板使用公共 UI 组件，工作流修改支持撤销，所需权限根据动作自动生成。
      </p>
      <p v-else>
        入口在独立隔离进程运行。节点插件贡献两阶段 IR，逻辑/UI
        插件可创建声明式面板、编辑当前草稿或提供 JSON API。extension.window
        可在自己的原生窗口运行 DOM/Canvas/WebGL 界面（框架须本地预编译）。
        数据文件、指定 HTTPS
        来源与固定后台任务必须另行声明，无任意文件路径或命令执行权限。
      </p>
      <component :is="controls.UiField" label="插件类型" for="plugin-kind">
        <component
          :is="controls.UiSelect"
          id="plugin-kind"
          :model-value="manifest.kind"
          :options="[
            { value: 'nodes', label: '节点插件' },
            { value: 'extension', label: '逻辑与 UI 插件' },
            { value: 'declarative', label: '无脚本声明式插件' },
          ]"
          @update:model-value="changeKind"
        />
      </component>
      <component :is="controls.UiField" label="显示名称" for="plugin-name"
        ><component
          :is="controls.UiInput"
          id="plugin-name"
          v-model="manifest.name"
          required
          maxlength="100"
      /></component>
      <component :is="controls.UiField" label="插件 ID" for="plugin-id"
        ><component
          :is="controls.UiInput"
          id="plugin-id"
          v-model="manifest.id"
          :readonly="!!draft.replaceId"
          required
          placeholder="local.my-effect"
      /></component>
      <component :is="controls.UiField" label="插件版本" for="plugin-version"
        ><component
          :is="controls.UiInput"
          id="plugin-version"
          v-model="manifest.version"
          required
      /></component>
      <component
        v-if="manifest.kind !== 'declarative'"
        :is="controls.UiField"
        label="入口文件"
        for="plugin-entry"
        ><component
          :is="controls.UiInput"
          id="plugin-entry"
          v-model="manifest.entry"
          list="plugin-entries"
          required
      /></component>
      <datalist id="plugin-entries">
        <option v-for="entry in draft.entries" :key="entry" :value="entry" />
      </datalist>
      <component
        v-if="manifest.kind !== 'declarative'"
        :is="controls.UiField"
        label="导出名称"
        for="plugin-export-name"
        ><component
          :is="controls.UiInput"
          id="plugin-export-name"
          v-model="manifest.exportName"
          required
      /></component>
      <component
        v-if="manifest.kind !== 'declarative'"
        :is="controls.UiCheckbox"
        id="plugin-create-template"
        v-model="createTemplate"
        >生成{{
          manifest.kind === "nodes" ? "“数值翻倍”节点" : "“右移节点”面板"
        }}入口（仅新文件，不覆盖已有代码）</component
      >
      <DeclarationEditor
        v-if="manifest.kind === 'declarative'"
        :model-value="manifest.declaration"
        :controls="controls"
        @update:model-value="editDeclaration"
      />
      <details :open="manifest.kind !== 'nodes'">
        <summary>能力与 API 声明</summary>
        <p>
          extension.ui：创建自己的面板，workflow.read：读取当前草稿，workflow.write：修改当前草稿，可撤销。自定义
          API
          的权限由提供者契约定义。declarations.mount：安装自己的无脚本面板与动作。
          extension.files：插件自己的文本数据，extension.network：isolation.networkOrigins
          中的 HTTPS GET， extension.tasks：摘要/JSON
          校验短进程，extension.window：isolation.window 尺寸的独立窗口。
        </p>
        <component
          :is="controls.UiTextarea"
          id="plugin-permissions"
          aria-label="能力与 API 声明"
          :model-value="permissions"
          :readonly="manifest.kind === 'declarative'"
          :rows="12"
          @update:model-value="
            (v: unknown) => {
              permissions = String(v);
              approved = false;
            }
          "
        />
      </details>
      <component
        :is="controls.UiCheckbox"
        id="plugin-approve-permissions"
        v-model="approved"
        >允许当前插件内容、能力和 API，内容变化后需重新审阅</component
      >
      <p v-if="draft?.contentChanged">
        插件内容与上次授权不同，请审阅当前源码和声明后重新允许。
      </p>
      <p v-if="formError" role="alert">{{ formError }}</p>
      <component
        v-if="draft?.hasManifest && !createTemplate"
        :is="controls.UiButton"
        id="plugin-authorize"
        type="button"
        :disabled="state.busy || !approved"
        @click="save(true)"
        >仅授权，稍后登记</component
      >
      <component
        :is="controls.UiButton"
        id="plugin-save"
        type="submit"
        variant="primary"
        :disabled="state.busy"
        >保存并加载</component
      >
    </form>
  </component>
</template>
<style scoped>
.plugin-entry {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}
.plugin-details {
  flex: 1;
  min-width: 200px;
  overflow-wrap: anywhere;
}
.plugin-details small {
  display: block;
  margin-top: 4px;
  color: var(--color-text-muted);
}
.plugin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
form {
  display: grid;
  gap: 12px;
  min-width: 420px;
  max-width: 680px;
}
form label {
  display: grid;
  gap: 6px;
}
form label:has(input[type="checkbox"]) {
  display: flex;
  align-items: center;
}
form p {
  overflow-wrap: anywhere;
}
</style>

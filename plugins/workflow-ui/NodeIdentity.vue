<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
const props = defineProps<{ session: any; node: any }>();
const { UiInput, UiButton } = props.session.ui.components;
const value = ref(""),
  error = ref(""),
  busy = ref(false),
  root = ref<HTMLElement>();
let source: any;
watch(
  () => [
    props.node.id,
    props.session.snapshot.value.documentToken,
    props.session.snapshot.value.stage,
  ],
  () => {
    value.value = props.node.id;
    error.value = "";
    source = props.session.workflow.snapshot();
  },
  { immediate: true },
);
watch(
  () => props.session.model.renameSignal,
  async () => {
    await nextTick();
    const input = root.value?.querySelector("input");
    input?.focus();
    input?.select();
  },
);
async function commit() {
  if (busy.value || value.value === props.node.id) return;
  busy.value = true;
  error.value = "";
  const id = value.value.trim();
  try {
    await props.session.batch(
      [{ type: "RENAME_NODE_ID", payload: { nodeId: props.node.id, id } }],
      source,
    );
    await props.session.select([id]);
  } catch (e) {
    error.value = String(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section ref="root" class="node-identity">
    <label for="node-custom-id">节点 ID（GLSL 名称）</label>
    <div class="identity-row">
      <UiInput
        id="node-custom-id"
        v-model="value"
        :disabled="busy"
        @focus="source = session.workflow.snapshot()"
        @keydown.enter.prevent="commit"
      /><UiButton
        id="apply-node-id"
        :disabled="busy || value === node.id"
        @click="commit"
        >应用 ID</UiButton
      >
    </div>
    <small
      >英文、数字、下划线，不能数字开头。生成变量如 wf_你的ID_输出端口，参数 ID
      可在下方单独设置。</small
    >
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<style scoped>
.node-identity {
  display: grid;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.identity-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.identity-row :deep(input) {
  flex: 1;
  min-width: 120px;
  width: 0;
}
.node-identity small {
  color: var(--muted);
  line-height: 1.5;
}
.node-identity p {
  color: var(--color-danger);
}
</style>

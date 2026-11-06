<script setup lang="ts">
import { computed } from "vue";
import CustomNodeEditor from "./CustomNodeEditor.vue";
import NodeIdentity from "./NodeIdentity.vue";
const props = defineProps<{ session: any }>(),
  { UiRenderer } = props.session.ui.components;
const entry = computed(() =>
  props.session.projection.value.nodes.find(
    (e: any) => e.node.id === props.session.snapshot.value.selection[0],
  ),
);
const custom = computed(() => {
  const s = props.session.snapshot.value;
  if (!s.customNodeEditing) return null;
  const draft = props.session.model.custom;
  if (draft && !draft.definition) return draft;
  const id = draft?.definition?.typeId ?? entry.value?.node.typeId;
  const definition = s.customNodes.find((n: any) => n.typeId === id);
  if (!definition || (!draft && entry.value?.missing)) return null;
  return { definition, nodeId: draft ? undefined : entry.value?.node.id };
});
const readiness = computed(
  () =>
    props.session.snapshot.value.exportReadiness || {
      ready: false,
      message: "导出插件未启用",
    },
);
function fieldProps(field: any) {
  const nodeId = entry.value.node.id,
    source = props.session.snapshot.value;
  const isTime = entry.value.node.typeId === "input.time" && field.key === "defaultValue";
  return {
    ...(isTime ? { preview: props.session.preview } : {}),
    controls: props.session.ui.components,
    nodeId,
    field,
    onCommit: async (value: unknown) => {
      // 播放不写文档。显式编辑才更新起始值，即使再次输入同一个数也能重置时钟。
      if (isTime && Number(value) === Number(field.value)) {
        const current = props.session.snapshot.value;
        if (current.documentToken !== source.documentToken || current.stage !== source.stage ||
          current.documentRevision !== source.documentRevision) throw Error("工作流已改变，请重新设置时间。");
        return props.session.preview.setPlayback({ time: Number(value) });
      }
      const result = await props.session.workflow.setProperty(
        { nodeId, key: field.key, value },
        props.session.guard(source),
      );
      return result;
    },
  };
}
</script>
<template>
  <div
    id="inspector-content"
    :class="{
      'inspector-empty': !entry && !custom,
      'custom-inline-editor': !!custom,
    }"
  >
    <NodeIdentity v-if="entry" :session="session" :node="entry.node" />
    <CustomNodeEditor
      v-if="custom"
      :key="custom.definition?.typeId || 'new'"
      :session="session"
      :definition="custom.definition"
      :node-id="custom.nodeId"
    /><template v-else-if="entry"
      ><UiRenderer
        v-for="field in entry.fields"
        :key="entry.node.id + field.key"
        kind="field"
        :type="entry.node.typeId + '.' + field.key"
        :value="fieldProps(field)"
      />
      <section class="node-description">
        <strong>节点说明</strong>
        <p>{{ entry.description }}</p>
        <div class="node-contract">
          <span
            >输入：{{
              entry.definition.inputs
                .map((p: any) => `${p.name}: ${p.type}`)
                .join("，") || "无"
            }}</span
          ><span
            >输出：{{
              entry.definition.outputs
                .map((p: any) => `${p.name}: ${p.type}`)
                .join("，") || "无"
            }}</span
          >
        </div>
      </section>
      <p v-if="entry.missing">
        节点插件未启用。属性、端口和连线已保留，启用对应插件后可继续编辑和导出。
      </p></template
    ><template v-else>选择一个节点以编辑它的属性。</template>
  </div>
  <section class="compile-card">
    <div class="compile-title">
      <span>导出状态</span
      ><span class="pill" :class="{ invalid: !readiness.ready }">{{
        readiness.ready ? "可导出" : "不可导出"
      }}</span>
    </div>
    <div id="compile-message">{{ readiness.message }}</div>
  </section>
</template>

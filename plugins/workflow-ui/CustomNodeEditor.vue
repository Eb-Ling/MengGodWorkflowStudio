<script setup lang="ts">
import { reactive, watch } from "vue";
const props = defineProps<{
    session: any;
    definition?: any;
    nodeId?: string;
  }>(),
  { UiInput, UiSelect, UiCheckbox, UiTextarea, UiButton, UiField } =
    props.session.ui.components;
const draft = reactive({
  title: "",
  parameters: [] as any[],
  code: "",
  targets: [] as string[],
  error: "",
});
function load() {
  const d = props.definition;
  draft.title = d?.title || "Custom Node";
  draft.parameters = JSON.parse(
    JSON.stringify(
      d?.properties?.parameters || [
        { id: "uv", name: "uv", type: "VEC2", qualifier: "in" },
        { id: "value", name: "value", type: "FLOAT", qualifier: "out" },
      ],
    ),
  ).map((p: any) => ({ ...p, type: p.type.toUpperCase() }));
  draft.code = d?.properties?.code || "value = 0.0;";
  draft.targets = [
    ...(d?.properties?.sourceTargets || ["glsl-es-300", "glsl-430"]),
  ];
  draft.error = "";
}
const crypto = globalThis.crypto;
watch([() => props.definition?.typeId, () => props.nodeId], load, {
  immediate: true,
});
function target(id: string, checked: boolean) {
  draft.targets = checked
    ? [...draft.targets.filter((x) => x !== id), id]
    : draft.targets.filter((x) => x !== id);
}
async function save() {
  try {
    const title = draft.title.trim() || "Custom Node";
    await props.session.action("UPSERT_CUSTOM_NODE", {
      definition: {
        ...(props.definition?.typeId
          ? { typeId: props.definition.typeId }
          : {}),
        title,
        parameters: draft.parameters.map((p) => ({
          ...p,
          name: p.name.trim(),
        })),
        code: draft.code,
        helperSource: props.definition?.properties?.helperSource || "",
        sourceTargets: draft.targets,
      },
    });
    if (props.nodeId)
      await props.session.batch([
        { type: "RENAME_NODE", payload: { nodeId: props.nodeId, title } },
      ]);
    else if (props.session.model.custom) {
      const saved = props.session.workflow
        .snapshot()
        .catalog.find(
          (node: any) =>
            node.typeId === props.definition?.typeId ||
            (!props.definition?.typeId &&
              node.title === title &&
              node.typeId.startsWith("custom.")),
        );
      if (saved) props.session.model.custom = { definition: saved };
    }
    draft.error = "";
    props.session.report("已保存自定义节点：" + title);
  } catch (e: any) {
    draft.error = e.message;
    props.session.report(e.message);
  }
}
</script>
<template>
  <UiField class="field" label="节点名称"
    ><UiInput id="custom-editor-title" v-model="draft.title"
  /></UiField>
  <section class="custom-parameter-editor">
    <div class="custom-parameter-heading">
      <label>函数参数</label><span>名称 · GLSL 类型 · I/O</span>
    </div>
    <div id="custom-parameter-list">
      <div
        v-for="p in draft.parameters"
        :key="p.id"
        class="custom-parameter-row"
        :data-id="p.id"
      >
        <UiInput
          v-model="p.name"
          class="custom-param-name"
          aria-label="参数名称"
        /><UiSelect
          v-model="p.type"
          class="custom-param-type"
          aria-label="GLSL 类型"
          :options="session.projection.value.types"
        /><UiSelect
          v-model="p.qualifier"
          class="custom-param-qualifier"
          aria-label="参数方向"
          :options="
            ['in', 'out', 'inout'].map((value) => ({ value, label: value }))
          "
        /><UiButton
          class="icon-button custom-param-delete"
          title="删除参数"
          @click="draft.parameters = draft.parameters.filter((x) => x !== p)"
          >×</UiButton
        >
      </div>
    </div>
    <UiButton
      id="custom-add-parameter"
      class="small-button"
      @click="
        draft.parameters.push({
          id: crypto.randomUUID(),
          name: 'value' + (draft.parameters.length + 1),
          type: 'FLOAT',
          qualifier: 'in',
        })
      "
      >+ 添加参数</UiButton
    ><small class="type-hint"
      >in 生成输入端口，out 生成输出端口，inout 同时生成两个端口。</small
    >
  </section>
  <UiField
    class="field"
    label="GLSL 函数体"
    hint="填写函数体，无需函数签名。out / inout 参数须在函数体中赋值。"
    ><UiTextarea
      id="custom-editor-code"
      v-model="draft.code"
      rows="14"
      :spellcheck="false" /></UiField
  ><UiField class="field" label="支持的编译目标"
    ><UiCheckbox
      :model-value="draft.targets.includes('glsl-es-300')"
      aria-label="支持 WebGL2 预览"
      @update:model-value="target('glsl-es-300', $event)"
      >WebGL2 / ES 3.00</UiCheckbox
    ><UiCheckbox
      :model-value="draft.targets.includes('glsl-430')"
      aria-label="支持 GLSL 430 导出"
      @update:model-value="target('glsl-430', $event)"
      >OpenGL / GLSL 430</UiCheckbox
    ></UiField
  >
  <p v-if="draft.error" role="alert" class="ui-field-error">
    {{ draft.error }}
  </p>
  <div class="editor-actions">
    <UiButton class="save-custom" @click="save">保存节点定义</UiButton
    ><UiButton
      v-if="nodeId"
      class="delete-custom"
      @click="
        session.run(() =>
          session.batch([{ type: 'REMOVE_NODE', payload: { nodeId } }]),
        )
      "
      >删除画布节点</UiButton
    >
  </div>
</template>

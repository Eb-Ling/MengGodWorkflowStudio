<script setup lang="ts">
import { computed, useId } from "vue";
const props = defineProps<{ session: any }>(),
  { UiInput, UiButton, UiSectionHeading } = props.session.ui.components;
const catalogId = useId();
const categories = computed(() => {
  const groups = new Map<string, any[]>();
  for (const n of props.session.snapshot.value.catalog) {
    if (
      ![n.title, n.typeId, n.category]
        .join(" ")
        .toLowerCase()
        .includes(props.session.model.search.toLowerCase())
    )
      continue;
    const category = n.category || "其他";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(n);
  }
  return [...groups].map(([title, nodes]) => ({ title, nodes }));
});
const templates = computed(() =>
  props.session.snapshot.value.workflowNodes.filter((n: any) =>
    [n.title, n.description]
      .join(" ")
      .toLowerCase()
      .includes(props.session.model.search.toLowerCase()),
  ),
);
const editable = computed(
  () =>
    new Set(
      props.session.snapshot.value.customNodes?.map((n: any) => n.typeId),
    ),
);
const custom = (n: any) => {
  props.session.model.custom = { definition: n };
};
function drag(e: DragEvent, key: string, value: string) {
  e.dataTransfer?.setData(key, value);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
}
function remove(e: MouseEvent, n: any, template = false) {
  e.preventDefault();
  if (n.preset) return;
  if (!confirm("删除“" + n.title + "”？已有图中内容不会删除。")) return;
  void props.session.run(() =>
    props.session.action(
      template ? "DELETE_WORKFLOW_NODE" : "DELETE_CUSTOM_NODE",
      template ? { id: n.id } : { typeId: n.typeId },
    ),
  );
}
</script>
<template>
  <div class="catalog-search">
    <UiInput
      id="node-search"
      v-model="session.model.search"
      aria-label="搜索节点"
      placeholder="搜索节点…"
      autocomplete="off"
    />
  </div>
  <div id="node-catalog" class="node-catalog">
    <UiButton
      v-if="session.snapshot.value.customNodeEditing"
      id="create-custom-node"
      class="catalog-create-custom"
      @click="session.model.custom = {}"
      >+ 创建自定义 GLSL 节点</UiButton
    >
    <p v-else class="type-hint">
      在插件中心启用「自定义 GLSL 节点」即可创建节点。
    </p>
    <section
      v-if="templates.length"
      class="catalog-category workflow-node-category"
    >
      <UiSectionHeading title="工作流节点" :count="templates.length" />
      <div class="catalog-entries">
        <div
          v-for="n in templates"
          :key="n.id"
          class="catalog-node workflow-catalog-node"
          :data-workflow-node-id="n.id"
          :title="n.description"
          draggable="true"
          @dragstart="drag($event, 'workflow-node-id', n.id)"
          @contextmenu="remove($event, n, true)"
        >
          <span class="catalog-dot" /><span>{{ n.title }}</span
          ><small v-if="!n.preset">用户</small>
        </div>
      </div>
    </section>
    <section
      v-for="(group, index) in categories"
      :key="group.title"
      class="catalog-category"
      :class="{ collapsed: session.model.collapsed.includes(group.title) }"
    >
      <UiSectionHeading
        :title="group.title"
        :count="group.nodes.length"
        :expanded="!session.model.collapsed.includes(group.title)"
        :controls-id="catalogId + '-' + index"
        @toggle="session.collapse(group.title)"
      />
      <div
        :id="catalogId + '-' + index"
        v-show="!session.model.collapsed.includes(group.title)"
        class="catalog-entries"
      >
        <div
          v-for="n in group.nodes"
          :key="n.typeId"
          class="catalog-node"
          :data-type="n.typeId"
          :title="n.title + ' · ' + n.typeId"
          draggable="true"
          @dragstart="drag($event, 'node-type', n.typeId)"
          @dblclick="editable.has(n.typeId) && custom(n)"
          @contextmenu="editable.has(n.typeId) && remove($event, n)"
        >
          <span class="catalog-dot" /><span>{{ n.title }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ session: any }>(),
  s = props.session,
  { UiField, UiSelect, UiButton } = s.ui.components;
const groups = [
  { kind: "selection", label: "框选规则" },
  { kind: "layers", label: "节点显示顺序" },
  { kind: "layout", label: "自动布局策略" },
];
function choose(kind: string, id: unknown) {
  void s.run(() => s.interaction.activate({ kind, id: String(id) }));
}
async function arrange() {
  await s.run(async () => {
    const source = s.workflow.snapshot();
    const plan = await s.interaction.evaluate({
      kind: "layout",
      input: { graph: source.graph },
    });
    await s.batch(
      plan.positions.map((p: any) => ({ type: "MOVE_NODE", payload: p })),
      source,
    );
  });
}
</script>
<template>
  <div class="canvas-tools">
    <UiField v-for="g in groups" :key="g.kind" :label="g.label"
      ><UiSelect
        :aria-label="g.label"
        :model-value="
          s.model.strategies.find((p: any) => p.kind === g.kind && p.active)?.id
        "
        :options="
          s.model.strategies
            .filter((p: any) => p.kind === g.kind)
            .map((p: any) => ({ value: p.id, label: p.title }))
        "
        @update:model-value="
          (value: unknown) => choose(g.kind, value)
        " /></UiField
    ><UiButton id="apply-canvas-layout" @click="arrange">应用布局策略</UiButton
    ><small>显示顺序仅影响编辑器内遮挡。布局作为一次操作提交，可撤销。</small>
  </div>
</template>
<style scoped>
.canvas-tools {
  padding: 10px;
}
.canvas-tools small {
  display: block;
  margin-top: 10px;
  color: var(--muted);
}
</style>

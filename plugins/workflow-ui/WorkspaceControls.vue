<script setup lang="ts">
const props = defineProps<{ session: any; variant: "stages" | "actions" }>();
const { UiButton } = props.session.ui.components;
const run = (type: string, payload = {}) =>
  props.session.run(() => props.session.action(type, payload));
</script>
<template>
  <nav v-if="variant === 'stages'" class="page-tabs" aria-label="着色阶段">
    <a
      v-for="stage in ['fragment', 'vertex']"
      :key="stage"
      class="page-tab"
      :class="{ active: session.snapshot.value.stage === stage }"
      :data-stage="stage"
      :href="'./index.html?stage=' + stage"
      @click.prevent="run('SET_STAGE', { stage })"
      ><span class="stage-indicator" :class="stage" />{{
        stage === "fragment" ? "片段工作流" : "顶点工作流"
      }}</a
    >
  </nav>
  <template v-else>
    <UiButton
      id="auto-layout"
      variant="ghost"
      title="按连线布局，控制区域整体平移，一次撤销"
      @click="run('AUTO_LAYOUT')"
      >自动布局</UiButton
    >
    <UiButton
      id="new-graph"
      variant="ghost"
      title="重置当前阶段"
      @click="run('RESET_CURRENT_DRAFT')"
      ><span class="compact-action-label">重置流程</span></UiButton
    >
    <UiButton id="add-demo" variant="ghost" @click="run('ADD_DEMO')"
      ><span class="compact-action-label">演示节点</span></UiButton
    >
  </template>
</template>

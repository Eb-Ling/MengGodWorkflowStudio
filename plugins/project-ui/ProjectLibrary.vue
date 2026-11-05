<script setup lang="ts">
import { templateOperations } from "../../packages/workflow-tools/index.mjs";
const props = defineProps<{
    session: any;
    examples: boolean;
    onRequestClose?: () => void;
  }>(),
  s = props.session,
  { UiButton } = s.ui.components;
async function open(id: string) {
  await s.run(async () => {
    await s.action("OPEN_WORKFLOW", { id });
    props.onRequestClose?.();
  });
}
async function example(id: string) {
  await s.run(async () => {
    if (id === "mingGod") await s.action("LOAD_MING_GOD_EXAMPLE");
    else {
      const r = await s.templates.example({ id });
      const document = structuredClone(r.workflow);
      document.project.id = "instance_" + crypto.randomUUID();
      await s.action("IMPORT_WORKFLOW_DATA", { workflow: document });
    }
    props.onRequestClose?.();
  });
}
</script>
<template>
  <div v-if="!examples" id="saved-workflows" class="saved-workflows">
    <p v-if="!s.snapshot.value.savedWorkflows.length" class="readonly">
      暂无保存的工作流。
    </p>
    <div
      v-for="item in s.snapshot.value.savedWorkflows"
      :key="item.id"
      class="saved-workflow"
      :class="{ active: item.id === s.snapshot.value.project.id }"
    >
      <span class="saved-workflow-title"
        >{{ item.title
        }}<small>{{ item.file?.path || item.shaderDir }}</small></span
      ><UiButton :data-open="item.id" @click="open(item.id)">打开</UiButton
      ><UiButton
        :data-delete="item.id"
        class="delete-workflow"
        @click="s.run(() => s.action('DELETE_WORKFLOW', { id: item.id }))"
        >删除</UiButton
      >
    </div>
  </div>
  <div v-else id="example-workflows" class="saved-workflows">
    <div class="saved-workflow">
      <span class="saved-workflow-title"
        >明神印记旋涡<small>Meng_MingGodSignPlugin</small></span
      ><UiButton
        data-open-example
        :disabled="!s.operationIds.value.includes(templateOperations.example)"
        @click="example('mingGod')"
        >载入</UiButton
      >
    </div>
    <div class="saved-workflow">
      <span class="saved-workflow-title"
        >实例波动四边形<small
          >四顶点摆动 / 倾斜演示，非连续波浪，无伤害逻辑</small
        ></span
      ><UiButton
        id="open-instance-example"
        :disabled="!s.operationIds.value.includes(templateOperations.example)"
        @click="example('instancedWave')"
        >创建</UiButton
      >
    </div>
  </div>
</template>

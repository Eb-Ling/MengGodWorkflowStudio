<script setup lang="ts">
const props = defineProps<{ session: any; mode: "title" | "toolbar" }>(),
  s = props.session,
  { UiButton } = s.ui.components;
</script>
<template>
  <template v-if="mode === 'title'"
    ><UiButton id="save-workflow" @click="s.run(s.save)">保存工作流</UiButton
    ><UiButton
      id="export-runtime"
      variant="primary"
      @click="s.run(s.exportEffect)"
      >导出运行文件</UiButton
    ></template
  ><template v-else
    ><UiButton
      id="import-workflow"
      variant="ghost"
      @click="s.model.importOpen = true"
      >导入工作流</UiButton
    ><UiButton
      id="runtime-dependency-settings"
      variant="ghost"
      @click="s.runtime()"
      >运行依赖设置</UiButton
    ></template
  >
</template>

<script setup lang="ts">
import { computed } from "vue";
import { uiSurface } from "../../../packages/ui-kit/surface";
const props = defineProps<{
  category: "management" | "settings" | "developer";
}>();
const settingsPanels = computed(() =>
  (uiSurface.value?.settingsPanels.value || []).filter(
    (p: any) => p.category === props.category,
  ),
);
import { ExtensionPanel, UiDisclosure } from "../api";
</script>
<template>
  <section class="plugin-settings" aria-label="插件设置">
    <p v-if="!settingsPanels.length" class="readonly">
      此分区暂无已启用插件提供的设置。
    </p>
    <template v-if="category === 'settings'">
      <p v-if="settingsPanels.length" class="settings-intro">
        选择插件展开配置，可以同时展开多个，收起后保留当前输入。
      </p>
      <UiDisclosure
        v-for="panel in settingsPanels"
        :key="panel.id"
        :title="panel.title"
        label="插件配置"
        :data-settings-panel="panel.id"
      >
        <ExtensionPanel :mount="panel.mount" />
      </UiDisclosure>
    </template>
    <template v-else>
      <ExtensionPanel
        v-for="panel in settingsPanels"
        :key="panel.id"
        :mount="panel.mount"
      />
    </template>
  </section>
</template>
<style scoped>
.plugin-settings {
  display: grid;
  gap: 20px;
  min-width: 0;
}
.settings-intro {
  margin: 0;
  color: var(--color-text-muted);
}
</style>

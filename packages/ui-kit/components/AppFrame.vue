<script setup lang="ts">
import { ref, computed } from "vue";
import { uiSurface } from "../surface";
import UiSplitView from "./UiSplitView.vue";
import UiDock from "./UiDock.vue";
const left = ref(222),
  right = ref(272),
  leftClosed = ref(false),
  rightClosed = ref(false);
const docks = computed(() => uiSurface.value?.docks.value || []);
const side = (name: string) => docks.value.filter((d: any) => d.side === name);
</script>
<template>
  <div class="studio-frame">
    <slot name="titlebar" />
    <slot name="toolbar" />
    <main class="workspace">
      <UiSplitView
        :size="leftClosed ? 34 : left"
        :min="leftClosed ? 34 : 170"
        :max="leftClosed ? 34 : 400"
        :reserve="320"
        label="调整节点库宽度"
        @update:size="
          (v) => {
            if (!leftClosed) left = v;
          }
        "
      >
        <template #first
          ><UiDock
            title="节点库"
            rail
            side="left"
            v-model:collapsed="leftClosed"
            ><slot name="navigation" /></UiDock
          ><UiDock
            v-for="d in side('left')"
            v-show="!leftClosed"
            :key="d.id"
            :title="d.title"
            :default-collapsed="d.defaultCollapsed"
            side="left"
            ><component :is="d.component" v-bind="d.props" /></UiDock
        ></template>
        <template #second
          ><UiSplitView
            reverse
            :size="rightClosed ? 34 : right"
            :min="rightClosed ? 34 : 200"
            :max="rightClosed ? 34 : 480"
            :reserve="180"
            label="调整检查器宽度"
            @update:size="
              (v) => {
                if (!rightClosed) right = v;
              }
            "
            ><template #first><slot /></template
            ><template #second
              ><UiDock
                title="检查器"
                rail
                side="right"
                v-model:collapsed="rightClosed"
                ><slot name="inspector" /></UiDock
              ><UiDock
                v-for="d in side('right')"
                v-show="!rightClosed"
                :key="d.id"
                :title="d.title"
                :default-collapsed="d.defaultCollapsed"
                side="right"
                ><component
                  :is="d.component"
                  v-bind="d.props" /></UiDock></template></UiSplitView
        ></template>
      </UiSplitView>
      <div v-if="side('bottom').length" class="ui-bottom-docks">
        <UiDock
          v-for="d in side('bottom')"
          :key="d.id"
          :title="d.title"
          :default-collapsed="d.defaultCollapsed"
          side="bottom"
          ><component :is="d.component" v-bind="d.props"
        /></UiDock>
      </div>
    </main>
    <slot name="statusbar" />
  </div>
</template>
<style scoped>
.ui-bottom-docks {
  display: flex;
  max-height: 30%;
  min-height: 32px;
  flex-shrink: 0;
}
</style>

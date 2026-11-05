<script setup lang="ts">
import { ref, computed } from "vue";
import UiButton from "./UiButton.vue";
import type { UiDockProps } from "../types";
const props = withDefaults(defineProps<UiDockProps>(), {
  collapsed: undefined,
  defaultCollapsed: false,
});
const emit = defineEmits<{ "update:collapsed": [value: boolean] }>();
const local = ref(props.defaultCollapsed ?? false),
  closed = computed(() => props.collapsed ?? local.value);
function toggle() {
  local.value = !closed.value;
  emit("update:collapsed", local.value);
}
</script>
<template>
  <section
    class="ui-dock"
    :class="{ collapsed: closed, rail: closed && rail }"
    :data-side="side"
    :aria-label="title"
  >
    <header class="ui-dock-heading">
      <UiButton
        variant="ghost"
        class="ui-dock-toggle"
        :aria-label="(closed ? '展开' : '收起') + title"
        :aria-expanded="!closed"
        @click="toggle"
        >{{ closed ? "＋" : "−" }}</UiButton
      ><strong>{{ title }}</strong
      ><slot name="actions" />
    </header>
    <div v-show="!closed" class="ui-dock-content"><slot /></div>
  </section>
</template>
<style scoped>
.ui-dock {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex: 1;
  background: var(--panel);
  overflow: hidden;
}
.ui-dock-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
}
.ui-dock-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: auto;
}
.ui-dock-toggle {
  min-width: 24px !important;
  padding: 0 5px !important;
}
.rail .ui-dock-heading {
  flex-direction: column;
  padding: 4px 0;
}
.rail strong {
  writing-mode: vertical-rl;
}
.ui-dock[data-side="bottom"].collapsed .ui-dock-heading {
  flex-direction: row;
}
.ui-dock[data-side="bottom"].collapsed strong {
  writing-mode: initial;
}
</style>
<style scoped>
.ui-dock.collapsed {
  flex: 0 0 auto;
}
</style>

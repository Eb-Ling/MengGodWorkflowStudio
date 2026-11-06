<script setup lang="ts">
import { shallowRef, onBeforeUnmount } from "vue";
const props = defineProps<{ session: any }>(),
  { UiToggle } = props.session.ui.components;
const clock = shallowRef({ available: false, playing: false, time: 0 });
const stop = props.session.preview.subscribePlayback((state: typeof clock.value) => {
  clock.value = state;
});
onBeforeUnmount(stop);
</script>
<template>
  <UiToggle
    v-if="clock.available"
    id="preview-time-toggle"
    title="播放或暂停可见预览，打开高清窗口时优先播放高清图"
    :model-value="clock.playing"
    @update:model-value="session.preview.setPlayback({ playing: $event })"
    >预览时间：{{ clock.playing ? "开" : "关" }} · {{ clock.time.toFixed(1) }} 秒</UiToggle
  >
</template>

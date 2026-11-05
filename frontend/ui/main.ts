import { startStudioPlugins } from "../application/studio-plugins";
import { createApp, nextTick } from "vue";
import StudioApp from "./StudioApp.vue";
import "../theme.css";
import "./styles/studio.css";

const app = createApp(StudioApp);
app.mount("#app");
await nextTick();
// 初始化应用接口与唯一 PluginHost，视图/表单由注册的 UI 插件拥有。
await startStudioPlugins();
document.body.dataset.uiReady = "true";

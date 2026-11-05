import { reactive } from "vue";
/** UI 插件停用后仍存在的宿主恢复端口，不直接持有插件实现。 */
export const uiRecovery = reactive({
  busy: false,
  pending:false,
  error: "",
  ready: false,
  run: async () => {},
});
export function installUiRecovery(restore: () => Promise<void>) {
  uiRecovery.ready = true;
  uiRecovery.run = async () => {
    if (uiRecovery.busy) return;
    uiRecovery.busy = true;
    uiRecovery.error = "";
    try {
      await restore();
    } catch (e) {
      uiRecovery.error = String(e);
    } finally {
      uiRecovery.busy = false;
    }
  };
}

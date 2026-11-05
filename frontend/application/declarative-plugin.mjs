/** 纯数据定义的装配适配，只传递该消费者的公开代理，不导入解释器插件实现。 */
export function declarativePlugin(prepared) {
  return {
    manifest: prepared.manifest,
    activate(context) {
      const handle = context
        .api("studio.declarations")
        .mount(prepared.manifest.declaration, {
          ui: context.api("studio.extension-ui"),
          workflow: context.api("workflow.editor"),
        });
      context.onDispose(() => handle.dispose());
    },
  };
}

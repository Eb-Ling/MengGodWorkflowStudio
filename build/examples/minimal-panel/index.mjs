// 无需 DOM、Vue 或宿主对象，面板由公共 UI 能力创建，停用时自动移除。
export const plugin = {
  async activate(context) {
    await context
      .api("studio.extension-ui")
      .create({
        id: context.pluginId + ".panel",
        title: "我的面板",
        placement: "settings",
        tree: {
          id: "message",
          type: "text",
          text: "这是一个只依赖 UI 能力的面板。",
        },
      });
  },
};

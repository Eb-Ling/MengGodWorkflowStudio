// 面板加编辑能力共两个 API，新增节点的默认值、ID 和事务由编辑能力负责。
export const plugin = {
  async activate(context) {
    const ui = context.api("studio.extension-ui"),
      editor = context.api("workflow.editor"),
      id = context.pluginId + ".panel";
    let live = true,
      busy = false,
      after = 0,
      revision = 0,
      timer;
    const tree = (text) => ({
      id: "root",
      type: "column",
      children: [
        { id: "create", type: "button", label: "新增颜色参数" },
        { id: "status", type: "text", text },
      ],
    });
    context.onDispose(() => {
      live = false;
      clearInterval(timer);
    });
    revision = (
      await ui.create({
        id,
        title: "编辑面板",
        placement: "settings",
        tree: tree("点击按钮新增一个可撤销的节点。"),
      })
    ).revision;
    timer = setInterval(async () => {
      if (!live || busy) return;
      busy = true;
      try {
        const batch = await ui.events({ after });
        after = batch.cursor;
        for (const event of batch.events) {
          if (
            !live ||
            event.panelId !== id ||
            event.revision !== revision ||
            event.controlId !== "create" ||
            event.type !== "click"
          )
            continue;
          const result = await editor.addNode({
            typeId: "io.input",
            properties: { valueType: "VEC4", defaultValue: "1,0.4,0.2,1" },
          });
          if (live)
            revision = (
              await ui.update({ id, tree: tree("已创建节点：" + result.id) })
            ).revision;
        }
      } catch (error) {
        if (live)
          try {
            revision = (
              await ui.update({
                id,
                tree: tree(String(error.message || error)),
              })
            ).revision;
          } catch {
            /* 停用时面板可能已被回收，不保留后台任务。 */
          }
      } finally {
        busy = false;
      }
    }, 150);
  },
};

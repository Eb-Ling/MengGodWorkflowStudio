import { ir } from "@workflow/plugin-sdk/ir";

// 独立目录插件只引用 SDK 和声明过的公开 API，不导入应用内部模块。
export const plugin = {
  async activate(context) {
    const targets = ["glsl-es-300", "glsl-430"],
      stages = ["vertex", "fragment"];
    const scale = context.pluginId + ".scale",
      tint = context.pluginId + ".tint";
    context.api("workflow.nodes").register({
      nodes: [
        {
          typeId: scale,
          title: "教学坐标缩放",
          category: "教学",
          inputs: [{ name: "value", type: "VEC2" }],
          outputs: [{ name: "value", type: "VEC2" }],
          properties: {},
          stages,
          targets,
        },
        {
          typeId: tint,
          title: "教学蓝色",
          category: "教学",
          inputs: [],
          outputs: [{ name: "color", type: "VEC4" }],
          properties: {},
          stages,
          targets,
        },
      ],
      compilers: targets.flatMap((target) => [
        {
          typeId: scale,
          target,
          compile: () =>
            ir.binary(
              "VEC2",
              "*",
              ir.input("VEC2", "value"),
              ir.literal("FLOAT", 0.5),
            ),
        },
        {
          typeId: tint,
          target,
          compile: () => ir.call("VEC4", "vec4", [0.2, 0.5, 0.9, 1].map((value) => ir.literal("FLOAT", value))),
        },
      ]),
    });
    const ui = context.api("studio.extension-ui"),
      editor = context.api("workflow.editor");
    const id = context.pluginId + ".guide";
    const tree = (text) => ({
      id: "root",
      type: "column",
      children: [
        { id: "guide", type: "text", text },
        { id: "add-tint", type: "button", label: "在当前阶段添加教学蓝色节点" },
      ],
    });
    let live = true,
      busy = false,
      after = 0,
      timer;
    context.onDispose(() => {
      live = false;
      clearInterval(timer);
    });
    let revision = (
      await ui.create({
        id,
        title: "双阶段特效接入指南",
        placement: "settings",
        tree: tree(
          "顶点阶段将位置接入教学坐标缩放，再连接顶点输出。片段阶段将教学蓝色连接颜色输出。新增节点可撤销，停用插件保留已有图。",
        ),
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
            event.controlId !== "add-tint" ||
            event.type !== "click"
          )
            continue;
          const node = await editor.addNode({ typeId: tint });
          if (live)
            revision = (
              await ui.update({
                id,
                tree: tree(
                  "已新增节点 " + node.id + "，请连接输出，可用撤销恢复。",
                ),
              })
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
            /* 停用时接口已回收。 */
          }
      } finally {
        busy = false;
      }
    }, 150);
  },
};

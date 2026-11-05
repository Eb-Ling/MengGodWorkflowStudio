import {
  readUiTree,
  readPanelPlacement,
} from "../../packages/plugin-sdk/extension-ui.mjs";
/** 每个消费者拥有独立面板和事件队列，组件创建经 studio.ui，生命周期仍交给内核。 */
export function createExtensionUiService(mount, makeModel) {
  const scopes = new Set(),
    views = new Map();
  let active = true;
  return {
    scoped(owner, own) {
      let live = true,
        serial = 0,
        droppedThrough = 0;
      const panels = new Map(),
        queue = [];
      const check = () => {
        if (!active || !live) throw Error("隔离面板接口已撤销");
      };
      const dispose = () => {
        if (!live) return;
        live = false;
        for (const p of panels.values()) p.handle.dispose();
        panels.clear();
        views.delete(dispose);
        queue.length = 0;
        scopes.delete(dispose);
      };
      scopes.add(dispose);
      views.set(dispose, { owner, panels });
      own(dispose);
      const lookup = (id) => {
        check();
        const p = panels.get(id);
        if (!p) throw Error("面板不属于当前插件或已移除");
        return p;
      };
      const clearPanelEvents = (id) => {
        for (let i = queue.length - 1; i >= 0; i--)
          if (queue[i].panelId === id) queue.splice(i, 1);
      };
      return {
        /** 仅返回贡献元数据，不读取界面内部状态、控件值或事件。 */
        inspect({ owner: requestedOwner }) {
          check();
          if (
            typeof requestedOwner !== "string" ||
            !requestedOwner ||
            requestedOwner.length > 160
          )
            throw Error("面板所有者 ID 无效");
          const result = [];
          for (const view of views.values())
            if (view.owner === requestedOwner)
              for (const [id, p] of view.panels) {
                const controls = [];
                const visit = (node) => {
                  controls.push({ id: node.id, type: node.type });
                  node.children?.forEach(visit);
                };
                visit(p.model.tree);
                result.push({
                  id,
                  owner: requestedOwner,
                  title: p.title,
                  placement: p.placement,
                  revision: p.model.revision,
                  controls,
                });
              }
          return { panels: result };
        },
        create({ id, title, side = "bottom", placement = "dock", tree }) {
          check();
          const location = readPanelPlacement({ placement, side });
          if (
            typeof id !== "string" ||
            !id.startsWith(owner + ".") ||
            id.length > 160 ||
            !title ||
            typeof title !== "string" ||
            title.length > 100 ||
            !["left", "right", "bottom"].includes(side)
          )
            throw Error("面板声明无效或 ID 超出所有者命名空间");
          if (panels.size >= 8 || panels.has(id))
            throw Error("面板重复或超过 8 个上限");
          const model = makeModel({ tree: readUiTree(tree), revision: 1 });
          const handle = mount({
            id: "studio.extension-ui." + id,
            title,
            ...location,
            model,
            send(event) {
              if (
                !live ||
                panels.get(id)?.model !== model ||
                event.revision !== model.revision
              )
                return;
              // 队列按面板与控件合并高频 change，点击保持顺序，所有事件有序号。
              if (event.type === "change") {
                const at = queue.findIndex(
                  (e) =>
                    e.panelId === id &&
                    e.controlId === event.controlId &&
                    e.type === "change",
                );
                if (at >= 0) queue.splice(at, 1);
              }
              if (queue.length >= 128) droppedThrough = queue.shift().sequence;
              queue.push({
                sequence: ++serial,
                panelId: id,
                revision: model.revision,
                ...structuredClone(event),
              });
            },
          });
          panels.set(id, {
            model,
            handle,
            title,
            placement: location.placement,
          });
          return { id, revision: 1 };
        },
        update({ id, tree }) {
          const p = lookup(id);
          p.model.tree = readUiTree(tree);
          clearPanelEvents(id);
          return { id, revision: ++p.model.revision };
        },
        remove({ id }) {
          check();
          const p = panels.get(id);
          if (p) {
            panels.delete(id);
            clearPanelEvents(id);
            p.handle.dispose();
          }
          return { removed: !!p };
        },
        events({ after = 0 }) {
          check();
          if (!Number.isSafeInteger(after) || after < 0 || after > serial)
            throw Error("事件游标无效");
          return {
            cursor: serial,
            events: structuredClone(queue.filter((e) => e.sequence > after)),
            truncated: after < droppedThrough,
          };
        },
      };
    },
    dispose() {
      active = false;
      for (const dispose of [...scopes]) dispose();
    },
  };
}

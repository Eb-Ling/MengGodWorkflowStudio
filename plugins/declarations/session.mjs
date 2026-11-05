import { readDeclaration } from "../../packages/plugin-sdk/declarative.mjs";
import { readUiTree } from "../../packages/plugin-sdk/extension-ui.mjs";
import { planAction } from "./planner.mjs";
/** 一个声明实例只持有自己面板、订阅和计时器，所有写入使用消费者的受控代理。 */
export function createDeclarationSession(
  owner,
  definition,
  { ui, workflow },
  schedule = (fn) => {
    const timer = setInterval(fn, 150);
    return () => clearInterval(timer);
  },
) {
  const d = readDeclaration(definition),
    id = owner + "." + d.panel.id,
    controls = new Map();
  const collect = (n) => {
    controls.set(n.id, n);
    n.children?.forEach(collect);
  };
  collect(d.tree);
  let live = true,
    busy = false,
    after = 0,
    revision = 0,
    message = "操作作用于当前工作流，修改可以撤销。",
    key = "",
    epoch = 0,
    stopTimer = () => {},
    stopSubscription = () => {},
    created = false;
  const docKey = (s) =>
    JSON.stringify([s.project.id, s.documentToken, s.stage]);
  const tree = () => ({
    id: "declaration-root",
    type: "column",
    children: [
      d.tree,
      { id: "declaration-status", type: "text", text: message },
    ],
  });
  const render = () => {
    if (live) revision = ui.update({ id, tree: tree() }).revision;
  };
  const syncDocument = () => {
    if (!live) return;
    const next = docKey(workflow.snapshot());
    if (next !== key) {
      key = next;
      epoch++;
      message = "目标工作流已切换，请重新操作。";
      if (created) render();
    }
  };
  const dispose = () => {
    if (!live) return;
    live = false;
    epoch++;
    stopTimer();
    stopSubscription();
    if (created) ui.remove({ id });
  };
  async function poll() {
    if (!live || busy) return;
    busy = true;
    let changed = false;
    try {
      syncDocument();
      const currentEpoch = epoch,
        result = ui.events({ after });
      after = result.cursor;
      if (result.truncated) throw Error("操作事件过多，请重新操作");
      for (const event of result.events) {
        if (!live || epoch !== currentEpoch) break;
        if (event.panelId !== id || event.revision !== revision) continue;
        const control = controls.get(event.controlId);
        if (!control || control.disabled) continue;
        if (
          event.type === "change" &&
          ["input", "textarea", "number", "toggle", "select"].includes(control.type)
        ) {
          const next = { ...control, value: event.value };
          readUiTree(next);
          if (
            control.type === "number" &&
            (next.value < control.min || next.value > control.max)
          )
            throw Error("数值超出字段范围");
          control.value = next.value;
          changed = true;
        } else if (event.type === "click") {
          const action = d.actions.find((a) => a.on === event.controlId);
          if (!action) continue;
          const snapshot = workflow.snapshot();
          if (docKey(snapshot) !== key) {
            syncDocument();
            break;
          }
          const plan = planAction(action, controls, snapshot);
          if (plan.request) {
            const result = await workflow.execute(plan.request);
            if (!live || epoch !== currentEpoch) break;
            if (!result.ok) throw Error(result.error || "工作流修改被拒绝");
          }
          message = plan.message;
          changed = true;
        }
      }
    } catch (error) {
      if (live) {
        message = String(error.message || error).slice(0, 1000);
        changed = true;
      }
    } finally {
      busy = false;
      if (live && changed)
        try {
          render();
        } catch {
          dispose();
        }
    }
  }
  try {
    key = docKey(workflow.snapshot());
    revision = ui.create({
      id,
      title: d.panel.title,
      placement: d.panel.placement,
      side: d.panel.side,
      tree: tree(),
    }).revision;
    created = true;
    stopSubscription = workflow.subscribe(syncDocument);
    stopTimer = schedule(() => {
      void poll();
    });
  } catch (error) {
    dispose();
    throw error;
  }
  return { dispose, poll };
}

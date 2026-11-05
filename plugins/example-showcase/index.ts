import CanvasExtension from "./CanvasExtension.vue";
import type { InteractionApi } from "../../packages/workflow-tools/interaction-types";
import { reactive } from "vue";
import type {
  PluginContext,
  WorkflowApi,
  UiApi,
  NodeApi,
  DocumentGraphCommand,
} from "../../packages/plugin-sdk/types";
import { showcaseManifest } from "./manifest.mjs";
import { tintContribution } from "./tint-node.mjs";
import ShowcasePanel from "./ShowcasePanel.vue";
import TintCard from "./TintCard.vue";
import TintField from "./TintField.vue";

/** 完整消费者示例：仅导入公开契约与自身文件，布局/交互提供者由宿主解析。 */
export const showcasePlugin = {
  manifest: showcaseManifest,
  activate(context: PluginContext) {
    const workflow = context.api<WorkflowApi>("workflow.editor");
    const nodes = context.api<NodeApi>("workflow.nodes");
    const ui = context.api<UiApi>("studio.ui");
    const layout = context.api<{
      positions(options: {
        count: number;
        columns?: number;
        spacing?: number;
      }): { x: number; y: number }[];
    }>("example.layout.grid");
    const registration = nodes.register(tintContribution());
    context.onDispose(() => registration.dispose());
    const scope = ui.createScope(showcaseManifest.id);
    context.onDispose(() => scope.dispose());
    const model = reactive({
      status: "可在当前工作流验证双阶段提交、联合历史与提供者依赖。",
      customView: false,
      canvasExtended: false,
      fine: false,
    });
    let views: { dispose(): void | Promise<void> }[] = [];
    // 必须使用同一快照的上下文。读完之后不要替用户切换工作流或重新打开文件。
    const envelope = (s: ReturnType<WorkflowApi["snapshot"]>) => ({
      documentId: s.project.id,
      documentToken: s.documentToken,
      stage: s.stage,
      expectedRevision: s.graph.revision,
      expectedDocumentRevision: s.documentRevision,
    });
    const report = async (
      pending:
        | { ok: boolean; error?: string }
        | Promise<{ ok: boolean; error?: string }>,
      success: string,
    ) => {
      const result = await pending;
      model.status = result.ok ? success : result.error || "操作失败";
    };
    const interaction = context.api<InteractionApi>("workflow.interaction");
    let canvasHandles: { dispose(): void | Promise<void> }[] = [];
    const actions = {
      toggleCanvas() {
        if (model.canvasExtended) {
          for (const h of canvasHandles) void h.dispose();
          canvasHandles = [];
          model.canvasExtended = false;
          return;
        }
        try {
          canvasHandles.push(
            interaction.register({
              id: "example.showcase.center",
              title: "示例：中心点框选",
              kind: "selection",
              run: ({ bounds, box }) => ({
                nodeIds: bounds
                  .filter(
                    (n) =>
                      n.x + n.width / 2 >= box.x &&
                      n.x + n.width / 2 <= box.x + box.width &&
                      n.y + n.height / 2 >= box.y &&
                      n.y + n.height / 2 <= box.y + box.height,
                  )
                  .map((n) => n.id),
              }),
            }),
          );
          canvasHandles.push(
            interaction.register({
              id: "example.showcase.alphabetical",
              title: "示例：按名称显示",
              kind: "layers",
              run: ({ nodes }) => ({
                nodeIds: [...nodes]
                  .sort((a, b) =>
                    String(a.title || a.id).localeCompare(
                      String(b.title || b.id),
                    ),
                  )
                  .map((n) => n.id),
              }),
            }),
          );
          canvasHandles.push(
            interaction.register({
              id: "example.showcase.translate",
              title: "示例：整体右移",
              kind: "layout",
              run: ({ graph }) => ({
                positions: graph.nodes.map((n) => ({
                  nodeId: n.id,
                  x: n.canvasX + (model.fine ? 32 : 64),
                  y: n.canvasY,
                })),
              }),
            }),
          );
          canvasHandles.push(
            ui.addDock({
              id: "example.showcase.canvas",
              title: "画布扩展示例",
              side: "bottom",
              component: CanvasExtension,
              props: { controls: ui.components, model },
            }),
          );
          model.canvasExtended = true;
        } catch (e) {
          for (const h of canvasHandles) void h.dispose();
          canvasHandles = [];
          model.status = String(e);
        }
      },
      toggleView() {
        if (model.customView) {
          for (const v of views) void v.dispose();
          views = [];
          model.customView = false;
          return;
        }
        try {
          views.push(
            ui.addRenderer({
              id: "example.showcase.tint-card",
              kind: "node",
              typeIds: ["example.showcase.tint"],
              component: TintCard,
            }),
          );
          views.push(
            ui.addRenderer({
              id: "example.showcase.tint-fields",
              kind: "field",
              typeIds: ["red", "green", "blue", "alpha"].map(
                (key) => "example.showcase.tint." + key,
              ),
              component: TintField,
            }),
          );
          model.customView = true;
        } catch (error) {
          for (const view of views) void view.dispose();
          views = [];
          model.status = String(error);
        }
      },
      create() {
        const s = workflow.snapshot(),
          positions = layout.positions({ count: 2, columns: 2 }),
          prefix = "example_" + crypto.randomUUID();
        const commands: DocumentGraphCommand[] = (["vertex", "fragment"] as const).map(
          (stage, index) => ({
            stage,
            type: "ADD_NODE",
            payload: {
              node: {
                id: prefix + "_" + stage,
                typeId: "example.showcase.tint",
                title: "示例插件颜色",
                canvasX: positions[index].x,
                canvasY: positions[index].y,
                properties: {
                  red: 0.2,
                  green: 0.6,
                  blue: 1,
                  alpha: 1,
                  previewEnabled: true,
                },
              },
            },
          }),
        );
        let output = s.document.graphs.fragment.nodes.find(
          (node) => node.typeId === "io.output",
        );
        // 初始草稿可能尚无片段输出，同一事务内补齐，才能直接预览和导出。
        if (!output) {
          output = {
            id: prefix + "_output",
            typeId: "io.output",
            title: "片段输出",
            canvasX: 650,
            canvasY: 120,
            properties: {},
          };
          commands.push({
            stage: "fragment",
            type: "ADD_NODE",
            payload: { node: output },
          });
        }
        commands.push({
          stage: "fragment",
          type: "SET_OUTPUT",
          payload: { nodeId: output.id },
        });
        commands.push({
          stage: "fragment",
          type: "CONNECT",
          payload: {
            link: {
              fromNode: prefix + "_fragment",
              fromSocket: "color",
              toNode: output.id,
              toSocket: "color",
            },
          },
        });
        report(
          workflow.execute({
            ...envelope(s),
            transaction: { commands, label: "示例：双阶段创建颜色节点" },
          }),
          "已原子创建两个阶段的节点，可一次撤销。",
        );
      },
      undo() {
        const s = workflow.snapshot();
        report(
          workflow.execute({
            ...envelope(s),
            actions: [{ type: "UNDO", payload: {} }],
          }),
          "已撤销当前阶段最近操作，联合事务同时恢复两个阶段。",
        );
      },
      redo() {
        const s = workflow.snapshot();
        report(
          workflow.execute({
            ...envelope(s),
            actions: [{ type: "REDO", payload: {} }],
          }),
          "已重做操作。",
        );
      },
      arrange() {
        const s = workflow.snapshot(),
          ids = s.selection || [];
        if (!ids.length) {
          model.status = "请先在画布选中节点。";
          return;
        }
        const positions = layout.positions({ count: ids.length });
        report(
          workflow.execute({
            ...envelope(s),
            commands: ids.map((nodeId, index) => ({
              type: "MOVE_NODE",
              payload: { nodeId, ...positions[index] },
            })),
          }),
          "已使用独立布局 API 排列选中节点。",
        );
      },
    };
    scope.register({
      id: "example.showcase.panel",
      version: "1.0.0",
      component: ShowcasePanel,
    });
    const panel = ui.addSettingsPanel({
      id: "example.showcase.panel",
      title: showcaseManifest.name,
      category: "developer",
      mount: (target) =>
        scope.create("example.showcase.panel", target, {
          controls: ui.components,
          model,
          actions,
        }),
    });
    context.onDispose(() => panel.dispose());
  },
};

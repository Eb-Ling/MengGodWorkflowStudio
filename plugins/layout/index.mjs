import { layoutOperations } from "../../packages/workflow-tools/index.mjs";
import { autoLayoutManifest } from "./manifest.mjs";
import { planLayout } from "./plan.mjs";
export const autoLayoutPlugin = {
  manifest: autoLayoutManifest,
  activate(context) {
    const workflow = context.api("workflow.editor");
    const handlers = {
      plan: planLayout,
      arrange(options) {
        const s = workflow.snapshot(),
          plan = planLayout({ ...options, graph: s.graph });
        if (!plan.positions.length) return { ok: true, moved: 0 };
        const result = workflow.execute({
          documentId: s.project.id,
          documentToken: s.documentToken,
          stage: s.stage,
          expectedRevision: s.graph.revision,
          expectedDocumentRevision: s.documentRevision,
          commands: plan.positions.map((p) => ({
            type: "MOVE_NODE",
            payload: p,
          })),
        });
        if (result?.then) throw Error("布局要求同步图事务");
        if (!result.ok) throw Error(result.error);
        return { ok: true, moved: plan.positions.length };
      },
    };
    context.provide("workflow.layout", handlers);
    context
      .api("workflow.operations")
      .register(
        Object.entries(layoutOperations).map(([name, id]) => ({
          id,
          title: "工作流布局 " + name,
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          run: handlers[name],
        })),
      );
  },
};

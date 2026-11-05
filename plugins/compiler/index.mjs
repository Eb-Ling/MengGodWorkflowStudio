import { compilerManifest } from "./manifest.mjs";
import { lowerGraph } from "./lower.mjs";
import { createCompilationCache } from "./cache.mjs";
import {
  previewFragment,
  previewVertex,
  previewScreenVertex,
} from "./preview.mjs";
import { compilationOperations } from "../../packages/shader-ir/contracts.mjs";
export const compilerPlugin = {
  manifest: compilerManifest,
  activate(context) {
    const snapshots = context.api("workflow.graph-snapshot"),
      backend = context.api("shader.backend.glsl");
    const cache = createCompilationCache(),
      namespace = crypto.randomUUID();
    let live = true;
    context.onDispose(() => {
      live = false;
      cache.dispose();
    });
    const identity = async (request) => {
      if (!live) throw Error("编译能力已停用");
      // 完整预览会编译两个阶段，单节点预览及 lowering 才能只取一个阶段的身份。
      const scope = {
        document: request.document,
        ...(request.target || request.nodeId ? { stage: request.stage } : {}),
      };
      const providers = snapshots.identity(scope);
      const content = JSON.stringify([namespace, request, providers]);
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(content),
      );
      if (!live) throw Error("编译能力已停用");
      if (
        JSON.stringify(snapshots.identity(scope)) !== JSON.stringify(providers)
      )
        throw Error("节点提供者已变化，编译身份已过期");
      return {
        key: [...new Uint8Array(digest)]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join(""),
      };
    };
    const cached = async (method, request, generate) => {
      const key = (await identity(request)).key;
      const result = await cache.run(method + ":" + key, async () => {
        const value = await generate();
        if ((await identity(request)).key !== key)
          throw Error("节点提供者已变化，编译结果已过期");
        return value;
      });
      if ((await identity(request)).key !== key)
        throw Error("节点提供者已变化，编译结果已过期");
      return result;
    };
    const describe = async (document) =>
      cached("describe", { document }, () => snapshots.describe(document));
    const lower = async (request) =>
      cached("lower", request, async () =>
        lowerGraph(await snapshots.prepare(request)),
      );
    const emit = async (module) => {
      const result = await backend.emit({ module, target: "glsl-es-300" });
      if (!result.ok)
        throw Error(result.diagnostics.map((d) => d.message).join("\n"));
      return result;
    };
    const generatePreview = async (request) => {
      const { document, stage = "fragment", nodeId, socket } = request,
        target = "glsl-es-300";
      let vertex, fragment, inputs, textures;
      if (nodeId) {
        const lowered = await lower({
          document,
          target,
          stage,
          nodeId,
          sockets: [socket],
        });
        fragment = previewFragment(lowered, true);
        vertex = previewScreenVertex();
        inputs = lowered.inputs;
        textures = lowered.textures.map((t) => ({ ...t, stage }));
      } else {
        const data = await describe(document),
          v = await lower({ document, target, stage: "vertex" }),
          f = await lower({ document, target, stage: "fragment" });
        vertex = previewVertex(v, data.geometry);
        fragment = previewFragment(f);
        inputs = data.inputs.map((p) => ({
          ...p,
          scope: data.geometry.parameterModes[p.name] ?? p.scope,
        }));
        textures = [
          ...f.textures.map((t) => ({ ...t, stage: "fragment" })),
          ...v.textures.map((t) => ({ ...t, stage: "vertex" })),
        ];
      }
      const [v, f] = await Promise.all([emit(vertex), emit(fragment)]);
      return { vertex: v, fragment: f, inputs, textures };
    };
    const preview = (request) =>
      cached("preview", request, () => generatePreview(request));
    context.provide("workflow.compilation", {
      describe,
      lower,
      preview,
      identity,
      status: () => cache.status(),
    });
    const handlers = {
      describe: ({ document }) => describe(document),
      lower,
      preview,
    };
    context.api("workflow.operations").register(
      Object.entries(compilationOperations).map(([name, id]) => ({
        id,
        title: "工作流编译 " + name,
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        run: handlers[name],
      })),
    );
  },
};

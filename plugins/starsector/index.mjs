import { createExportSession } from "./session.mjs";
import { createRuntimeHistory } from "./history.mjs";
import { starsectorManifest } from "./manifest.mjs";
import {
  starsectorOperations,
  configurationRequest,
  configurationResponse,
} from "../../packages/starsector-contract/export-api.mjs";
import { createStarsectorExport } from "./export-service.mjs";

const document = {
  type: "object",
  required: ["config", "fragment", "geometry"],
  properties: {
    config: { type: "object" },
    fragment: { type: "object" },
    geometry: { type: "object" },
  },
  additionalProperties: false,
};
const request = {
  type: "object",
  required: ["document"],
  properties: { document },
  additionalProperties: false,
};
const file = {
  type: "object",
  required: ["filename", "content"],
  properties: { filename: { type: "string" }, content: { type: "string" } },
  additionalProperties: false,
};
/** 内核激活时注册导出、说明与运行依赖，停用时所有操作由内核撤销。 */
export const starsectorPlugin = {
  manifest: starsectorManifest,
  async activate(context) {
    const compilation = context.api("workflow.compilation"),
      operations = context.api("workflow.operations");
    const runtimeTemplate = await context
      .api("platform.assets")
      .readText("runtime");
    if (!runtimeTemplate.includes("public abstract class WorkflowRuntime"))
      throw Error("Starsector 运行依赖模板缺失或无效");
    const service = createStarsectorExport({
      compilation,
      backend: context.api("shader.backend.glsl"),
      runtimeTemplate,
    });
    const session = createExportSession({
      service,
      workflow: context.api("workflow.editor"),
      files: context.api("workflow.project-files"),
      history: createRuntimeHistory(context.api("platform.export-storage")),
      downloads: context.api("platform.downloads"),
    });
    context.onDispose(() => session.dispose());
    context.provide("workflow.export", (_owner, own) => ({
      ...session,
      subscribe(fn) {
        const off = session.subscribe(fn);
        own(off);
        return off;
      },
    }));
    operations.register([
      {
        id: starsectorOperations.configuration,
        title: "Starsector 几何与依赖配置",
        inputSchema: configurationRequest,
        outputSchema: configurationResponse,
        run: service.configuration,
      },
      {
        id: starsectorOperations.export,
        title: "Starsector 三文件特效",
        inputSchema: request,
        outputSchema: {
          type: "object",
          required: ["java", "vertex", "fragment"],
          properties: { java: file, vertex: file, fragment: file },
          additionalProperties: false,
        },
        run: service.generate,
      },
      {
        id: starsectorOperations.guide,
        title: "Starsector 构造调用说明",
        inputSchema: {
          ...request,
          properties: {
            document,
            count: { type: "integer", minimum: 1, maximum: 64 },
          },
        },
        outputSchema: {
          type: "object",
          required: ["signature", "example", "description"],
          properties: {
            signature: { type: "string" },
            example: { type: "string" },
            description: { type: "string" },
          },
          additionalProperties: false,
        },
        run: service.guide,
      },
      {
        id: starsectorOperations.dependency,
        title: "Starsector 单文件公共依赖",
        inputSchema: {
          type: "object",
          required: ["runtimePath"],
          properties: { runtimePath: { type: "string" } },
          additionalProperties: false,
        },
        outputSchema: {
          type: "object",
          required: ["filename", "content", "revision"],
          properties: {
            filename: { type: "string" },
            content: { type: "string" },
            revision: { type: "string" },
          },
          additionalProperties: false,
        },
        run: service.dependency,
      },
    ]);
  },
};

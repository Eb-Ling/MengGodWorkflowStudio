import { reactive } from "vue";
import type {
  PluginContext,
  WorkflowApi,
  UiApi,
} from "../../packages/plugin-sdk/types";
import type { CompilationApi } from "../../packages/plugin-sdk/pipeline-types";
import { createPreviewService } from "./service.mjs";
import { previewManifest } from "./manifest.mjs";
import { createWebGLRenderer } from "./renderer.mjs";
import { createPreviewController } from "./controller.mjs";
import PreviewViewer from "./PreviewViewer.vue";
export const previewPlugin = {
  manifest: previewManifest,
  activate(context: PluginContext) {
    const workflow = context.api<WorkflowApi>("workflow.editor"),
      ui = context.api<UiApi>("studio.ui"),
      compilation = context.api<CompilationApi>("workflow.compilation");
    const shortcuts = context.api<any>("studio.shortcuts");
    shortcuts.register([
      {
        id: "studio.preview.fit",
        title: "预览适应窗口",
        scope: "preview",
        defaults: ["0"],
      },
      {
        id: "studio.preview.actual",
        title: "预览原始大小 1:1",
        scope: "preview",
        defaults: ["1"],
      },
      {
        id: "studio.preview.zoom-in",
        title: "放大预览",
        scope: "preview",
        defaults: ["=", "Shift+="],
      },
      {
        id: "studio.preview.zoom-out",
        title: "缩小预览",
        scope: "preview",
        defaults: ["-"],
      },
    ]);
    const model = reactive({
      visible: false,
      busy: false,
      error: "",
      width: 0,
      height: 0,
      longEdge: 2048,
      time: 0,
      playing: false,
      title: "",
      outputs: [],
      socket: "",
    });
    const renderer = createWebGLRenderer({
      compile: (request: Parameters<CompilationApi["preview"]>[0]) => compilation.preview(request),
      identity: (request: Parameters<CompilationApi["identity"]>[0]) => compilation.identity(request),
    });
    const controller = createPreviewController({
      workflow,
      renderer,
      model,
      compilation,
    });
    const service = createPreviewService(controller);
    context.onDispose(() => service.dispose());
    context.provide("workflow.preview", service.createApi);
    ui.addOverlay({
      id: "studio.preview.viewer",
      component: PreviewViewer,
      props: {
        controls: ui.components,
        shortcuts,
        model,
        actions: {
          attachCanvas: controller.attachCanvas,
          setPageVisible: controller.setPageVisible,
          setViewport: controller.setViewport,
          setPlayback: controller.editViewerPlayback,
          close: controller.close,
          refresh: () => {
            void controller.refresh().catch(() => {});
          },
          selectSocket: (socket: string) => {
            void controller.selectSocket(socket).catch(() => {});
          },
        },
      },
    });
  },
};

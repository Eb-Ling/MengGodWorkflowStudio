import { enlargedSize } from "../../packages/workflow-tools/index.mjs";
/** 插件内部渲染协调器，不查找编辑器 DOM。异步结果绑定文档及窗口代次。 */
export function createPreviewController({ workflow, renderer, model, compilation }) {
  let live = true,
    epoch = 0,
    current = null;
  function prepare(input = {}) {
    const s = workflow.snapshot(),
      stage = input.stage || s.stage;
    if (!["vertex", "fragment"].includes(stage)) throw Error("预览阶段无效");
    const document = input.document || {
      config: s.project,
      fragment: s.fragmentGraph,
      geometry: s.vertexTransform,
    };
    const graph =
      stage === "vertex" ? document.geometry.graph : document.fragment;
    let socket = input.socket;
    if (input.nodeId) {
      const node = graph.nodes.find((n) => n.id === input.nodeId);
      if (!node) throw Error("预览节点不存在");
      socket ||= (node.portSnapshot?.outputs ||
        s.catalog.find((n) => n.typeId === node.typeId)?.outputs ||
        [])[0]?.name;
      if (!socket) throw Error("节点没有可预览的输出，请选择有输出端口的节点");
    }
    return {
      request: {
        ...input,
        document,
        stage,
        catalogRevision: s.catalogRevision,
        ...(socket ? { socket } : {}),
        ...(input.longEdge !== undefined
          ? enlargedSize(
              input.width ?? document.config.previewWidth ?? 1024,
              input.height ?? document.config.previewHeight ?? 1024,
              input.longEdge,
            )
          : {
              width: input.width ?? document.config.previewWidth ?? 1024,
              height: input.height ?? document.config.previewHeight ?? 1024,
            }),
        time: input.time ?? 0,
      },
      stamp: {
        catalogRevision: s.catalogRevision,
        document: input.document
          ? null
          : JSON.stringify([s.documentToken, s.documentRevision, s.stage]),
      },
    };
  }
  function valid(stamp) {
    if (!live) throw Error("GPU 预览插件已停用");
    const s = workflow.snapshot();
    if (stamp.catalogRevision !== s.catalogRevision)
      throw Error("节点插件已变化，预览结果已过期");
    if (stamp.document) {
      if (
        stamp.document !== JSON.stringify([s.documentToken, s.documentRevision, s.stage])
      )
        throw Error("文档或阶段已变化，预览结果已过期");
    }
  }
  async function frame(input = {}) {
    const { request, stamp } = prepare(input);
    return renderer.render(request, ({ surface, width, height }) => {
      valid(stamp);
      return {
        width,
        height,
        dataUrl: surface.toDataURL("image/png"),
        stage: request.stage,
        ...(request.nodeId
          ? { nodeId: request.nodeId, socket: request.socket }
          : {}),
      };
    });
  }
  async function draw(input, present) {
    const { request, stamp } = prepare(input);
    return renderer.render(request, ({ surface, width, height }) => {
      valid(stamp);
      const presented = present({ surface, width, height });
      return { presented, width, height };
    });
  }
  function close() {
    epoch++;
    current = null;
    renderer.releaseFrame?.();
    Object.assign(model, {
      visible: false,
      busy: false,
      dataUrl: "",
      error: "",
      width: 0,
      height: 0,
    });
    return { closed: true };
  }
  async function refresh() {
    if (!current || !live) return { opened: false };
    const turn = ++epoch,
      request = current;
    Object.assign(model, { busy: true, error: "", dataUrl: "" });
    try {
      const size = enlargedSize(request.width, request.height, model.longEdge);
      const result = await frame({
        ...request,
        ...size,
        longEdge: model.longEdge,
        time: model.time,
      });
      if (turn !== epoch || !live) return { opened: false };
      Object.assign(model, result);
      return { opened: true, width: result.width, height: result.height };
    } catch (e) {
      if (turn === epoch && live) model.error = e.message;
      throw e;
    } finally {
      if (turn === epoch && live) model.busy = false;
    }
  }
  async function open(input = {}, onOpen = () => {}) {
    const prepared = prepare(input);
    current = prepared.request;
    model.longEdge = input.longEdge ?? 2048;
    model.time = input.time ?? 0;
    const graph =
        current.stage === "vertex"
          ? current.document.geometry.graph
          : current.document.fragment,
      node = graph.nodes.find((n) => n.id === input.nodeId),
      snapshot = workflow.snapshot();
    Object.assign(model, {
      visible: true,
      title: node
        ? "GPU 高清预览 · " + (node.title || node.id)
        : "GPU 高清预览 · 几何与特效",
      socket: current.socket || "",
      outputs: node
        ? node.portSnapshot?.outputs ||
          snapshot.catalog.find((n) => n.typeId === node.typeId)?.outputs ||
          []
        : [],
    });
    onOpen();
    return refresh();
  }
  function selectSocket(socket) {
    if (!current || !model.outputs.some((p) => p.name === socket))
      throw Error("预览输出不存在");
    current.socket = socket;
    model.socket = socket;
    return refresh();
  }
  const stop = workflow.subscribe(() => {
    if (current) close();
  });
  return {
    compilationStatus: () => compilation.status(),
    frame,
    draw,
    open,
    close,
    refresh,
    selectSocket,
    status: () => ({
      ...renderer.status(),
      viewerOpen: model.visible,
      width: model.width,
      height: model.height,
    }),
    dispose() {
      if (!live) return;
      close();
      live = false;
      stop();
      renderer.dispose();
    },
  };
}

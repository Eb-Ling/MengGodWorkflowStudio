import { enlargedSize } from "../../packages/workflow-tools/index.mjs";
import { createPreviewPlayback } from "./playback.mjs";
/** 插件内部渲染协调器，不查找编辑器 DOM。异步结果绑定文档及窗口代次。 */
export function createPreviewController({ workflow, renderer, model, compilation }) {
  let live = true,
    epoch = 0,
    current = null, canvas = null, needsFrame = false, followsClock = false, viewerSource = null, viewerUsesTime = true;
  let releaseViewerOwner;
  let pageVisible = true, viewport = undefined, viewerFrames = 0;
  // undefined 是首次测量前的完整帧，null 是完全离开视框。
  const canDrawViewer = () => pageVisible && viewport !== null;
  const workspaceChanges = new Set();
  const playback = createPreviewPlayback();
  let snapshot = workflow.snapshot();
  const stamp = (s) => JSON.stringify([s.documentToken, s.documentRevision, s.catalogRevision, s.stage]);
  let documentStamp = stamp(snapshot);
  const documentOf = s => ({ config: s.project, fragment: s.fragmentGraph, geometry: s.vertexTransform });
  let document = documentOf(snapshot);
  playback.sync(snapshot);
  function prepare(input = {}) {
    if (!live) throw Error("GPU 预览插件已停用");
    syncSnapshot();
    const s = snapshot,
      stage = input.stage || s.stage;
    if (!["vertex", "fragment"].includes(stage)) throw Error("预览阶段无效");
    const source = input.document || document;
    const graph = stage === "vertex" ? source.geometry.graph : source.fragment;
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
        document: source,
        stage,
        catalogRevision: s.catalogRevision,
        ...(socket ? { socket } : {}),
        ...(input.longEdge !== undefined
          ? enlargedSize(
              input.width ?? source.config.previewWidth ?? 1024,
              input.height ?? source.config.previewHeight ?? 1024,
              input.longEdge,
            )
          : {
              width: input.width ?? source.config.previewWidth ?? 1024,
              height: input.height ?? source.config.previewHeight ?? 1024,
            }),
        time: input.time ?? playback.snapshot().time,
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
    const s = version();
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
      let dataUrl;
      try { dataUrl = surface.toDataURL("image/png"); }
      finally { if (!current) renderer.releaseFrame?.(); }
      return {
        width,
        height,
        time: request.time,
        dataUrl,
        stage: request.stage,
        ...(request.nodeId
          ? { nodeId: request.nodeId, socket: request.socket }
          : {}),
      };
    });
  }
  async function draw(input, present, isWanted, clip) {
    const { request, stamp } = prepare(input);
    return renderer.render(request, ({ surface, width, height, usesTime, region }) => {
      valid(stamp);
      const presented = present({ surface, width, height, region });
      return { presented, width, height, usesTime, time: request.time };
    }, { isWanted, clip });
  }
  function close() {
    epoch++;
    current = null;
    releaseViewerOwner?.();
    releaseViewerOwner = undefined;
    viewerSource = null;
    viewport = undefined;
    if (canvas) { canvas.width = canvas.height = 1; canvas = null; }
    needsFrame = false;
    renderer.releaseFrame?.();
    Object.assign(model, {
      visible: false,
      busy: false,
      error: "",
      width: 0,
      height: 0,
      outputs: [],
      socket: "",
      playing: false,
    });
    return { closed: true };
  }
  async function refresh() {
    if (!current || !live) return { opened: false };
    if (!canDrawViewer()) return { opened: true, width: model.width, height: model.height };
    const turn = ++epoch,
      request = current;
    needsFrame = false;
    const wanted = () => live && turn === epoch && canDrawViewer();
    const time = followsClock ? playback.snapshot().time : request.time;
    Object.assign(model, { busy: true, error: "" });
    try {
      const result = await draw({
        ...request,
        longEdge: model.longEdge,
        time,
      }, ({ surface, width, height, region }) => {
        if (turn !== epoch || !live) return false;
        if (canvas) {
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (region) {
            const { x, y, w, h } = region;
            ctx.clearRect(x, y, w, h);
            ctx.drawImage(surface, x, y, w, h, x, y, w, h);
          } else {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(surface, 0, 0);
          }
        }
        return true;
      }, wanted, viewport);
      if (turn !== epoch || !live) return { opened: false };
      if (!wanted()) return { opened: false };
      viewerFrames++;
      viewerUsesTime = result.usesTime !== false;
      Object.assign(model, { width: result.width, height: result.height, time });
      return { opened: true, width: result.width, height: result.height };
    } catch (e) {
      if (live && (!canDrawViewer() || turn !== epoch)) return { opened: false };
      if (turn === epoch && live) model.error = e.message;
      throw e;
    } finally {
      if (turn === epoch && live) {
        model.busy = false;
        if (needsFrame && !model.error) void refresh().catch(() => {});
      }
    }
  }
  async function open(input = {}, onOpen) {
    const prepared = prepare(input);
    current = prepared.request;
    viewport = undefined;
    viewerUsesTime = true;
    viewerSource = input.document ? null : { ...input };
    // 尺寸始终从原始画布比例换算，切换长边时不会累计取整误差。
    current.width = input.width ?? current.document.config.previewWidth ?? 1024;
    current.height = input.height ?? current.document.config.previewHeight ?? 1024;
    followsClock = input.time === undefined;
    model.longEdge = input.longEdge ?? 2048;
    model.time = current.time;
    model.playing = followsClock && playback.snapshot().playing;
    const graph =
        current.stage === "vertex"
          ? current.document.geometry.graph
          : current.document.fragment,
      node = graph.nodes.find((n) => n.id === input.nodeId),
      catalog = snapshot.catalog;
    Object.assign(model, {
      visible: true,
      width: 0,
      height: 0,
      title: node
        ? "GPU 高清预览 · " + (node.title || node.id)
        : "GPU 高清预览 · 几何与特效",
      socket: current.socket || "",
      outputs: node
        ? node.portSnapshot?.outputs ||
          catalog.find((n) => n.typeId === node.typeId)?.outputs ||
          []
        : [],
    });
    if (onOpen) {
      releaseViewerOwner?.();
      releaseViewerOwner = onOpen();
    }
    return refresh();
  }
  function selectSocket(socket) {
    if (!current || !model.outputs.some((p) => p.name === socket))
      throw Error("预览输出不存在");
    current.socket = socket;
    model.socket = socket;
    return refresh();
  }
  function version() { return workflow.revision?.() ?? workflow.snapshot(); }
  function syncSnapshot() {
    if (stamp(version()) === documentStamp) return;
    const previous = snapshot;
    snapshot = workflow.snapshot();
    const next = stamp(snapshot);
    if (next !== documentStamp) {
      const reopen = viewerSource && previous.documentToken === snapshot.documentToken &&
        previous.stage === snapshot.stage && previous.catalogRevision === snapshot.catalogRevision
        ? { ...viewerSource, socket: current.socket, longEdge: model.longEdge } : null;
      if (previous.documentToken !== snapshot.documentToken || previous.stage !== snapshot.stage ||
          previous.catalogRevision !== snapshot.catalogRevision) {
        renderer.resetWorkspace?.();
        for (const invalidate of workspaceChanges) invalidate();
      }
      if (current && !reopen) close();
      if (reopen) {
        epoch++;
        current = null;
      }
      documentStamp = next;
      document = documentOf(snapshot);
      playback.sync(snapshot);
      if (reopen) void open(reopen).catch(() => { if (!current) close(); });
    }
  }
  const stop = workflow.subscribe(syncSnapshot);
  playback.subscribe((state, tick) => {
    if (!current || !followsClock) return;
    model.playing = state.playing;
    if (!canDrawViewer() || (tick && model.error)) return;
    if (!viewerUsesTime && !model.busy) { model.time = state.time; return; }
    if (model.busy) needsFrame = true;
    else void refresh().catch(() => {});
  });
  return {
    playback,
    // 高清视框打开时集中绘制该视框，关闭后恢复可见的普通预览。
    canAnimateViews: () => live && pageVisible && !current,
    onWorkspaceChange(listener) {
      workspaceChanges.add(listener);
      return () => workspaceChanges.delete(listener);
    },
    setViewport(region) {
      if (JSON.stringify(viewport) === JSON.stringify(region)) return;
      viewport = region;
      if (!current) return;
      if (!canDrawViewer()) { needsFrame = false; return; }
      if (model.busy) needsFrame = true;
      else void refresh().catch(() => {});
    },
    setPageVisible(visible) {
      if (pageVisible === visible) return;
      pageVisible = visible;
      playback.setActive(visible);
      if (!visible) needsFrame = false;
      else if (current && canDrawViewer()) {
        if (model.busy) needsFrame = true;
        else void refresh().catch(() => {});
      }
    },
    attachCanvas(target) {
      if (canvas && canvas !== target) canvas.width = canvas.height = 1;
      canvas = target;
      if (canvas && current && !model.busy) void refresh().catch(() => {});
    },
    editViewerPlayback(input) {
      if (!current) return;
      if (!followsClock && input.time === undefined) input = { time: model.time, ...input };
      followsClock = true;
      if (viewerSource) delete viewerSource.time;
      playback.set(input);
    },
    compilationStatus: () => compilation.status(),
    frame,
    draw,
    open,
    close,
    refresh,
    selectSocket,
    status: () => ({
      ...renderer.status(),
      ...playback.status(),
      viewerOpen: model.visible,
      viewerVisible: !!current && canDrawViewer(),
      viewerFrames,
      viewerCanvasPixels: canvas ? canvas.width * canvas.height : 0,
      width: model.width,
      height: model.height,
      playback: playback.snapshot(),
      viewerTime: model.visible && model.width ? model.time : null,
      viewerPlaying: !!(model.visible && model.playing),
    }),
    dispose() {
      if (!live) return;
      close();
      live = false;
      stop();
      playback.dispose();
      workspaceChanges.clear();
      snapshot = document = null;
      canvas = null;
      renderer.dispose();
    },
  };
}

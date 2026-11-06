import { readPreviewRequest } from "../../packages/workflow-tools/preview-contract.mjs";

/** 完整预览能力：调用方只提供自己的画布，挂载、过期帧及资源回收由本插件负责。 */
export function createPreviewService(controller) {
  const scopes = new Set(),
    mounts = new Set(),
    canvases = new WeakSet();
  let live = true,
    viewerOwner = null,
    mountedFrames = 0;
  const status = () => ({
    ...controller.status(),
    mountedViews: mounts.size,
    mountedFrames,
    // Chromium 提供的是整个页面的近似 JS 堆大小，资源所有权另看画布、订阅及 GPU 计数。
    jsHeapBytes: globalThis.performance?.memory?.usedJSHeapSize ?? null,
  });
  const stopWorkspace = controller.onWorkspaceChange(() => {
    for (const view of mounts) view.invalidate();
  });
  function createApi(_owner, own) {
    let active = true;
    const owned = new Set(), subscriptions = new Set(),
      scope = {};
    const check = () => {
      if (!live || !active) throw Error("预览能力已撤销");
    };
    const closeOwned = (owner) => {
      if (viewerOwner !== owner) return { closed: false };
      viewerOwner = null;
      return controller.close();
    };
    async function open(owner, request) {
      check();
      const input = readPreviewRequest(request);
      return controller.open(input, () => {
        viewerOwner = owner;
        return () => { viewerOwner = null; };
      });
    }
    function cleanup() {
      if (!active) return;
      active = false;
      for (const view of [...owned]) view.dispose();
      for (const unsubscribe of subscriptions) unsubscribe();
      subscriptions.clear();
      closeOwned(scope);
      scopes.delete(cleanup);
    }
    scopes.add(cleanup);
    own(cleanup);
    return {
      /** 调整编辑器预览时间，暂停保留当前秒数，继续播放从该值累加。 */
      setPlayback(input) {
        check();
        return controller.playback.set(input);
      },
      /** 立即返回当前时间状态，后续随播放更新，停用插件时解除订阅。 */
      subscribePlayback(listener) {
        check();
        const stop = controller.playback.subscribe(listener);
        subscriptions.add(stop);
        return () => { stop(); subscriptions.delete(stop); };
      },
      async compilationStatus() {
        check();
        const result = await controller.compilationStatus();
        check();
        return result;
      },
      async frame(request = {}) {
        check();
        const result = await controller.frame(readPreviewRequest(request));
        check();
        return result;
      },
      open: (request = {}) => open(scope, request),
      close: () => {
        check();
        return closeOwned(scope);
      },
      status: () => {
        check();
        return status();
      },
      /** 挂载后使用 render/open，组件卸载时 dispose，插件停用时也会自动回收。 */
      mount(canvas, defaults = {}) {
        check();
        if (!canvas?.getContext || !canvas.getContext("2d"))
          throw Error("请提供可用的 2D 画布");
        if (canvases.has(canvas)) throw Error("画布已挂载预览，请复用现有句柄");
        let base = readPreviewRequest(defaults);
        let target = canvas,
          generation = 0,
          disposed = false,
          enabled = true,
          latest = null,
          usesTime = true,
          lastTime = controller.playback.snapshot().time,
          running = false,
          pending = null;
        const skipped = () => ({ presented: false, width: 0, height: 0 });
        const valid = () => {
          check();
          if (disposed) throw Error("预览画布已释放");
        };
        const paintError = (message) => {
          const ctx = target.getContext("2d");
          ctx.clearRect(0, 0, target.width, target.height);
          ctx.fillStyle = "#331a23";
          ctx.fillRect(0, 0, target.width, target.height);
          ctx.fillStyle = "#ffb2bf";
          ctx.font = "10px sans-serif";
          ctx.fillText("预览不可用", 8, 20);
          target.title = message;
        };
        async function drain() {
          if (running) return;
          running = true;
          while (pending) {
            const job = pending;
            pending = null;
            try {
              const result = await controller.draw(
                job.request,
                ({ surface, width, height }) => {
                  if (!live || !active || disposed || !enabled || job.turn !== generation)
                    return false;
                  const ctx = target.getContext("2d"),
                    scale = Math.min(
                      target.width / width,
                      target.height / height,
                    );
                  ctx.clearRect(0, 0, target.width, target.height);
                  ctx.drawImage(
                    surface,
                    (target.width - width * scale) / 2,
                    (target.height - height * scale) / 2,
                    width * scale,
                    height * scale,
                  );
                  target.title = `GPU 预览：${width} × ${height}，右键可打开放大预览`;
                  mountedFrames++;
                  return true;
                },
                () => !disposed && live && active && enabled && job.turn === generation,
              );
              if (job.turn === generation) {
                usesTime = result.usesTime !== false;
                lastTime = result.time;
              }
              job.resolve(result);
            } catch (error) {
              if (live && active && !disposed && job.turn === generation) {
                usesTime = false;
                paintError(error.message);
              }
              if (live && active && (disposed || job.turn !== generation)) job.resolve(skipped());
              else job.reject(error);
            }
          }
          running = false;
        }
        function enqueue() {
          const turn = ++generation;
          pending?.resolve(skipped());
          return new Promise((resolve, reject) => {
            pending = { turn, request: latest, resolve, reject };
            void drain();
          });
        }
        const view = {
          async render(options = {}) {
            valid();
            try {
              latest = readPreviewRequest({ ...base, ...options });
            } catch (error) {
              generation++;
              pending?.resolve(skipped());
              pending = latest = null;
              paintError(error.message);
              throw error;
            }
            // 每个画布最多一帧执行、一帧等待，快速拖动/动画更新不会堆积编译任务。
            if (!enabled) return skipped();
            return enqueue();
          },
          setActive(value) {
            valid();
            if (typeof value !== "boolean") throw Error("预览画布活动状态必须为布尔值");
            if (enabled === value) return;
            enabled = value;
            generation++;
            pending?.resolve(skipped());
            pending = null;
            if (enabled && latest) void enqueue().catch(() => {});
          },
          open(options = {}) {
            valid();
            return open(view, { ...(latest ?? base), ...options });
          },
          dispose() {
            if (disposed) return;
            disposed = true;
            stopClock();
            generation++;
            pending?.resolve(skipped());
            pending = latest = base = null;
            closeOwned(view);
            canvases.delete(target);
            target = null;
            owned.delete(view);
            mounts.delete(view);
          },
          invalidate() {
            generation++;
            pending?.resolve(skipped());
            pending = latest = null;
            target?.getContext("2d")?.clearRect(0, 0, target.width, target.height);
          },
          unavailable() {
            if (!disposed) paintError("GPU 预览插件已停用");
          },
        };
        // 播放节拍不撤销正在绘制的帧，慢节点也能显示完成的结果。
        // 高清视框、拖拽或隐藏期间暂停普通画布，显式定位仍按当前时间取样。
        const stopClock = controller.playback.subscribe((state, tick) => {
          if (!enabled || !latest || latest.time !== undefined || !usesTime || state.time === lastTime) return;
          if (tick && (!controller.canAnimateViews() || running)) return;
          void enqueue().catch(() => {});
        });
        canvases.add(canvas);
        owned.add(view);
        mounts.add(view);
        return { render: view.render, setActive: view.setActive, open: view.open, dispose: view.dispose };
      },
    };
  }
  return {
    createApi,
    dispose() {
      if (!live) return;
      stopWorkspace();
      for (const view of mounts) view.unavailable();
      for (const cleanup of [...scopes]) cleanup();
      live = false;
      viewerOwner = null;
      controller.dispose();
    },
  };
}

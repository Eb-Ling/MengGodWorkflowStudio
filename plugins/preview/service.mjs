import { readPreviewRequest } from "../../packages/workflow-tools/preview-contract.mjs";

/** 完整预览能力：调用方只提供自己的画布，挂载、过期帧及资源回收由本插件负责。 */
export function createPreviewService(controller) {
  const scopes = new Set(),
    mounts = new Set(),
    canvases = new WeakSet();
  let live = true,
    viewerOwner = null;
  const status = () => ({ ...controller.status(), mountedViews: mounts.size });
  function createApi(_owner, own) {
    let active = true;
    const owned = new Set(),
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
      });
    }
    function cleanup() {
      if (!active) return;
      active = false;
      for (const view of [...owned]) view.dispose();
      closeOwned(scope);
      scopes.delete(cleanup);
    }
    scopes.add(cleanup);
    own(cleanup);
    return {
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
        const base = readPreviewRequest(defaults);
        let target = canvas,
          generation = 0,
          disposed = false,
          latest = base,
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
                  if (!live || !active || disposed || job.turn !== generation)
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
                  return true;
                },
              );
              job.resolve(result);
            } catch (error) {
              if (live && active && !disposed && job.turn === generation)
                paintError(error.message);
              job.reject(error);
            }
          }
          running = false;
        }
        const view = {
          async render(options = {}) {
            valid();
            const turn = ++generation;
            pending?.resolve(skipped());
            pending = null;
            try {
              latest = readPreviewRequest({ ...base, ...options });
            } catch (error) {
              paintError(error.message);
              throw error;
            }
            // 每个画布最多一帧执行、一帧等待，快速拖动/动画更新不会堆积编译任务。
            return new Promise((resolve, reject) => {
              pending = { turn, request: latest, resolve, reject };
              void drain();
            });
          },
          open(options = {}) {
            valid();
            return open(view, { ...latest, ...options });
          },
          dispose() {
            if (disposed) return;
            disposed = true;
            generation++;
            pending?.resolve(skipped());
            pending = null;
            closeOwned(view);
            canvases.delete(target);
            target = null;
            owned.delete(view);
            mounts.delete(view);
          },
          unavailable() {
            if (!disposed) paintError("GPU 预览插件已停用");
          },
        };
        canvases.add(canvas);
        owned.add(view);
        mounts.add(view);
        return { render: view.render, open: view.open, dispose: view.dispose };
      },
    };
  }
  return {
    createApi,
    dispose() {
      if (!live) return;
      for (const view of mounts) view.unavailable();
      for (const cleanup of [...scopes]) cleanup();
      live = false;
      controller.dispose();
    },
  };
}

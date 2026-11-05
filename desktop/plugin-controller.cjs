const { ipcMain, dialog, BrowserWindow, shell } = require("electron");

/** 平台适配器：只执行内核发起的目录/进程请求，不维护第二套插件启停状态。 */
function installPluginController({ repository, createRunner, createCapabilities, createTaskRunner, dataRoot, isAllowed }) {
  const runners = new Map(),
    scopes = new Map(),
    owners = new Set(),
    requests = new Map();
  let requestSerial = 0;
  const key = (owner, generation) => owner + ":" + generation;
  function cancelRequests(owner, generation) {
    for (const [id, p] of requests)
      if (p.owner === owner && (!generation || p.generation === generation)) {
        clearTimeout(p.timer);
        requests.delete(id);
        p.reject(Error("插件调用已取消"));
      }
  }
  function closeOwner(owner) {
    cancelRequests(owner);
    for (const [id, scope] of scopes) if (id.startsWith(owner + ':')) { scope.dispose(); scopes.delete(id); }
    for (const [id, runner] of runners)
      if (id.startsWith(owner + ":")) {
        runner.destroy();
        runners.delete(id);
      }
    repository.releaseOwner(owner);
    owners.delete(owner);
  }
  ipcMain.handle(
    "workflowDesktop:plugins",
    async (event, method, input = {}) => {
      if (!isAllowed(event) || event.senderFrame !== event.sender.mainFrame)
        throw Error("插件平台调用来源无效");
      if (Buffer.byteLength(JSON.stringify(input), "utf8") > 2 * 1024 * 1024)
        throw Error("插件请求过大");
      const owner = event.sender.id;
      if (!owners.has(owner)) {
        owners.add(owner);
        event.sender.once("destroyed", () => closeOwner(owner));
      }
      switch (method) {
        case 'capability': {
          const matches = [...scopes.values()].filter(s => s.owner === owner && s.pluginId === input.id);
          if (matches.length !== 1) throw Error('原生能力作用域未启动或正在替换');
          return matches[0].call(input.method, input.args);
        }
        case 'openWindow': {
          const found = [...scopes.entries()].find(([, s]) => s.owner === owner && s.pluginId === input.id);
          const runner = found && runners.get(found[0]);
          if (!runner) throw Error('插件进程未启动');
          runner.show(); return null;
        }
        case "openDirectory": {
          const directory = await repository.directory(input.id);
          const error = await shell.openPath(directory);
          if (error) throw Error("无法打开插件文件夹：" + error);
          return null;
        }
        case "choose": {
          const result = await dialog.showOpenDialog(
            BrowserWindow.fromWebContents(event.sender),
            { title: "选择本地插件文件夹", properties: ["openDirectory"] },
          );
          return result.canceled
            ? null
            : repository.inspect(owner, result.filePaths[0], input.id || null);
        }
        case "inspect":
          return repository.inspectRegistered(owner, input.id);
        case "authorized":
          return repository.authorized();
        case "authorize":
          return repository.authorize(owner, input);
        case "inspectAuthorized":
          return repository.inspectAuthorized(owner, input);
        case "revokeAuthorization":
          return repository.revokeAuthorization(input.id, input.authorizationId);
        case "prepare":
          return repository.prepare(owner, input);
        case "restore":
          return repository.restore(owner);
        case "list":
          return repository.list();
        case "commit":
          return repository.commit(owner, input.generation, input.enabled);
        case "setEnabled":
          return repository.setEnabled(input.id, input.enabled);
        case "remove":
          return repository.remove(input.id);
        case "release":
          repository.release(owner, input.generation);
          return null;
        case "start": {
          const id = key(owner, input.generation);
          if (runners.has(id)) throw Error("插件进程已经启动");
          if (scopes.size >= 8) throw Error('桌面宿主同时最多启动 8 个隔离插件（含其他编辑窗口）');
          const bundle = repository.bundle(owner, input.generation);
          const tasks = createTaskRunner();
          const capabilities = createCapabilities({ manifest: bundle.manifest, dataRoot, runTask: (task, value) => tasks.run(task, value) });
          const disposeScope = () => { capabilities.dispose(); tasks.dispose(); scopes.delete(id); };
          scopes.set(id, { owner, pluginId: bundle.manifest.id, call: capabilities.call, dispose: disposeScope });
          let runner;
          try { runner = await createRunner(bundle, {
            availableApis: input.availableApis,
            onApiCall: (request) =>
              new Promise((resolve, reject) => {
                if (event.sender.isDestroyed())
                  return reject(Error("插件宿主已关闭"));
                const requestId = ++requestSerial;
                const timer = setTimeout(() => {
                  requests.delete(requestId);
                  reject(Error("宿主 API 调用超时"));
                }, 5000);
                requests.set(requestId, {
                  owner,
                  generation: input.generation,
                  timer,
                  resolve,
                  reject,
                });
                event.sender.send("workflowDesktop:pluginRequest", {
                  ...request,
                  protocol: 1,
                  requestId,
                  generation: input.generation,
                });
              }),
            onFault: (error) => {
              disposeScope(); runners.delete(id);
              cancelRequests(owner, input.generation);
              if (!event.sender.isDestroyed())
                event.sender.send("workflowDesktop:pluginFault", {
                  generation: input.generation,
                  error,
                });
            },
          }); } catch (error) { disposeScope(); throw error; }
          if (event.sender.isDestroyed()) {
            runner.destroy();
            disposeScope();
            throw Error("插件宿主已关闭");
          }
          runners.set(id, runner);
          return runner.contribution;
        }
        case "apiReply": {
          const p = requests.get(input.requestId);
          if (!p || p.owner !== owner || p.generation !== input.generation)
            return null;
          requests.delete(input.requestId);
          clearTimeout(p.timer);
          if (input.error) p.reject(Error(String(input.error).slice(0, 4000)));
          else p.resolve(input.value);
          return null;
        }
        case "invoke": {
          repository.bundle(owner, input.generation);
          const runner = runners.get(key(owner, input.generation));
          if (!runner) throw Error("插件进程未启动");
          return runner.request("invoke", input);
        }
        case "compile": {
          repository.bundle(owner, input.generation);
          const runner = runners.get(key(owner, input.generation));
          if (!runner) throw Error("插件进程未启动");
          return runner.request("compile", input);
        }
        case "stop": {
          cancelRequests(owner, input.generation);
          const id = key(owner, input.generation),
            runner = runners.get(id);
          scopes.get(id)?.dispose();
          runners.delete(id);
          if (runner) await runner.dispose();
          return null;
        }
        default:
          throw Error("未知插件平台方法");
      }
    },
  );
  return () => {
    ipcMain.removeHandler("workflowDesktop:plugins");
    for (const owner of [...owners]) closeOwner(owner);
  };
}
module.exports = { installPluginController };

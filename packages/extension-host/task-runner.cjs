const { utilityProcess } = require('electron');
const path = require('node:path');
const { guardProcess } = require('./resource-guard.cjs');
let activeTasks = 0;
/** 每次任务独立进程，只执行内置入口，撤销、超时和完成均回收进程与 OS Job。 */
function createTaskRunner() {
  let live = true; const pending = new Set();
  return {
    run(task, input) {
      if (!live) return Promise.reject(Error('任务接口已撤销'));
      if (activeTasks >= 2) return Promise.reject(Error('桌面宿主同时最多运行 2 个后台任务'));
      activeTasks++;
      return new Promise((resolve, reject) => {
        let done = false, guard;
        let child;
        try { child = utilityProcess.fork(path.join(path.dirname(require.resolve('./task-runner.cjs')), 'task-worker.cjs'), [], { serviceName: 'Workflow restricted task', stdio: 'ignore', env: {} }); }
        catch (error) { activeTasks--; reject(error); return; }
        const finish = (error, result) => {
          if (done) return; done = true; activeTasks--; clearTimeout(timer); pending.delete(cancel);
          child.kill(); guard?.dispose(); if (error) reject(error); else resolve(result);
        };
        const cancel = () => finish(Error('后台任务已撤销'));
        const timer = setTimeout(() => finish(Error('后台任务超时')), 5000); pending.add(cancel);
        child.once('spawn', async () => {
          try {
            guard = await guardProcess(child.pid, { memoryMiB: 128, cpuRate: 500, onExit: message => finish(Error(message)) });
            if (done) guard.dispose(); else child.postMessage({ task, input });
          } catch (error) { finish(error); }
        });
        child.once('message', result => finish(null, result));
        child.once('exit', code => { if (!done) finish(Error('后台任务意外退出：' + code)); });
      });
    },
    dispose() { live = false; for (const cancel of [...pending]) cancel(); },
  };
}
module.exports = { createTaskRunner };

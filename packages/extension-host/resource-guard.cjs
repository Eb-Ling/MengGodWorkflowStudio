const { spawn } = require('node:child_process');
const path = require('node:path');
/** Windows release 的 OS 硬限制，设置失败时拒绝激活，不以采样器冒充硬配额。 */
function guardProcess(pid, { memoryMiB = 512, cpuRate = 1000, onExit = () => {} } = {}) {
  if (process.platform !== 'win32') return Promise.reject(Error('当前隔离宿主需要 Windows Job Object'));
  return new Promise((resolve, reject) => {
    let ready = false, disposed = false, output = '', errors = '';
    const child = spawn(path.join(path.dirname(require.resolve('./resource-guard.cjs')), 'resource-guard.exe'), [String(pid), String(memoryMiB), String(cpuRate)], {
      windowsHide: true, stdio: ['pipe','pipe','pipe'],
    });
    const stop = () => { if (!disposed) { disposed = true; child.stdin.end(); } };
    const timer = setTimeout(() => { stop(); reject(Error('OS 资源配额配置超时')); }, 4000);
    child.stdin.on('error', () => {});
    child.stdout.on('data', data => {
      output += data;
      if (!ready && output.includes('READY')) { ready = true; clearTimeout(timer); resolve({ dispose: stop, pid, memoryMiB, cpuRate }); }
    });
    child.stderr.on('data', data => { errors = (errors + data).slice(-2000); });
    child.once('error', error => { clearTimeout(timer); stop(); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      if (!ready) reject(Error('无法设置 OS 资源配额：' + (errors || code)));
      else if (!disposed) onExit('OS 资源守卫意外退出');
    });
  });
}
module.exports = { guardProcess };

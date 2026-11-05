// 固定宿主任务入口。插件只能传入有界文本，不能传脚本或加载路径。
const { createHash } = require('node:crypto');
process.parentPort.on('message', ({ data }) => {
  if (typeof data?.input !== 'string' || Buffer.byteLength(data.input) > 262144) process.exit(1);
  if (data.task === 'sha256') process.parentPort.postMessage({ sha256: createHash('sha256').update(data.input).digest('hex') });
  else if (data.task === 'validate-json') {
    try { JSON.parse(data.input); process.parentPort.postMessage({ valid: true }); }
    catch { process.parentPort.postMessage({ valid: false, error: 'JSON 格式无效' }); }
  } else process.exit(1);
});

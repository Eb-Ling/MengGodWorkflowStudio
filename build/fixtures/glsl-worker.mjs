// 验证替换实现所需的数据边界。只用 JSON 文本交换，不共享编辑器/节点对象。
import {parentPort} from 'node:worker_threads';
import {emitModule} from '../../plugins/glsl-backend/emitter.mjs';
parentPort.on('message', message => {
  const {id,request}=JSON.parse(message);
  parentPort.postMessage(JSON.stringify({id,result:emitModule(request)}));
});

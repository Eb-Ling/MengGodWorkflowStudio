import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import dns from 'node:dns/promises';
import { randomUUID } from 'node:crypto';
import { extensionPlatformMethods } from '../plugin-sdk/extension-platform.mjs';

const fileBytes = 65536, networkBytes = 262144;
const fileName = /^(?!(?:con|prn|aux|nul|com[0-9]|lpt[0-9])\.)[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}\.(?:json|txt)$/i;
// 同一插件的两个编辑窗口共享持久数据，原子读写按目录串行，队列完成立即移除。
const dataQueues = new Map();
function serialized(key, action) {
  const work = (dataQueues.get(key) || Promise.resolve()).then(action);
  const tail = work.catch(() => {}); dataQueues.set(key, tail);
  void tail.then(() => { if (dataQueues.get(key) === tail) dataQueues.delete(key); });
  return work;
}
/** 仅公开 IPv4 单播地址，DNS 结果固定到本次 TLS 连接，禁止重定向与 DNS 重绑定。 */
export function publicAddress(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(v => !Number.isInteger(v) || v < 0 || v > 255)) return false;
  const [a,b,c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
/** 只有宿主创建此作用域，身份、根目录、声明均来自已授权的仓储快照。 */
export function createExtensionCapabilities({ manifest, dataRoot, runTask }) {
  let live = true, active = 0, taskActive = false;
  const dataKey = path.resolve(dataRoot, manifest.id);
  const controllers = new Set();
  const check = () => { if (!live) throw Error('插件原生能力已撤销'); };
  async function directory() {
    check();
    const root = path.resolve(dataRoot), dir = path.join(root, manifest.id);
    await fs.mkdir(dir, { recursive: true });
    for (const value of [root, dir]) {
      const s = await fs.lstat(value);
      if (!s.isDirectory() || s.isSymbolicLink() || path.resolve(await fs.realpath(value)) !== value) throw Error('数据目录不允许链接或重定向');
    }
    check(); return dir;
  }
  async function files(dir) {
    const entries = await fs.readdir(dir);
    if (entries.length > 32) throw Error('插件数据最多 32 个文件');
    let total = 0; const sizes = new Map();
    for (const name of entries) {
      if (!fileName.test(name)) throw Error('数据目录含非宿主管理文件');
      const s = await fs.lstat(path.join(dir, name));
      if (!s.isFile() || s.isSymbolicLink() || s.size > fileBytes) throw Error('数据文件无效或超过 64 KiB');
      total += s.size; sizes.set(name, s.size);
    }
    return { sizes, total };
  }
  const methods = {
    async readText(name) {
      if (!fileName.test(name)) throw Error('只接受简单 .json/.txt 文件名');
      const dir = await directory(), { sizes } = await files(dir);
      if (!sizes.has(name)) return null;
      const handle = await fs.open(path.join(dir, name), 'r');
      try {
        const buffer = Buffer.alloc(fileBytes + 1); let bytesRead = 0;
        while (bytesRead < buffer.length) {
          const part = await handle.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
          if (!part.bytesRead) break;
          bytesRead += part.bytesRead;
        }
        if (bytesRead > fileBytes) throw Error('数据文件超过 64 KiB');
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead));
      } finally { await handle.close(); }
    },
    writeText(name, text) {
      return serialized(dataKey, async () => {
        check();
        if (!fileName.test(name) || typeof text !== 'string' || Buffer.byteLength(text) > fileBytes) throw Error('数据文件名或大小无效（最多 64 KiB）');
        const dir = await directory(), { sizes, total } = await files(dir);
        if ((!sizes.has(name) && sizes.size >= 32) || total - (sizes.get(name) || 0) + Buffer.byteLength(text) > 1048576) throw Error('插件数据空间已满（32 文件 / 1 MiB）');
        const temp = path.join(dir, '.' + randomUUID() + '.tmp');
        try {
          await fs.writeFile(temp, text, { encoding: 'utf8', flag: 'wx' });
          check(); await fs.rename(temp, path.join(dir, name)); return null;
        } finally { await fs.rm(temp, { force: true }); }
      });
    },
    async fetchText(address) {
      if (typeof address !== 'string' || address.length > 2048) throw Error('URL 无效');
      const url = new URL(address);
      if (!(manifest.isolation?.networkOrigins || []).includes(url.origin) || url.username || url.password || url.hash || url.protocol !== 'https:') throw Error('联网来源未获授权');
      const controller = new AbortController(); controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const resolved = await Promise.race([
          dns.lookup(url.hostname, { all: true, family: 4 }),
          new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(Error('联网已取消或超时')), { once: true })),
        ]);
        check(); if (controller.signal.aborted) throw Error('联网已取消');
        if (!resolved.length || resolved.some(v => !publicAddress(v.address))) throw Error('拒绝内网或保留地址');
        return await new Promise((resolve, reject) => {
          const req = https.get(url, {
            signal: controller.signal, agent: false,
            lookup(_host, options, callback) {
              const answer = resolved[0];
              if (options.all) callback(null, [answer]); else callback(null, answer.address, answer.family);
            },
            headers: { Accept: 'application/json, text/plain', 'Accept-Encoding': 'identity' },
          }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400) { res.destroy(); reject(Error('不允许联网重定向')); return; }
            let size = 0; const chunks = [];
            res.on('data', data => {
              size += data.length;
              if (size > networkBytes) { req.destroy(Error('响应超过 256 KiB')); return; }
              chunks.push(data);
            });
            res.on('error', reject);
            res.on('end', () => {
              try { resolve({ status: res.statusCode, text: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)) }); }
              catch (e) { reject(e); }
            });
          }); req.on('error', reject);
        });
      } finally { clearTimeout(timer); controllers.delete(controller); }
    },
    async runTask(task, input) {
      if (!['sha256', 'validate-json'].includes(task) || typeof input !== 'string' || Buffer.byteLength(input) > networkBytes) throw Error('只接受 sha256 / validate-json 任务，输入最多 256 KiB');
      if (taskActive) throw Error('每个插件同时只能运行一个后台任务');
      taskActive = true;
      try { return await runTask(task, input); } finally { taskActive = false; }
    },
  };
  return {
    async call(method, args) {
      check();
      if (!Object.hasOwn(extensionPlatformMethods, method) || !manifest.capabilities.includes(extensionPlatformMethods[method])) throw Error('未获原生能力授权');
      if (!Array.isArray(args) || args.length > 2 || active >= 4) throw Error('原生调用参数无效或队列已满');
      active++;
      try { const result = await (method === 'readText' ? serialized(dataKey, () => methods.readText(...args)) : methods[method](...args)); check(); return result; }
      finally { active--; }
    },
    dispose() { live = false; for (const controller of controllers) controller.abort(); controllers.clear(); },
  };
}

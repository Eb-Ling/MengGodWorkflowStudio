/** 隔离扩展的原生能力，不暴露路径、原生对象、shell 或任意可执行文件。 */
export const extensionPlatformMethods = Object.freeze({
  readText: 'extension.files', writeText: 'extension.files',
  fetchText: 'extension.network', runTask: 'extension.tasks',
});
export const extensionPlatformContract = {
  version: '1.0.0', scoped: true,
  methods: Object.fromEntries(Object.entries(extensionPlatformMethods).map(([method, capability]) =>
    [method, { capability, arguments: { type: 'array', maxItems: 2 }, returns: {} }])),
};
/** 安装声明中的范围也进入授权指纹，不能通过修改磁盘静默扩大。 */
export function readIsolation(value = {}, capabilities = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['window', 'networkOrigins'].includes(key))) throw Error('隔离范围声明无效');
  const result = {};
  if (value.window !== undefined) {
    if (!capabilities.includes('extension.window')) throw Error('独立窗口需要 extension.window');
    const w = value.window;
    if (!w || Object.keys(w).some(key => !['width', 'height'].includes(key)) ||
        !Number.isInteger(w.width) || w.width < 320 || w.width > 1600 ||
        !Number.isInteger(w.height) || w.height < 240 || w.height > 1200) throw Error('窗口范围为 320–1600 × 240–1200');
    result.window = { width: w.width, height: w.height };
  } else if (capabilities.includes('extension.window')) throw Error('请声明 isolation.window 尺寸');
  const origins = value.networkOrigins || [];
  if (!Array.isArray(origins) || origins.length > 4 || new Set(origins).size !== origins.length) throw Error('联网最多声明 4 个不同 HTTPS 来源');
  for (const origin of origins) {
    let url; try { url = new URL(origin); } catch { throw Error('联网来源无效'); }
    if (url.protocol !== 'https:' || url.origin !== origin || url.port || url.username || url.password ||
        !/^[a-z0-9.-]+$/i.test(url.hostname)) throw Error('联网仅接受标准 HTTPS 来源，不含路径、端口或认证信息');
  }
  if (origins.length && !capabilities.includes('extension.network')) throw Error('联网来源需要 extension.network');
  if (capabilities.includes('extension.network') && !origins.length) throw Error('请声明获准的 networkOrigins');
  if (origins.length) result.networkOrigins = [...origins].sort();
  return result;
}

const fs = require("node:fs");
const path = require("node:path");

/** 桌面持久存储适配器：按用户配置目录隔离，与本地 HTTP 端口无关。 */
function createProfileStorage(file) {
  let values = {};
  try {
    values = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT")
      throw new Error(`无法读取工作流存储：${error.message}`);
  }
  const valid = (key, value) => {
    if (
      typeof key !== "string" ||
      !/^workflow\.[\w.]+$/.test(key) ||
      typeof value !== "string"
    )
      throw new Error("无效工作流存储键或值");
  };
  if (!values || typeof values !== "object" || Array.isArray(values))
    throw new Error("工作流存储格式无效");
  for (const [key, value] of Object.entries(values)) valid(key, value);
  let serial = 1;
  const versions = new Map(Object.keys(values).map(key => [key, serial]));
  function commit(next) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(next));
    fs.renameSync(file + ".tmp", file);
    for (const key of new Set([...Object.keys(values), ...Object.keys(next)])) {
      if (next[key] === values[key]) continue;
      if (Object.hasOwn(next, key)) versions.set(key, ++serial);
      else versions.delete(key);
    }
    values = next;
  }
  return {
    getVersion(keys) {
      if (!Array.isArray(keys) || keys.length > 32) throw Error("无效存储键列表");
      return keys.map(key => { valid(key, ""); return versions.get(key) || 0; }).join(":");
    },
    getItem(key) {
      valid(key, "");
      return values[key] ?? null;
    },
    setItem(key, value) {
      valid(key, value);
      commit({ ...values, [key]: value });
    },
    // 工作流快照、来源和备份属于一次保存，不能分别提交。
    setItems(items) {
      if (!items || typeof items !== 'object' || Array.isArray(items)) throw Error('无效存储批次');
      for(const [key,value] of Object.entries(items)) valid(key,value);
      commit({...values,...items});
    },
    removeItem(key) {
      valid(key, "");
      const next = { ...values };
      delete next[key];
      commit(next);
    },
  };
}
module.exports = { createProfileStorage };

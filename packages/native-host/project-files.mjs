import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const LIMIT = 8 * 1024 * 1024;
const hash = (text) => createHash("sha256").update(text).digest("hex");
const fail = (code, message, extra = {}) =>
  Object.assign(new Error(message), { code, ...extra });
function atomicSync(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + randomUUID() + ".tmp";
  let fd;
  try {
    fd = fs.openSync(tmp, "wx");
    fs.writeFileSync(fd, text, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try {
      fs.unlinkSync(tmp);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
}
/** Electron/Node 文件适配器：授权句柄、内容版本、原子替换、备份和独立恢复日志。 */
export function createProjectFiles({ root, beforeReplace = async () => {} }) {
  fs.mkdirSync(root, { recursive: true });
  const index = path.join(root, "recent.json");
  let grants = [];
  try {
    grants = JSON.parse(fs.readFileSync(index, "utf8"));
    if (!Array.isArray(grants)) throw Error("工作流文件索引格式无效");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const queues = new Map();
  const find = (id) => {
    const item = grants.find((x) => x.fileId === id);
    if (!item)
      throw fail("UNAUTHORIZED", "请先通过工作流文件选择器打开或另存该文件");
    return item;
  };
  const ref = (item, version = null) => ({
    ...item,
    name: path.basename(item.path),
    version,
  });
  async function content(file) {
    let handle;
    try {
      const stat = await fsp.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw fail("INVALID_FILE", "项目目标必须是普通文件");
      if (stat.size > LIMIT) throw fail("TOO_LARGE", "工作流文件超过 8 MiB");
      handle = await fsp.open(file, "r");
      const bytes = Buffer.alloc(LIMIT + 1);
      let size = 0;
      while (size < bytes.length) {
        const n = (await handle.read(bytes, size, bytes.length - size, size))
          .bytesRead;
        if (!n) break;
        size += n;
      }
      if (size > LIMIT) throw fail("TOO_LARGE", "工作流文件超过 8 MiB");
      const data = bytes.subarray(0, size);
      return {
        text: new TextDecoder("utf-8", { fatal: true }).decode(data),
        version: hash(data),
      };
    } catch (e) {
      if (e.code === "ENOENT") return { text: null, version: null };
      throw e;
    } finally {
      await handle?.close();
    }
  }
  function serial(key, run) {
    const pending = (queues.get(key) || Promise.resolve())
      .catch(() => {})
      .then(run);
    queues.set(key, pending);
    return pending.finally(() => {
      if (queues.get(key) === pending) queues.delete(key);
    });
  }
  const journalPath = (id) => {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("无效恢复记录");
    return path.join(root, "recovery", id + ".json");
  };
  return {
    async grant(file) {
      if (
        !path.isAbsolute(file) ||
        !file.toLowerCase().endsWith(".workflow.json")
      )
        throw fail("INVALID_PATH", "请选择 .workflow.json 工作流文件");
      const folder = await fsp.realpath(path.dirname(file)),
        canonical = path.join(folder, path.basename(file));
      await content(canonical);
      let item = grants.find(
        (x) => x.path.toLowerCase() === canonical.toLowerCase(),
      );
      if (!item) {
        item = { fileId: randomUUID(), path: canonical };
        grants = [item, ...grants];
        atomicSync(index, JSON.stringify(grants));
      }
      return ref(item, (await content(canonical)).version);
    },
    list() {
      return grants.map((x) => ref(x));
    },
    async read(fileId) {
      const item = find(fileId),
        data = await content(item.path);
      if (data.text === null)
        throw fail("MISSING", "工作流文件已被移动或删除，可以另存当前草稿");
      return { ...ref(item, data.version), text: data.text };
    },
    async write({ fileId, expectedVersion, text }) {
      if (typeof text !== "string" || Buffer.byteLength(text) > LIMIT)
        throw fail("TOO_LARGE", "工作流文件必须是 8 MiB 内的文本");
      const item = find(fileId);
      return serial(item.path.toLowerCase(), async () => {
        let lock, tmp;
        try {
          try {
            lock = await fsp.open(item.path + ".studio-lock", "wx");
          } catch (e) {
            if (e.code === "EEXIST")
              throw fail(
                "BUSY",
                "另一个编辑器正在保存，或上次中断留下了 .studio-lock 文件，草稿仍保留",
              );
            throw e;
          }
          const previous = await content(item.path);
          const check = (value) => {
            if (value.version !== expectedVersion)
              throw fail(
                "CONFLICT",
                "磁盘工作流已被外部修改，当前草稿未覆盖磁盘",
                { version: value.version },
              );
          };
          check(previous);
          // 连续保存同一份内容仍检查外部版本，但不冲掉上一次有效备份。
          if (previous.text === text) return ref(item, previous.version);
          tmp = item.path + "." + randomUUID() + ".tmp";
          const handle = await fsp.open(tmp, "wx");
          try {
            await handle.writeFile(text, "utf8");
            await handle.sync();
          } finally {
            await handle.close();
          }
          await beforeReplace(item.path);
          check(await content(item.path));
          if (previous.text !== null)
            atomicSync(
              path.join(root, "backup", fileId + ".json"),
              previous.text,
            );
          await fsp.rename(tmp, item.path);
          tmp = null;
          return ref(item, hash(text));
        } finally {
          if (tmp)
            await fsp.unlink(tmp).catch((e) => {
              if (e.code !== "ENOENT") throw e;
            });
          if (lock) {
            await lock.close();
            await fsp.unlink(item.path + ".studio-lock");
          }
        }
      });
    },
    async backup(fileId) {
      find(fileId);
      const value = await content(path.join(root, "backup", fileId + ".json"));
      if (value.text === null)
        throw fail("MISSING", "此项目还没有上一次保存的备份");
      return value;
    },
    checkpoint({ id, record }) {
      const file = journalPath(id);
      if (record === null) {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        return;
      }
      const text = JSON.stringify({
        ...record,
        updatedAt: new Date().toISOString(),
      });
      // 恢复记录同时保存文档和内容基线，允许覆盖一个完整的 8 MiB 项目。
      if (Buffer.byteLength(text) > LIMIT * 3)
        throw fail("TOO_LARGE", "恢复记录超过 24 MiB，请立即另存工作流");
      atomicSync(file, text);
    },
    recover(id) {
      return JSON.parse(fs.readFileSync(journalPath(id), "utf8"));
    },
    recoveries() {
      const dir = path.join(root, "recovery");
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((n) => n.endsWith(".json"))
        .map((name) => {
          const id = name.slice(0, -5);
          try {
            const r = JSON.parse(fs.readFileSync(journalPath(id), "utf8"));
            return {
              id,
              title: r.document?.project?.title || "未命名草稿",
              updatedAt: r.updatedAt,
              path: r.file?.path || null,
            };
          } catch {
            return {
              id,
              title: "无法读取的恢复记录（原文件保留）",
              updatedAt: "",
              path: null,
            };
          }
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  };
}

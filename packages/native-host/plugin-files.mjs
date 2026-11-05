import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

/** 对实际加载的文件与规范声明计算内容指纹，不包含目录位置或修改时间。 */
export function pluginContentFingerprint(files, manifest) {
  const entries = Object.entries(files)
    .filter(([name]) => !manifest || name !== "studio-plugin.json")
    .sort(([a], [b]) => a.localeCompare(b, "en"));
  if (manifest) entries.push(["studio-plugin.json", JSON.stringify(manifest)]);
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

/** 安装器与独立测试包共用的目录预算，只读取脚本/JSON，不执行内容。 */
export const PLUGIN_DIRECTORY_LIMITS = Object.freeze({
  files: 128,
  fileBytes: 1024 * 1024,
  totalBytes: 4 * 1024 * 1024,
  depth: 10,
  entries: 4096,
});
const inside = (root, file) =>
  file === root || file.startsWith(root + path.sep);
/** 验证相对文件及其真实路径均在已经 realpath 的目录中。 */
export async function selectedPluginFile(root, relative) {
  const candidate = path.resolve(root, relative);
  if (!inside(root, candidate)) throw Error("插件文件越出所选目录");
  const real = await fs.realpath(candidate);
  if (!inside(root, real)) throw Error("插件文件链接越出所选目录");
  return real;
}
/** 返回只读目录快照。忽略依赖/构建目录，拒绝符号链接、特殊文件与超限目录。 */
export async function readPluginFiles(directory) {
  const root = await fs.realpath(directory),
    files = Object.create(null);
  if (!(await fs.stat(root)).isDirectory()) throw Error("请选择文件夹");
  let bytes = 0,
    entries = 0;
  async function walk(relative = "") {
    const dir = await fs.opendir(path.join(root, relative));
    for await (const item of dir) {
      if (++entries > PLUGIN_DIRECTORY_LIMITS.entries)
        throw Error("插件目录最多 4096 个目录项");
      if (["node_modules", ".git", "build", "release"].includes(item.name))
        continue;
      const rel = path.posix.join(relative, item.name);
      if (item.isSymbolicLink())
        throw Error("插件目录不能包含符号链接：" + rel);
      const absolute = await selectedPluginFile(root, rel),
        stat = await fs.stat(absolute);
      if (stat.isDirectory()) {
        if (rel.split("/").length > PLUGIN_DIRECTORY_LIMITS.depth)
          throw Error("插件目录层级过深");
        await walk(rel);
      } else if (/\.(?:mjs|js|json|css)$/.test(rel)) {
        if (!stat.isFile()) throw Error("插件内容必须是普通文件：" + rel);
        if (
          Object.keys(files).length >= PLUGIN_DIRECTORY_LIMITS.files ||
          stat.size > PLUGIN_DIRECTORY_LIMITS.fileBytes
        )
          throw Error("插件最多 128 个脚本/JSON 文件，单文件 1 MB");
        // 固定长度读取，文件在检查后增长也不能突破单文件预算。
        const handle = await fs.open(absolute, "r");
        let data;
        try {
          data = Buffer.alloc(PLUGIN_DIRECTORY_LIMITS.fileBytes + 1);
          let offset = 0;
          while (offset < data.length) {
            const read = await handle.read(
              data,
              offset,
              data.length - offset,
              null,
            );
            if (!read.bytesRead) break;
            offset += read.bytesRead;
          }
          data = data.subarray(0, offset);
        } finally {
          await handle.close();
        }
        if (
          data.length > PLUGIN_DIRECTORY_LIMITS.fileBytes ||
          (bytes += data.length) > PLUGIN_DIRECTORY_LIMITS.totalBytes
        )
          throw Error("插件脚本/JSON 总大小最多 4 MB，单文件 1 MB");
        files[rel] = new TextDecoder("utf-8", { fatal: true }).decode(data);
      }
    }
  }
  await walk();
  return { directory: root, files, bytes };
}

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  readPluginManifest,
  pluginManifestDraft,
  pluginPermissionKey,
} from "../plugin-sdk/plugin-manifest.mjs";
import { extensionTemplate } from "./extension-template.mjs";
import {
  readPluginFiles,
  pluginContentFingerprint,
  selectedPluginFile as selectedFile,
} from "./plugin-files.mjs";

const template = `import {ir} from '@workflow/plugin-sdk/ir';
export const plugin={activate(context){
  const typeId=context.pluginId+'.double';
  const targets=['glsl-es-300','glsl-430'];
  const h=context.api('workflow.nodes').register({
    nodes:[{typeId,title:'数值翻倍',category:'本地插件',inputs:[{name:'value',type:'FLOAT'}],outputs:[{name:'result',type:'FLOAT'}],properties:{},stages:['vertex','fragment'],targets}],
    compilers:targets.map(target=>({typeId,target,compile:()=>ir.binary('FLOAT','*',ir.input('FLOAT','value'),ir.literal('FLOAT',2))}))
  });context.onDispose(()=>h.dispose());
}};
`;
async function readOptional(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function atomicWrite(file, text) {
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(temp, text, "utf8");
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true });
  }
}

/** 只管理目录快照与登记文件，不激活插件、不注册节点、不决定生命周期。 */
export function createPluginRepository({
  indexFile,
  reservedIds = [],
  builtinDirectories = {},
}) {
  const drafts = new Map(),
    bundles = new Map();
  let records = [],
    authorizations = [],
    loaded = false,
    loadError = null,
    tail = Promise.resolve();
  const exclusive = (fn) => {
    const result = tail.then(fn);
    tail = result.catch(() => {});
    return result;
  };
  async function load() {
    if (loadError) throw loadError;
    if (loaded) return;
    try {
      const raw = await readOptional(indexFile);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version !== "1.0.0" || !Array.isArray(data.plugins))
          throw Error("插件登记文件格式无效");
        records = data.plugins;
        if (
          data.authorizations !== undefined &&
          !Array.isArray(data.authorizations)
        )
          throw Error("插件授权记录格式无效");
        authorizations = data.authorizations || [];
      }
    } catch (e) {
      loadError = e;
      throw e;
    }
    loaded = true;
  }
  async function persist(next, nextAuthorizations = authorizations) {
    await fs.mkdir(path.dirname(indexFile), { recursive: true });
    await atomicWrite(
      indexFile,
      JSON.stringify(
        { version: "1.0.0", plugins: next, authorizations: nextAuthorizations },
        null,
        2,
      ),
    );
    records = next;
    authorizations = nextAuthorizations;
  }
  // 授权只批准一个确定的目录快照，不替代内核的登记和激活管理。
  function authorization(id, authorizationId) {
    const value = authorizations.find(
      (a) => a.id === id && a.authorizationId === authorizationId,
    );
    if (!value)
      throw Error("目录登记授权不存在或已变化，请由用户在插件中心重新审阅");
    return value;
  }
  const snapshot = async (root) => (await readPluginFiles(root)).files;
  function ticket(map, key, owner) {
    const value = map.get(key);
    if (!value || value.owner !== owner)
      throw Error("目录选择已失效，请重新选择");
    return value;
  }
  async function inspect(owner, directory, replaceId = null) {
    await load();
    const root = await fs.realpath(directory);
    if (!(await fs.stat(root)).isDirectory()) throw Error("请选择文件夹");
    const files = await snapshot(root),
      entries = Object.keys(files).filter((f) => /\.m?js$/.test(f));
    let manifest,
      error = "";
    if (files["studio-plugin.json"]) {
      try {
        manifest = readPluginManifest(JSON.parse(files["studio-plugin.json"]));
      } catch (e) {
        error = e.message;
      }
    }
    manifest ||= pluginManifestDraft(
      path.basename(root),
      entries.includes("index.mjs") ? "index.mjs" : entries[0] || "index.mjs",
    );
    if (replaceId && manifest.id !== replaceId)
      error ||=
        "磁盘声明的插件 ID 与登记记录不同，请恢复原 ID 或重新选择目录登记";
    const token = randomUUID();
    // 关闭表单或重试不会无限保留目录凭据，仅保留每个窗口最近 32 次选择。
    const owned = [...drafts].filter(([, v]) => v.owner === owner);
    for (const [key] of owned.slice(0, Math.max(0, owned.length - 31)))
      drafts.delete(key);
    const diskFingerprint = pluginContentFingerprint(files),
      fingerprint = pluginContentFingerprint(files, manifest);
    drafts.set(token, { owner, root, replaceId, diskFingerprint });
    return {
      token,
      directory: root,
      manifest,
      entries,
      hasManifest: Object.hasOwn(files, "studio-plugin.json"),
      error,
      replaceId,
      fingerprint,
      contentChanged:
        !!replaceId &&
        records.some(
          (r) => r.id === replaceId && r.fingerprint !== fingerprint,
        ),
      permissionsApproved: records.some(
        (r) =>
          r.id === replaceId &&
          r.grants === pluginPermissionKey(manifest) &&
          r.fingerprint === fingerprint,
      ),
    };
  }
  async function prepare(
    owner,
    { token, manifest, createTemplate = false, approvePermissions = false },
  ) {
    await load();
    const draft = ticket(drafts, token, owner),
      value = readPluginManifest(manifest);
    if (reservedIds.includes(value.id)) throw Error("插件 ID 与内置模块冲突");
    if (draft.replaceId && value.id !== draft.replaceId)
      throw Error("编辑已登记插件时不能更改 ID");
    const previous = records.find((r) => r.id === value.id),
      grants = pluginPermissionKey(value);
    if (records.some((r) => r.id === value.id && r.id !== draft.replaceId))
      throw Error("插件 ID 已登记，请使用编辑声明或重新加载");
    if (
      records.some(
        (r) => r.directory === draft.root && r.id !== draft.replaceId,
      )
    )
      throw Error("该目录已经登记");
    const files = await snapshot(draft.root);
    if (pluginContentFingerprint(files) !== draft.diskFingerprint)
      throw Error("审阅后插件文件已变化，请重新读取声明并确认");
    if (createTemplate && value.kind !== "declarative") {
      if (value.entry.includes("/"))
        throw Error("生成示例时入口必须直接位于所选目录");
      if (Object.hasOwn(files, value.entry))
        throw Error("入口文件已存在，不能覆盖生成模板");
      if (value.exportName !== "plugin")
        throw Error("示例模板使用导出名 plugin");
      files[value.entry] =
        value.kind === "extension" ? extensionTemplate : template;
    }
    if (value.kind !== "declarative" && !Object.hasOwn(files, value.entry))
      throw Error("找不到入口文件：" + value.entry);
    // 隔离进程读取的声明与批准指纹一致，不向它提供尚未提交的旧声明内容。
    files["studio-plugin.json"] = JSON.stringify(value, null, 2) + "\n";
    const fingerprint = pluginContentFingerprint(files, value);
    if (draft.authorization) {
      const a = authorization(value.id, draft.authorization.authorizationId);
      if (
        createTemplate ||
        a.directory !== draft.root ||
        a.fingerprint !== fingerprint ||
        a.grants !== grants
      )
        throw Error("插件内容与目录登记授权不一致，请由用户重新审阅");
    }
    if (
      !approvePermissions &&
      !draft.authorization &&
      ((previous &&
        (previous.fingerprint !== fingerprint || previous.grants !== grants)) ||
        (!previous && value.kind !== "nodes"))
    )
      throw Error(
        "插件内容或能力声明需要确认，请打开“编辑声明”审阅当前内容并允许后加载",
      );
    const generation = randomUUID();
    bundles.set(generation, {
      owner,
      manifest: value,
      files,
      root: draft.root,
      template: value.kind !== "declarative" && createTemplate,
      replaceId: draft.replaceId,
      grants,
      fingerprint,
      diskFingerprint: draft.diskFingerprint,
      authorization: draft.authorization,
    });
    return {
      generation,
      manifest: value,
      directory: draft.root,
      enabled: true,
      fingerprint,
    };
  }
  return {
    inspect,
    prepare,
    /** 只列出审阅记录，不返回任意路径或源码。 */
    async authorized() {
      await load();
      return authorizations.map((a) => ({
        id: a.id,
        authorizationId: a.authorizationId,
        name: a.manifest.name,
        version: a.manifest.version,
        fingerprint: a.fingerprint,
        registered: records.some((r) => r.id === a.id),
      }));
    },
    authorize(owner, { token, manifest }) {
      return exclusive(async () => {
        await load();
        const draft = ticket(drafts, token, owner),
          value = readPluginManifest(manifest);
        if (reservedIds.includes(value.id))
          throw Error("插件 ID 与内置模块冲突");
        const files = await snapshot(draft.root);
        if (pluginContentFingerprint(files) !== draft.diskFingerprint)
          throw Error("审阅后插件文件已变化，请重新读取声明");
        if (
          !files["studio-plugin.json"] ||
          JSON.stringify(
            readPluginManifest(JSON.parse(files["studio-plugin.json"])),
          ) !== JSON.stringify(value)
        )
          throw Error("请先保存声明文件，再重新读取并授权，授权不会修改源码");
        if (value.kind !== "declarative" && !Object.hasOwn(files, value.entry))
          throw Error("找不到插件入口文件");
        if (
          authorizations.length >= 64 &&
          !authorizations.some((a) => a.id === value.id)
        )
          throw Error("已授权目录达到 64 个上限，请先撤销不再使用的授权");
        const item = {
          id: value.id,
          authorizationId: randomUUID(),
          directory: draft.root,
          manifest: value,
          grants: pluginPermissionKey(value),
          fingerprint: pluginContentFingerprint(files, value),
        };
        await persist(records, [
          ...authorizations.filter((a) => a.id !== value.id),
          item,
        ]);
        return { id: item.id, authorizationId: item.authorizationId };
      });
    },
    async inspectAuthorized(owner, { id, authorizationId }) {
      await load();
      const a = authorization(id, authorizationId);
      if (records.some((r) => r.id === id))
        throw Error("插件已登记，请使用启用或重新加载");
      const draft = await inspect(owner, a.directory);
      if (
        draft.error ||
        !draft.hasManifest ||
        draft.manifest.id !== id ||
        draft.fingerprint !== a.fingerprint ||
        pluginPermissionKey(draft.manifest) !== a.grants
      )
        throw Error("已授权目录的内容或声明已变化，请由用户重新审阅");
      // 标记只在宿主内部产生，前端传入的同名字段不能取得授权。
      drafts.get(draft.token).authorization = { id, authorizationId };
      return draft;
    },
    revokeAuthorization(id, authorizationId) {
      return exclusive(async () => {
        await load();
        authorization(id, authorizationId);
        await persist(
          records,
          authorizations.filter((a) => a.id !== id),
        );
      });
    },
    async list() {
      await load();
      return structuredClone(records);
    },
    async inspectRegistered(owner, id) {
      await load();
      const record = records.find((r) => r.id === id);
      if (!record) throw Error("插件未登记");
      return inspect(owner, record.directory, id);
    },
    async restore(owner) {
      await load();
      const result = [];
      for (const r of records) {
        try {
          const d = await inspect(owner, r.directory, r.id);
          if (!d.hasManifest)
            throw Error("插件声明文件已丢失，请编辑声明后重新加载");
          if (d.error) throw Error(d.error);
          const p = await prepare(owner, {
            token: d.token,
            manifest: d.manifest,
          });
          result.push({ ...p, enabled: r.enabled });
        } catch (e) {
          result.push({ ...r, error: e.message, enabled: false });
        }
      }
      return result;
    },
    /** 仅按内置映射或已登记 ID 定位目录，不接受前端传入的任意路径。 */
    async directory(id) {
      if (typeof id !== "string" || !id) throw Error("插件 ID 无效");
      let directory = Object.hasOwn(builtinDirectories, id)
        ? builtinDirectories[id]
        : null;
      if (!directory) {
        await load();
        directory = records.find((record) => record.id === id)?.directory;
      }
      if (!directory) throw Error("插件未登记，无法打开文件夹");
      try {
        const resolved = await fs.realpath(directory);
        if (!(await fs.stat(resolved)).isDirectory())
          throw Error("插件路径不是文件夹");
        return resolved;
      } catch (error) {
        if (error.code === "ENOENT" || error.code === "ENOTDIR")
          throw Error("插件文件夹不存在或已移动，请更换目录后重试");
        throw error;
      }
    },
    bundle(owner, generation) {
      return ticket(bundles, generation, owner);
    },
    commit(owner, generation, enabled = true) {
      return exclusive(async () => {
        await load();
        const b = ticket(bundles, generation, owner),
          manifestFile = path.join(b.root, "studio-plugin.json");
        if (b.authorization)
          authorization(b.manifest.id, b.authorization.authorizationId);
        if (records.some((r) => r.id === b.manifest.id && r.id !== b.replaceId))
          throw Error("插件 ID 已由另一个窗口登记");
        if ((await fs.realpath(b.root)) !== b.root)
          throw Error("所选目录已改变，请重新选择");
        if (
          pluginContentFingerprint(await snapshot(b.root)) !== b.diskFingerprint
        )
          throw Error("加载期间插件文件已变化，本次登记已取消，请重新审阅");
        const exists = await fs.lstat(manifestFile).catch((e) => {
          if (e.code === "ENOENT") return null;
          throw e;
        });
        if (exists) {
          if (exists.isSymbolicLink() || !exists.isFile())
            throw Error("声明必须是目录内的普通文件");
          await selectedFile(b.root, "studio-plugin.json");
        }
        const old = await readOptional(manifestFile),
          entryFile =
            b.manifest.kind === "declarative"
              ? null
              : path.join(b.root, b.manifest.entry);
        let wroteEntry = false,
          wroteManifest = false;
        try {
          if (b.template) {
            await fs.writeFile(entryFile, b.files[b.manifest.entry], {
              encoding: "utf8",
              flag: "wx",
            });
            wroteEntry = true;
          }
          // 再检查 manifest 路径，防止选择后被替换成目录外链接。
          if (old !== null) await selectedFile(b.root, "studio-plugin.json");
          await atomicWrite(
            manifestFile,
            JSON.stringify(b.manifest, null, 2) + "\n",
          );
          wroteManifest = true;
          const item = {
            id: b.manifest.id,
            directory: b.root,
            manifest: b.manifest,
            grants: b.grants,
            fingerprint: b.fingerprint,
            enabled,
          };
          await persist([...records.filter((r) => r.id !== item.id), item]);
          b.template = false;
          b.replaceId = item.id;
          b.diskFingerprint = pluginContentFingerprint({
            ...b.files,
            "studio-plugin.json": JSON.stringify(b.manifest, null, 2) + "\n",
          });
          return item;
        } catch (e) {
          if (wroteManifest) {
            if (old !== null) await atomicWrite(manifestFile, old);
            else await fs.rm(manifestFile, { force: true });
          }
          if (wroteEntry) await fs.rm(entryFile, { force: true });
          throw e;
        }
      });
    },
    setEnabled(id, enabled) {
      return exclusive(async () => {
        await load();
        if (!records.some((r) => r.id === id)) throw Error("插件未登记");
        await persist(
          records.map((r) => (r.id === id ? { ...r, enabled: !!enabled } : r)),
        );
      });
    },
    remove(id) {
      return exclusive(async () => {
        await load();
        await persist(records.filter((r) => r.id !== id));
      });
    },
    release(owner, generation) {
      ticket(bundles, generation, owner);
      bundles.delete(generation);
    },
    releaseOwner(owner) {
      for (const map of [drafts, bundles])
        for (const [key, v] of map) if (v.owner === owner) map.delete(key);
    },
  };
}

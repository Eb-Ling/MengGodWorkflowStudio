import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectFiles } from "../packages/native-host/project-files.mjs";
import { createProjectFileService as createService } from "../plugins/project-files/service.mjs";
import { WorkflowRepository } from "../frontend/project/workflow-repository.js";
const memoryLibrary = () => {
  const values = new Map(),
    local = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
  const repository = new WorkflowRepository({ local, session: local });
  return {
    read: ({ id }) => repository.record(id),
    save: ({ document, file = null }) => repository.saveRecord(document, file),
    backup: ({ id }) => repository.backup(id),
  };
};
const createProjectFileService = (options) =>
  createService({ library: memoryLibrary(), ...options });
import { createDocument } from "../packages/plugin-sdk/document.mjs";
import { projectContent } from "../packages/plugin-sdk/project-files.mjs";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { projectFilesPlugin } from "../plugins/project-files/index.mjs";

async function directory(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-p7-"));
  t.after(async () => {
    if (
      !path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(dir).startsWith("workflow-p7-")
    )
      throw Error("Unsafe test cleanup");
    await fs.rm(dir, { recursive: true, force: true });
  });
  return dir;
}
const document = (title) =>
  createDocument({
    project: { id: "p7", title },
    graphs: {
      vertex: { nodes: [], links: [] },
      fragment: { nodes: [], links: [] },
    },
  });
function editor(initial = document("原稿")) {
  let doc = initial,
    token = "one";
  const listeners = new Set();
  const snapshot = () => ({
    project: doc.project,
    document: structuredClone(doc),
    documentToken: token,
    documentRevision: doc.revision,
    stage: "fragment",
    graph: doc.graphs.fragment,
  });
  const emit = () => {
    for (const l of listeners) l();
  };
  return {
    snapshot,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    execute: (r) => {
      assert.equal(r.documentToken, token);
      assert.equal(r.expectedDocumentRevision, doc.revision);
      doc = structuredClone(r.actions[0].payload.document);
      doc.revision++;
      token = crypto.randomUUID();
      emit();
      return { ok: true };
    },
    edit: (title) => {
      doc.project.title = title;
      doc.revision++;
      doc.graphs.fragment.revision = doc.revision;
      emit();
    },
  };
}
const port = (repo, extra = {}) => ({
  available: true,
  list: async () => repo.list(),
  recoveries: async () => repo.recoveries(),
  read: (r) => repo.read(r.fileId),
  write: (r) => repo.write(r),
  backup: (r) => repo.backup(r.fileId),
  checkpoint: (r) => repo.checkpoint(r),
  recover: async (r) => repo.recover(r.recoveryId),
  onClose: () => () => {},
  ...extra,
});
test("真实文件 CAS、外部变更、备份、原子写失败与再次实例化", async (t) => {
  const dir = await directory(t),
    root = path.join(dir, "profile"),
    file = path.join(dir, "测试.workflow.json");
  const repo = createProjectFiles({ root }),
    grant = await repo.grant(file);
  const first = await repo.write({
    fileId: grant.fileId,
    expectedVersion: null,
    text: '{"a":1}',
  });
  await fs.writeFile(file, '{"external":true}');
  await assert.rejects(
    repo.write({
      fileId: grant.fileId,
      expectedVersion: first.version,
      text: "{}",
    }),
    { code: "CONFLICT" },
  );
  assert.equal(await fs.readFile(file, "utf8"), '{"external":true}');
  const external = await repo.read(grant.fileId);
  const current = await repo.write({
    fileId: grant.fileId,
    expectedVersion: external.version,
    text: '{"a":2}',
  });
  assert.equal((await repo.backup(grant.fileId)).text, '{"external":true}');
  const failed = createProjectFiles({
    root,
    beforeReplace: async () => {
      throw Error("磁盘写入失败");
    },
  });
  await assert.rejects(
    failed.write({
      fileId: grant.fileId,
      expectedVersion: current.version,
      text: "{}",
    }),
    /磁盘写入失败/,
  );
  assert.equal((await repo.read(grant.fileId)).text, '{"a":2}');
  assert.deepEqual((await fs.readdir(dir)).sort(), [
    "profile",
    "测试.workflow.json",
  ]);
  assert.equal(createProjectFiles({ root }).list()[0].fileId, grant.fileId);
  await assert.rejects(repo.read("unknown"), { code: "UNAUTHORIZED" });
});
test("重复保存保留上一次有效备份，同时仍拒绝陈旧文件版本", async (t) => {
  const dir = await directory(t), file = path.join(dir, "repeat.workflow.json");
  let replacements = 0;
  const repo = createProjectFiles({root: path.join(dir, "profile"), beforeReplace: async () => { replacements++; }});
  const granted = await repo.grant(file);
  const a = await repo.write({fileId: granted.fileId, expectedVersion: null, text: "A"});
  const b = await repo.write({fileId: granted.fileId, expectedVersion: a.version, text: "B"});
  for (let i=0;i<3;i++) {
    assert.equal((await repo.write({fileId: granted.fileId, expectedVersion:b.version, text:"B"})).version,b.version);
  }
  assert.equal(replacements,2,"相同内容不得替换磁盘或备份");
  assert.equal((await repo.backup(granted.fileId)).text,"A");
  await fs.writeFile(file,"external");
  await assert.rejects(repo.write({fileId:granted.fileId,expectedVersion:b.version,text:"external"}),{code:"CONFLICT"});
  assert.equal((await repo.backup(granted.fileId)).text,"A");
  assert.equal((await fs.readdir(dir)).some(name=>name.endsWith(".studio-lock")),false);
});
test("两个保存者串行保护，最后检查前外部写入也被发现", async (t) => {
  const dir = await directory(t),
    file = path.join(dir, "race.workflow.json"),
    repo = createProjectFiles({ root: path.join(dir, "p") });
  const g = await repo.grant(file),
    v = await repo.write({
      fileId: g.fileId,
      expectedVersion: null,
      text: "old",
    });
  const result = await Promise.allSettled(
    ["one", "two"].map((text) =>
      repo.write({ fileId: g.fileId, expectedVersion: v.version, text }),
    ),
  );
  assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    result.find((x) => x.status === "rejected").reason.code,
    "CONFLICT",
  );
  const fresh = await repo.read(g.fileId),
    racing = createProjectFiles({
      root: path.join(dir, "p"),
      beforeReplace: () => fs.writeFile(file, "outside"),
    });
  await assert.rejects(
    racing.write({
      fileId: g.fileId,
      expectedVersion: fresh.version,
      text: "mine",
    }),
    { code: "CONFLICT" },
  );
  assert.equal(await fs.readFile(file, "utf8"), "outside");
});
test("保存失败保留草稿，冲突确认再次过期时拒绝，重启恢复不覆盖文件", async (t) => {
  const dir = await directory(t),
    root = path.join(dir, "profile"),
    file = path.join(dir, "项目.workflow.json"),
    repo = createProjectFiles({ root });
  const g = await repo.grant(file);
  await repo.write({
    fileId: g.fileId,
    expectedVersion: null,
    text: JSON.stringify(document("磁盘")),
  });
  const workflow = editor(),
    service = createProjectFileService({ workflow, storage: port(repo) });
  t.after(() => service.dispose());
  await service.open({ fileId: g.fileId });
  assert.equal((await service.status()).dirty, false);
  workflow.edit("我的修改");
  await fs.writeFile(file, JSON.stringify(document("外部修改")));
  await assert.rejects(service.save(), { code: "CONFLICT" });
  let state = await service.status();
  assert.equal(state.dirty, true);
  const conflictVersion = state.conflict.version;
  await fs.writeFile(file, JSON.stringify(document("外部再次修改")));
  await assert.rejects(service.save({ conflictVersion }), { code: "CONFLICT" });
  assert.equal(workflow.snapshot().project.title, "我的修改");
  await service.reload();
  assert.equal(workflow.snapshot().project.title, "外部再次修改");
  state = await service.status();
  const recovery = state.recoveries.find((x) => x.title === "我的修改");
  assert.ok(recovery);
  service.dispose();
  const fresh = createProjectFileService({
    workflow: editor(),
    storage: port(createProjectFiles({ root })),
  });
  t.after(() => fresh.dispose());
  await fresh.recover({ recoveryId: recovery.id });
  assert.equal((await fresh.status()).dirty, true);
  assert.equal(
    JSON.parse(await fs.readFile(file, "utf8")).project.title,
    "外部再次修改",
  );
  await assert.rejects(fresh.save(), { code: "CONFLICT" });
  await fresh.save({
    conflictVersion: (await fresh.status()).conflict.version,
  });
  assert.equal(
    JSON.parse(await fs.readFile(file, "utf8")).project.title,
    "我的修改",
  );
});
test("文件读取期间编辑与非法项目均不替换新草稿", async (t) => {
  const dir = await directory(t),
    repo = createProjectFiles({ root: path.join(dir, "p") }),
    file = path.join(dir, "x.workflow.json");
  const g = await repo.grant(file);
  await repo.write({
    fileId: g.fileId,
    expectedVersion: null,
    text: JSON.stringify(document("文件")),
  });
  const workflow = editor();
  let unblock;
  const paused = new Promise((r) => {
    unblock = r;
  });
  const service = createProjectFileService({
    workflow,
    storage: port(repo, {
      read: async (r) => {
        await paused;
        return repo.read(r.fileId);
      },
    }),
  });
  t.after(() => service.dispose());
  const pending = service.open({ fileId: g.fileId });
  workflow.edit("读取时继续编辑");
  unblock();
  await assert.rejects(pending, /工作流已改变/);
  assert.equal(workflow.snapshot().project.title, "读取时继续编辑");
  await service.open({ fileId: g.fileId });
  await fs.writeFile(file, "{broken");
  await assert.rejects(service.reload());
  assert.equal(workflow.snapshot().project.title, "文件");
  const wrong = path.join(dir, "directory.workflow.json");
  await fs.mkdir(wrong);
  await assert.rejects(repo.grant(wrong), { code: "INVALID_FILE" });
});

test("写入期间继续编辑保留脏状态，切换文档不会被旧保存重新绑定", async (t) => {
  const dir = await directory(t),
    repo = createProjectFiles({ root: path.join(dir, "p") }),
    g = await repo.grant(path.join(dir, "saved.workflow.json"));
  await repo.write({
    fileId: g.fileId,
    expectedVersion: null,
    text: JSON.stringify(document("原文件")),
  });
  const workflow = editor();
  let release, started;
  let waiting, entered;
  const arm = () => {
    waiting = new Promise((r) => (release = r));
    entered = new Promise((r) => (started = r));
  };
  arm();
  const service = createProjectFileService({
    workflow,
    storage: port(repo, {
      write: async (r) => {
        started();
        await waiting;
        return repo.write(r);
      },
    }),
  });
  try {
    await service.open({ fileId: g.fileId });
    workflow.edit("保存快照");
    const pending = service.save();
    await entered;
    workflow.edit("较新修改");
    release();
    await pending;
    assert.equal(
      JSON.parse((await repo.read(g.fileId)).text).project.title,
      "保存快照",
    );
    assert.equal((await service.status()).dirty, true);
    assert.equal(workflow.snapshot().project.title, "较新修改");
    arm();
    const another = service.save();
    await entered;
    const s = workflow.snapshot();
    workflow.execute({
      documentToken: s.documentToken,
      expectedDocumentRevision: s.documentRevision,
      actions: [{ payload: { document: document("另一个工作流") } }],
    });
    release();
    await another;
    assert.equal((await service.status()).file, null);
    assert.equal(workflow.snapshot().project.title, "另一个工作流");
    assert.equal(
      JSON.parse((await repo.read(g.fileId)).text).project.title,
      "较新修改",
    );
  } finally {
    service.dispose();
  }
});

test("更换存储端口无需修改业务插件，取消选择不误报保存", async () => {
  const workflow = editor(),
    entries = new Map();
  let close;
  const storage = {
    available: true,
    list: async () => [],
    recoveries: async () => [],
    chooseOpen: async () => null,
    chooseSave: async () => null,
    checkpoint: ({ id, record }) => {
      if (record) entries.set(id, record);
      else entries.delete(id);
    },
    onClose: (cb) => {
      close = cb;
      return () => {
        close = null;
      };
    },
  };
  const service = createProjectFileService({ workflow, storage });
  try {
    workflow.edit("可替换端口");
    assert.equal((await service.saveAs()).cancelled, true);
    assert.equal((await service.open()).cancelled, true);
    close();
    assert.equal([...entries.values()][0].document.project.title, "可替换端口");
  } finally {
    service.dispose();
  }
  assert.equal(close, null);
});
test("插件通过公开 API 挂载，关闭钩子即时写恢复，停用后代理撤销", async (t) => {
  const dir = await directory(t),
    repo = createProjectFiles({ root: path.join(dir, "p") }),
    workflow = editor();
  let close;
  const host = new PluginRuntime();
  host.provide("workflow.library", "1.0.0", memoryLibrary());
  host.provide("workflow.editor", "1.0.0", workflow);
  host.provide(
    "platform.project-files",
    "1.0.0",
    port(repo, {
      onClose: (f) => {
        close = f;
        return () => {
          close = null;
        };
      },
    }),
  );
  host.provide("workflow.operations", "1.0.0", { register: () => {} });
  host.provide("platform.workflow-file-picker","1.0.0",{fromFile(){throw Error("requires desktop picker");}});
  host.register(projectFilesPlugin,{allowLocalApis:true});
  let api;
  host.register({
    manifest: {
      id: "test.consumer",
      name: "test",
      version: "1.0.0",
      apiVersion: "1.0.0",
      requiredApis: { "workflow.project-files": "^1.0.0" },
      capabilities: ["project.files"],
    },
    activate: (c) => {
      api = c.api("workflow.project-files");
    },
  });
  await host.setEnabled("test.consumer", true);
  assert.equal((await api.status()).available, true);
  workflow.edit("关闭前最后修改");
  close();
  assert.ok(repo.recoveries().some((x) => x.title === "关闭前最后修改"));
  await host.setEnabled("studio.project-files", false);
  assert.equal(close, null);
  assert.throws(() => api.status(), /撤销/);
  await host.dispose();
});
test("内容脏标记忽略内核修订号，保留自定义节点 ID 和参数", () => {
  const a = document("内容"),
    b = structuredClone(a);
  b.revision = 9;
  b.graphs.vertex.revision = 9;
  assert.equal(projectContent(a), projectContent(b));
  b.project.title = "不同";
  assert.notEqual(projectContent(a), projectContent(b));
});

test("工作流自定义 ID 不会与对象原型名称混淆", () => {
  const library = memoryLibrary();
  for (const id of ["__proto__", "constructor", "toString"]) {
    const first = document("第一版");
    first.project.id = id;
    library.save({ document: first, file: null });
    assert.equal(library.read({ id }).file, null);
    const second = structuredClone(first);
    second.project.title = "第二版";
    const file = {
      fileId: "selected",
      path: "selected.workflow.json",
      version: "hash",
    };
    library.save({ document: second, file });
    assert.deepEqual(library.read({ id }).file, file);
    assert.equal(library.backup({ id }).project.title, "第一版");
  }
});

test("统一保存普通工作流、备份和重读，不要求文件选择器", async () => {
  const workflow = editor(),
    library = memoryLibrary(),
    storage = { available: false, onClose: () => () => {} };
  const service = createService({ workflow, library, storage });
  try {
    await service.save();
    assert.equal((await service.status()).dirty, false);
    workflow.edit("第二次保存");
    await service.save();
    workflow.edit("未保存");
    await service.reload();
    assert.equal(workflow.snapshot().project.title, "第二次保存");
    await service.backup();
    assert.equal(workflow.snapshot().project.title, "原稿");
    assert.equal((await service.status()).dirty, true);
    await service.save();
    assert.equal(library.read({ id: "p7" }).document.project.title, "原稿");
  } finally {
    service.dispose();
  }
});

test("关联文件与库保存相同快照，再次从库打开读取外部新内容，冲突不更新库", async (t) => {
  const dir = await directory(t),
    repo = createProjectFiles({ root: path.join(dir, "p") }),
    g = await repo.grant(path.join(dir, "linked.workflow.json"));
  await repo.write({
    fileId: g.fileId,
    expectedVersion: null,
    text: JSON.stringify(document("文件初始")),
  });
  const workflow = editor(),
    library = memoryLibrary(),
    service = createService({ workflow, library, storage: port(repo) });
  try {
    await service.open({ fileId: g.fileId });
    workflow.edit("统一保存");
    await service.save();
    assert.equal(
      projectContent(library.read({ id: "p7" }).document),
      projectContent(JSON.parse((await repo.read(g.fileId)).text)),
    );
    await fs.writeFile(g.path, JSON.stringify(document("外部编辑")));
    workflow.edit("本地待保存");
    await assert.rejects(service.save(), { code: "CONFLICT" });
    assert.equal(library.read({ id: "p7" }).document.project.title, "统一保存");
    await service.openSaved({ id: "p7" });
    assert.equal(workflow.snapshot().project.title, "外部编辑");
    assert.equal(library.read({ id: "p7" }).document.project.title, "外部编辑");
    assert.equal((await service.status()).dirty, false);
  } finally {
    service.dispose();
  }
});

test("另存冲突不污染原文件的覆盖确认，新文档清除旧操作错误", async (t) => {
  const dir = await directory(t),
    repo = createProjectFiles({ root: path.join(dir, "profile") });
  const first = await repo.grant(path.join(dir, "first.workflow.json")),
    second = await repo.grant(path.join(dir, "second.workflow.json"));
  await repo.write({
    fileId: first.fileId,
    expectedVersion: null,
    text: JSON.stringify(document("原文件")),
  });
  const workflow = editor(),
    service = createProjectFileService({
      workflow,
      storage: port(repo, {
        chooseSave: async () => {
          const selected = await repo.grant(second.path);
          await fs.writeFile(
            second.path,
            JSON.stringify(document("另存目标外部修改")),
          );
          return selected;
        },
      }),
    });
  try {
    await service.open({ fileId: first.fileId });
    workflow.edit("我的草稿");
    await assert.rejects(service.saveAs(), { code: "CONFLICT" });
    let state = await service.status();
    assert.equal(state.file.fileId, first.fileId);
    assert.equal(state.conflict, null);
    assert.equal(state.dirty, true);
    await service.save();
    assert.equal(
      JSON.parse((await repo.read(first.fileId)).text).project.title,
      "我的草稿",
    );
    assert.equal(
      JSON.parse((await repo.read(second.fileId)).text).project.title,
      "另存目标外部修改",
    );
    await assert.rejects(service.open({ fileId: "missing" }));
    const source = workflow.snapshot();
    workflow.execute({
      documentToken: source.documentToken,
      expectedDocumentRevision: source.documentRevision,
      actions: [{ payload: { document: document("新文档") } }],
    });
    assert.equal((await service.status()).error, "");
  } finally {
    service.dispose();
  }
});

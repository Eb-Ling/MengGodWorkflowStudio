// 配置由可见 MCP 面板取得，本脚本只用公开 stdio 工具操作当前测试文档。
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { openStdioClient } = createRequire(import.meta.url)(
  "../packages/native-host/stdio-client.cjs",
);
const config = JSON.parse(await fs.readFile(process.argv[2], "utf8")),
  out = path.resolve(process.argv[3]);
await fs.mkdir(out, { recursive: true });
const client = openStdioClient({
    executablePath: config.command,
    entry: config.args[0],
    env: config.env,
  }),
  calls = [];
const call = async (name, args = {}, reject = false) => {
  const r = await client.request("tools/call", { name, arguments: args });
  calls.push({ name, args, error: !!r.isError });
  if (reject) {
    assert.equal(r.isError, true);
    return r;
  }
  if (r.isError) throw Error(r.content[0].text);
  return JSON.parse(r.content[0].text);
};
const guard = (s) => ({
  documentId: s.project.id,
  documentToken: s.documentToken,
  stage: s.stage,
  expectedRevision: s.graph.revision,
  expectedDocumentRevision: s.documentRevision,
});
const summary = () => call("workflow_get_summary");
const operation = async (op, options = {}, reject = false) =>
  call(
    "workflow_project_file",
    { ...guard(await summary()), operation: op, ...options },
    reject,
  );
try {
  await client.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "P7 项目文件验收", version: "1.0.0" },
  });
  client.notify("notifications/initialized");
  assert.equal((await call("workflow_get_status")).editorConnected, true);
  await call("workflow_agent_instructions");
  assert.equal((await client.request("tools/list")).tools.length, 35);
  const initial = (await operation("status")).result;
  assert.equal(initial.available, true);
  await operation("open", {}, true);
  await operation("open", { fileId: "ungranted-file" }, true);
  const old = await summary();
  await call("workflow_set_project", {
    ...guard(old),
    title: "P7 MCP 恢复目标",
  });
  await call(
    "workflow_project_file",
    { ...guard(old), operation: "status" },
    true,
  );
  // 等待产品的 350ms 合并保存，不访问磁盘或注入恢复记录。
  const limit = Date.now() + 5000;
  let saved;
  while (Date.now() < limit) {
    saved = (await operation("status")).result.recoveries.find(
      (x) => x.title === "P7 MCP 恢复目标",
    );
    if (saved) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(saved, "公共状态必须能列出自动恢复记录");
  await call("workflow_set_project", {
    ...guard(await summary()),
    title: "P7 MCP 较新草稿",
  });
  await operation("recover", { recoveryId: saved.id });
  assert.equal((await summary()).project.title, "P7 MCP 恢复目标");
  assert.ok(
    (await operation("status")).result.recoveries.some(
      (x) => x.title === "P7 MCP 较新草稿",
    ),
  );
  let fileVerified = false;
  if (initial.recent.length) {
    const id = initial.recent[0].fileId;
    await operation("open", { fileId: id });
    const opened = await summary();
    await call("workflow_set_project", {
      ...guard(opened),
      title: "P7 MCP 已保存项目",
    });
    await call("workflow_save", guard(await summary()));
    assert.equal((await operation("status")).result.dirty, false);
    await call("workflow_open", {
      ...guard(await summary()),
      id: opened.project.id,
    });
    assert.equal((await summary()).project.title, "P7 MCP 已保存项目");
    await call("workflow_set_project", {
      ...guard(await summary()),
      title: "P7 MCP 未保存项目",
    });
    await operation("reload");
    assert.equal((await summary()).project.title, "P7 MCP 已保存项目");
    await operation("backup");
    assert.equal((await summary()).project.title, opened.project.title);
    fileVerified = true;
  } else {
    await call("workflow_save", guard(await summary()));
    await operation("reload");
    assert.equal((await operation("status")).result.dirty, false);
  }
  const result = {
    ok: true,
    route: "MCP only",
    fileVerified,
    checks: [
      "35 public tools",
      "unauthorized paths rejected",
      "document revision guarded",
      "automatic draft visible",
      "recover preserves outgoing draft",
      fileVerified
        ? "file open/save/reload/backup"
        : "unbound workflow saves to library and reloads",
    ],
    calls,
  };
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(
    `PASS: ${calls.length} public MCP calls; fileVerified=${fileVerified}`,
  );
} finally {
  await client.close();
}

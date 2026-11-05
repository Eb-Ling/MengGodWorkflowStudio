import test from "node:test";
import assert from "node:assert/strict";
import { createProjectSession } from "../plugins/project-ui/session.mjs";
import { createRuntimeHistory } from "../plugins/starsector/history.mjs";
const storage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
  };
};
test("依赖历史按路径和版本记录，不能用一个包的下载放行另一个包", () => {
  const store = storage(),
    history = createRuntimeHistory(store);
  assert.equal(history.status({ path: "data/method" }).state, "missing");
  history.recordExport({ path: "data.method" });
  assert.equal(history.status({ path: "data/method" }).state, "current");
  assert.equal(history.status({ path: "data/custom" }).state, "missing");
  assert.throws(() => history.recordExport({ path: "../bad" }), /路径/);
  store.setItem(
    "workflow.runtimeDependencyExports",
    JSON.stringify({ "data.method@1": true }),
  );
  assert.equal(history.status({ path: "data/method" }).state, "outdated");
});
test("项目 UI 仅通过守卫提交，跨文档关闭待导出请求，停用后撤销订阅与写入", async () => {
  let data = {
    project: { id: "a", runtimePath: "data/method" },
    documentToken: "token-a",
    stage: "fragment",
    graph: { revision: 1 },
    documentRevision: 1,
  };
  const subs = new Set(),
    opsSubs = new Set(),
    calls = [];
  const history = createRuntimeHistory(storage());
  const s = createProjectSession({
    ui: {},
    presentation: { report() {} },
    exporter: {history: options=>history.status(options),
      list: () => [],
      subscribe: (f) => {
        opsSubs.add(f);
        return () => opsSubs.delete(f);
      },
    },
    workflow: {
      snapshot: () => structuredClone(data),
      subscribe: (f) => {
        subs.add(f);
        return () => subs.delete(f);
      },
      execute: async (request) => {
        calls.push(request);
        return { ok: true };
      },
    },
  });
  await s.exportEffect();
  assert.equal(calls.length, 0);
  assert.equal(s.model.pendingExport, true);
  history.recordExport({ path: "data/method" });
  await s.continueExport();
  assert.equal(calls[0].actions[0].type, "EXPORT_RUNTIME");
  assert.equal(calls[0].expectedDocumentRevision, 1);
  s.runtime(true);
  data = { ...data, documentToken: "token-b" };
  for (const f of subs) f();
  assert.equal(s.model.runtimeOpen, false);
  await assert.rejects(s.continueExport(), /已关闭/);
  s.dispose();
  assert.equal(subs.size, 0);
  assert.equal(opsSubs.size, 0);
  await assert.rejects(s.action("SAVE_WORKFLOW"), /已停用/);
});

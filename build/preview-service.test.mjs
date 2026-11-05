// 开发者边界测试，发布版用户验收单独通过 preview-service-mcp 执行。
import test from "node:test";
import assert from "node:assert/strict";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { createPreviewService } from "../plugins/preview/service.mjs";
import { createPreviewController } from "../plugins/preview/controller.mjs";
import { previewManifest } from "../plugins/preview/manifest.mjs";
import { readPreviewCall } from "../packages/workflow-tools/preview-contract.mjs";
import { createBridgeService } from "../plugins/mcp/bridge-service.mjs";

function fixture() {
  const jobs = [],
    model = {},
    listeners = new Set();
  let disposed = 0;
  const state = {
    documentToken: "t",
    documentRevision: 0,
    stage: "fragment",
    project: { id: "p", previewWidth: 320, previewHeight: 160 },
    fragmentGraph: { nodes: [] },
    vertexTransform: { graph: { nodes: [] } },
    catalog: [],
  };
  const workflow = {
    snapshot: () => structuredClone(state),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const renderer = {
    render(request, receive) {
      return new Promise((resolve, reject) =>
        jobs.push({
          request,
          reject,
          finish: () => {
            try {
              resolve(
                receive({
                  surface: { toDataURL: () => "data:image/png;base64,frame" },
                  width: request.width,
                  height: request.height,
                }),
              );
            } catch (e) {
              reject(e);
            }
          },
        }),
      );
    },
    status: () => ({ available: true }),
    dispose() {
      disposed++;
    },
  };
  const controller = createPreviewController({ workflow, renderer, model });
  return {
    service: createPreviewService(controller),
    jobs,
    model,
    state,
    listeners,
    disposed: () => disposed,
  };
}
function canvas() {
  const paints = [];
  return {
    width: 112,
    height: 112,
    title: "",
    paints,
    getContext: () => ({
      clearRect() {},
      fillRect() {},
      fillText() {},
      drawImage(...args) {
        paints.push(args);
      },
    }),
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("预览能力合并快速重绘，仅最新帧显示，画布比例与高清参数统一处理", async () => {
  const f = fixture(),
    cleanups = [],
    api = f.service.createApi("a", (fn) => cleanups.push(fn)),
    c = canvas(),
    view = api.mount(c);
  const first = view.render({ time: 0 }),
    queued = [];
  for (let time = 1; time <= 100; time++) queued.push(view.render({ time }));
  assert.equal(f.jobs.length, 1);
  f.jobs[0].finish();
  assert.equal((await first).presented, false);
  await tick();
  assert.equal(f.jobs.length, 2);
  assert.equal(f.jobs[1].request.time, 100);
  f.jobs[1].finish();
  assert.equal(
    (await Promise.all(queued)).filter((x) => x.presented).length,
    1,
  );
  assert.deepEqual(c.paints[0].slice(1), [0, 28, 112, 56]);
  const hd = view.open();
  f.jobs[2].finish();
  await hd;
  assert.equal(f.model.width, 2048);
  assert.equal(f.model.height, 1024);
  assert.equal(f.jobs[2].request.time, 100);
  assert.equal(api.status().mountedViews, 1);
  view.dispose();
  view.dispose();
  assert.equal(api.status().mountedViews, 0);
  assert.equal(f.model.visible, false);
  await assert.rejects(view.render(), /释放/);
  cleanups.forEach((fn) => fn());
  f.service.dispose();
});

test("消费者只回收自己的画布和视框，停用期间的帧不能复活资源", async () => {
  const f = fixture(),
    ca = [],
    cb = [],
    a = f.service.createApi("a", (fn) => ca.push(fn)),
    b = f.service.createApi("b", (fn) => cb.push(fn));
  const va = a.mount(canvas()),
    vb = b.mount(canvas());
  const opened = b.open();
  f.jobs[0].finish();
  await opened;
  await assert.rejects(a.open({ nodeId: "missing" }), /不存在/);
  assert.equal(a.close().closed, false);
  ca.forEach((fn) => fn());
  assert.equal(b.status().mountedViews, 1);
  assert.equal(f.model.visible, true);
  await assert.rejects(va.render(), /撤销/);
  const pending = vb.render(),
    frame = b.frame();
  f.service.dispose();
  f.service.dispose();
  f.jobs[1].finish();
  f.jobs[2].finish();
  await assert.rejects(pending, /停用/);
  await assert.rejects(frame, /停用/);
  assert.equal(f.disposed(), 1);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.model.visible, false);
});

test("画布重复挂载、内部编号、非法尺寸与非白名单远程方法被拒绝", async () => {
  const f = fixture(),
    api = f.service.createApi("a", () => {}),
    c = canvas(),
    view = api.mount(c);
  assert.throws(() => api.mount(c), /已挂载/);
  await assert.rejects(view.render({ surfaceId: "foreign", lease: 1 }));
  await assert.rejects(api.frame({ width: 4097 }));
  await assert.rejects(api.frame({ time: NaN }));
  for (const method of ["mount", "draw", "constructor"])
    assert.throws(() => readPreviewCall({ method, input: {} }));
  assert.throws(() =>
    readPreviewCall({ method: "frame", input: { document: {} } }),
  );
  view.dispose();
  const again = api.mount(c);
  again.dispose();
  assert.equal(f.jobs.length, 0);
  f.service.dispose();
});

test("真实 PluginHost 连续三轮启停：预览订阅与挂载归零、旧句柄撤销", async () => {
  const host = new PluginRuntime();
  let f, api, view;
  host.register(
    {
      manifest: { ...previewManifest, requiredApis: {}, capabilities: [] },
      activate(context) {
        f = fixture();
        context.onDispose(() => f.service.dispose());
        context.provide("workflow.preview", f.service.createApi);
      },
    },
    { allowLocalApis: true },
  );
  host.register({
    manifest: {
      id: "test.preview-user",
      name: "预览消费者",
      version: "1.0.0",
      apiVersion: "1.0.0",
      requiredApis: { "workflow.preview": "^1.0.0" },
      capabilities: ["preview.render"],
    },
    activate(context) {
      api = context.api("workflow.preview");
      view = api.mount(canvas());
    },
  });
  for (let round = 0; round < 3; round++) {
    await host.setEnabled("test.preview-user", true);
    assert.equal(api.status().mountedViews, 1);
    const old = view,
      oldApi = api;
    await host.setEnabled("studio.preview", false);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.disposed(), 1);
    assert.throws(() => oldApi.status(), /撤销/);
    await assert.rejects(old.render(), /撤销/);
    assert.equal(
      host.list().find((p) => p.id === "test.preview-user").enabled,
      false,
    );
  }
  await host.dispose();
});

test("MCP 预览封包绑定草稿修订且不能夹带编辑事务或任意方法", async () => {
  const bridge = createBridgeService(),
    identity = { editorId: "e", incarnation: "i" };
  bridge.publish({
    ...identity,
    project: { id: "p" },
    documentToken: "t",
    documentRevision: 4,
    stage: "fragment",
    graph: { revision: 2 },
  });
  bridge.activate(identity);
  const request = {
    documentId: "p",
    documentToken: "t",
    stage: "fragment",
    expectedRevision: 2,
    previewCall: { method: "status", input: {} },
  };
  assert.throws(() =>
    bridge.submit({
      ...request,
      commands: [{ type: "REMOVE_NODE", payload: { nodeId: "x" } }],
    }),
  );
  assert.throws(() =>
    bridge.submit({ ...request, previewCall: { method: "draw", input: {} } }),
  );
  const pending = bridge.submit(request),
    [entry] = bridge.pull(identity).requests;
  assert.equal(entry.expectedDocumentRevision, 4);
  assert.deepEqual(entry.actions, []);
  bridge.acknowledge({
    ...identity,
    requestId: entry.requestId,
    ok: true,
    result: { mountedViews: 0 },
  });
  assert.equal((await pending).result.mountedViews, 0);
  bridge.dispose();
});

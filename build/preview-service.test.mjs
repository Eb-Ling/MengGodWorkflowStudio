// 开发者边界测试，发布版用户验收单独通过 preview-service-mcp 执行。
import test from "node:test";
import assert from "node:assert/strict";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { createPreviewService } from "../plugins/preview/service.mjs";
import { createPreviewController } from "../plugins/preview/controller.mjs";
import { createPreviewPlayback } from "../plugins/preview/playback.mjs";
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
    controller,
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

test("双阶段使用同一个预览时钟，暂停、续播、换草稿和节点初值均生效", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let now = 1000;
  t.mock.method(performance, "now", () => now);
  const clock = createPreviewPlayback();
  const node = { id: "time", typeId: "input.time", properties: { defaultValue: "0.25", autoAdvance: true } };
  const doc = { documentToken: "a", stage: "fragment", fragmentGraph: {nodes: []}, vertexTransform: {graph: {nodes: [node]}} };
  try {
    clock.sync(doc);
    assert.deepEqual(clock.snapshot(), { time: 0.25, playing: true, available: true });
    now += 500;
    t.mock.timers.tick(83);
    assert.equal(clock.snapshot().time, 0.75);
    clock.set({ playing: false });
    doc.stage = "vertex";
    clock.sync(doc);
    now += 8000;
    t.mock.timers.tick(83);
    assert.equal(clock.snapshot().time, 0.75);
    clock.set({ playing: true });
    now += 250;
    t.mock.timers.tick(83);
    assert.equal(clock.snapshot().time, 1);
    node.properties.autoAdvance = "false";
    node.properties.defaultValue = "0.4";
    clock.sync(doc);
    assert.deepEqual(clock.snapshot(), { time: 0.4, playing: false, available: true });
    clock.sync({...doc, documentToken:"b", vertexTransform:{graph:{nodes:[]}}});
    assert.deepEqual(clock.snapshot(), { time: 0, playing: false, available: false });
  } finally { clock.dispose(); }
});

test("挂载画布和已打开的高清图同步定位，显式采样保持固定秒数", async () => {
  const f = fixture(), api = f.service.createApi("test", () => {}), c = canvas(), view = api.mount(c);
  try {
    const initial = view.render();
    f.jobs[0].finish(); await initial;
    const opened = view.open();
    f.jobs[1].finish(); await opened;
    api.setPlayback({time:0.75, playing:false});
    assert.deepEqual(f.jobs.slice(2).map(j => j.request.time), [0.75, 0.75]);
    f.jobs[2].finish(); f.jobs[3].finish(); await tick();
    assert.equal(api.status().viewerTime, 0.75);
    const pinned = api.open({time:0});
    f.jobs[4].finish(); await pinned;
    api.setPlayback({time:2});
    assert.equal(f.jobs.length, 6);
    f.jobs[5].finish(); await tick();
    assert.equal(api.status().viewerTime, 0);
    const frame = api.frame();
    f.jobs[6].finish(); assert.equal((await frame).time, 2);
    api.close(); view.dispose();
    api.setPlayback({time:4});
    assert.equal(f.jobs.length, 7);
  } finally { f.service.dispose(); }
});

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
  assert.equal(readPreviewCall({method:"setPlayback",input:{time:0.25,playing:false}}).input.time, 0.25);
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

test("修改任一阶段的时间节点可以定位同一个时钟，视口或另一节点的初值不会将其拨回", () => {
  const clock = createPreviewPlayback();
  const n = (id, value) => ({ id, typeId: "input.time", properties: { defaultValue: value, autoAdvance: false } });
  const a = n("a","1"), b = n("b","3");
  const state = {documentToken:"test", fragmentGraph:{nodes:[a]},vertexTransform:{graph:{nodes:[b]}}};
  try {
    clock.sync(state);
    assert.equal(clock.snapshot().time,1);
    clock.set({playing:true});
    b.properties.defaultValue = "8";
    clock.sync(state);
    assert.deepEqual(clock.snapshot(),{time:8,playing:true,available:true});
    clock.set({time:0,playing:false});
    clock.sync(state);
    assert.deepEqual(clock.snapshot(),{time:0,playing:false,available:true});
    state.fragmentGraph.nodes = [];
    clock.sync(state);
    assert.equal(clock.snapshot().time,0);
  } finally { clock.dispose(); }
});

test("可见画布连续播放，高清视框优先，隐藏或切换阶段后停止旧视图", async (t) => {
  t.mock.timers.enable({apis:["setInterval"]});
  let now = 1000;
  t.mock.method(performance,"now",()=>now);
  const f=fixture(), api=f.service.createApi("viewer",()=>{}), view=api.mount(canvas());
  try {
    const paint=view.render(); f.jobs.at(-1).finish(); await paint;
    api.setPlayback({playing:true});
    now+=250; t.mock.timers.tick(249);
    assert.equal(f.jobs.length,2);
    f.jobs.at(-1).finish(); await tick();
    assert.equal(api.status().mountedFrames,2);
    const opened=api.open(); f.jobs.at(-1).finish(); await opened;
    now+=83; t.mock.timers.tick(83);
    assert.equal(f.jobs.length,4);
    f.jobs.at(-1).finish(); await tick();
    f.controller.setViewport(null);
    now+=250; t.mock.timers.tick(249);
    assert.equal(f.jobs.length,4);
    f.controller.setViewport({left:0,top:0,right:0.5,bottom:0.5});
    f.jobs.at(-1).finish(); await tick();
    assert.equal(f.jobs.length,5);
    f.controller.setPageVisible(false);
    const paused=api.status().playback.time;
    now+=1000; t.mock.timers.tick(996);
    assert.equal(f.jobs.length,5);
    assert.equal(api.status().clockTimer,false);
    assert.equal(api.status().playback.time,paused);
    f.controller.setPageVisible(true); f.jobs.at(-1).finish(); await tick();
    f.state.stage="vertex";
    for (const fn of f.listeners) fn();
    const count=f.jobs.length;
    now+=166; t.mock.timers.tick(166);
    assert.equal(f.jobs.length,count);
    assert.equal(api.status().viewerOpen,false);
    view.dispose();
    assert.equal(api.status().changeSubscribers,0);
    assert.equal(api.status().clockSubscribers,1);
  } finally { f.service.dispose(); }
});

test("动画慢帧仍能完成呈现，关闭高清图后普通预览恢复播放", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let now = 1000;
  t.mock.method(performance, "now", () => now);
  const f = fixture(), api = f.service.createApi("animation", () => {}), c = canvas(), view = api.mount(c);
  try {
    const first = view.render();
    api.setPlayback({ playing: true });
    for (let i = 0; i < 5; i++) {
      now += 83;
      t.mock.timers.tick(83);
      await tick();
    }
    assert.equal(f.jobs.length, 1);
    f.jobs[0].finish();
    assert.equal((await first).presented, true);
    assert.equal(c.paints.length, 1);
    now += 83;
    t.mock.timers.tick(83);
    assert.equal(f.jobs.length, 2);
    assert.ok(f.jobs[1].request.time > f.jobs[0].request.time);
    now += 500;
    t.mock.timers.tick(498);
    f.jobs[1].finish(); await tick();
    assert.equal(c.paints.length, 2);
    const opened = api.open(); f.jobs.at(-1).finish(); await opened;
    const count = f.jobs.length;
    now += 83; t.mock.timers.tick(83);
    f.jobs.at(-1).finish(); await tick();
    assert.equal(f.jobs.length, count + 1);
    assert.equal(c.paints.length, 2);
    api.close();
    now += 83; t.mock.timers.tick(83);
    f.jobs.at(-1).finish(); await tick();
    assert.equal(c.paints.length, 3);
  } finally { f.service.dispose(); }
});

test("拖拽期间取消待呈现帧，恢复时取当前时间，释放后不再订阅时钟", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let now = 1000;
  t.mock.method(performance, "now", () => now);
  const f = fixture(), api = f.service.createApi("gesture", () => {}), c = canvas(), view = api.mount(c);
  try {
    const first = view.render(); f.jobs[0].finish(); await first;
    api.setPlayback({ playing: true });
    now += 83; t.mock.timers.tick(83);
    view.setActive(false);
    f.jobs[1].finish(); await tick();
    assert.equal(c.paints.length, 1);
    now += 500; t.mock.timers.tick(498);
    assert.equal(f.jobs.length, 2);
    api.setPlayback({ time: 2, playing: false });
    assert.equal(f.jobs.length, 2);
    view.setActive(true);
    assert.equal(f.jobs[2].request.time, 2);
    f.jobs[2].finish(); await tick();
    assert.equal(c.paints.length, 2);
    view.dispose();
    assert.equal(api.status().clockSubscribers, 1);
    api.setPlayback({ playing: true });
    now += 500; t.mock.timers.tick(498);
    assert.equal(f.jobs.length, 3);
  } finally { f.service.dispose(); }
});

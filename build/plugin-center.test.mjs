import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PluginRuntime } from "../packages/plugin-runtime/index.mjs";
import { createPluginManagement } from "../plugins/plugin-service/management.mjs";
import { createStudioServer } from "../packages/native-host/http-server.mjs";
import {
  createNodeIdAllocator,
  nodeIdBase,
  occupiedNodeIds,
} from "../packages/workflow-tools/index.mjs";
import { instantiate } from "../plugins/templates/index.mjs";
const manifest = (id, requiredApis = {}) => ({
  id,
  name: id,
  version: "1.0.0",
  apiVersion: "1.0.0",
  requiredApis,
});
const provider = {
  manifest: {
    ...manifest("test.provider"),
    providesApis: {
      "test.value": {
        version: "1.0.0",
        methods: {
          get: { arguments: { type: "array" }, returns: { type: "number" } },
        },
      },
    },
  },
  activate(c) {
    c.provide("test.value", { get: () => 1 });
  },
};
test("可读节点 ID 避让重名，重复模板和旧随机模板连线正确且不改原数据", () => {
  const allocate = createNodeIdAllocator(["input", "input_2", "input_3"]);
  assert.equal(allocate("input"), "input_4");
  assert.equal(allocate("input"), "input_5");
  const fragment = {
    nodes: [
      {
        id: "template_12345678-1234-1234-1234-123456789abc",
        typeId: "input.uv",
        canvasX: 0,
        canvasY: 0,
        properties: {},
      },
      {
        id: "my_tint",
        typeId: "io.input",
        canvasX: 100,
        canvasY: 0,
        properties: { parameterId: "customColor", uniform: "u_customColor" },
      },
    ],
    links: [
      {
        fromNode: "template_12345678-1234-1234-1234-123456789abc",
        fromSocket: "uv",
        toNode: "my_tint",
        toSocket: "value",
      },
    ],
  };
  const original = structuredClone(fragment);
  const first = instantiate(fragment, 0, 0, ["uv"]),
    second = instantiate(fragment, 100, 100, ["uv", ...first.nodeIds]);
  assert.deepEqual(first.nodeIds, ["uv_2", "input"]);
  assert.deepEqual(second.nodeIds, ["uv_3", "input_2"]);
  const asNew = createNodeIdAllocator(["uv", ...first.nodeIds]);
  assert.deepEqual(
    second.nodeIds,
    fragment.nodes.map((n) => asNew(nodeIdBase(n.typeId))),
  );
  assert.deepEqual(
    occupiedNodeIds({
      graphs: {
        vertex: { nodes: [{ id: "input", properties: { parameterId: "uv" } }] },
        fragment: { nodes: [{ id: "input_2", properties: {} }] },
      },
    }),
    ["input", "uv", "input_2"],
  );
  assert.equal(second.commands[2].payload.link.fromNode, "uv_3");
  assert.equal(second.commands[2].payload.link.toNode, "input_2");
  assert.equal(
    second.commands[1].payload.node.properties.parameterId,
    "customColor",
  );
  assert.deepEqual(fragment, original);
});
test("停用预览使用内核传递依赖，取消无修改，未确认和过期确认均拒绝", async () => {
  const host = new PluginRuntime();
  host.register(provider);
  const consumer = (id) => ({
    manifest: manifest(id, { "test.value": "^1.0.0" }),
    activate(c) {
      c.api("test.value");
    },
  });
  host.register(consumer("test.first"));
  host.register(consumer("test.second"));
  host.register({
    manifest: {
      ...manifest("test.optional"),
      optionalApis: { "test.value": "^1.0.0" },
    },
    activate(c) {
      if (c.hasApi("test.value")) c.api("test.value");
    },
  });
  await host.setEnabled("test.first", true);
  await host.setEnabled("test.optional", true);
  const management = createPluginManagement({
    host,
    invalidate() {},
    builtinIds: new Set(host.list().map((p) => p.id)),
    setBuiltin: async (id, on) => {
      await host.setEnabled(id, on);
    },
  });
  const first = management.api.previewDisable("test.provider");
  assert.deepEqual(first.stop.map((p) => p.id).sort(), [
    "test.first",
    "test.provider",
  ]);
  assert.deepEqual(
    first.restart.map((p) => p.id),
    ["test.optional"],
  );
  assert.equal(host.list().filter((p) => p.enabled).length, 3);
  await assert.rejects(
    management.api.setEnabled("test.provider", false),
    /确认/,
  );
  await host.setEnabled("test.second", true);
  await assert.rejects(
    management.api.setEnabled("test.provider", false, first.reviewKey),
    /范围/,
  );
  assert.equal(host.list().filter((p) => p.enabled).length, 4);
  const current = management.api.previewDisable("test.provider");
  await management.api.setEnabled("test.provider", false, current.reviewKey);
  assert.deepEqual(
    host
      .list()
      .filter((p) => p.enabled)
      .map((p) => p.id),
    ["test.optional"],
  );
  management.dispose();
  await host.dispose();
});
test("开发示例默认停用，主动启用后重启保留选择，正式插件默认启用", async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-center-"));
  const settingsFile = path.join(folder, "settings.json");
  const plugins = [
    { manifest: manifest("test.normal"), activate() {} },
    {
      manifest: { ...manifest("test.example"), developmentOnly: true },
      enabledByDefault: false,
      activate() {},
    },
  ];
  let app;
  try {
    app = await createStudioServer({
      controlToken:"b".repeat(64),
      frontendRoot: folder,
      plugins,
      settingsFile,
    });
    assert.equal(
      app.host.list().find((p) => p.id === "test.example").enabled,
      false,
    );
    assert.equal(
      app.host.list().find((p) => p.id === "test.normal").enabled,
      true,
    );
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    const response = await fetch(
      `http://127.0.0.1:${app.server.address().port}/host/plugins`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json",Authorization:"Bearer "+"b".repeat(64) },
        body: JSON.stringify({ id: "test.example", enabled: true }),
      },
    );
    assert.equal(response.status, 200);
    await app.dispose();
    app = await createStudioServer({
      controlToken:"b".repeat(64),
      frontendRoot: folder,
      plugins,
      settingsFile,
    });
    assert.equal(
      app.host.list().find((p) => p.id === "test.example").enabled,
      true,
    );
  } finally {
    await app?.dispose();
    await fs.rm(folder, { recursive: true, force: true });
  }
});

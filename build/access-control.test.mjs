import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { randomBytes } from "node:crypto";
import { createSessionAccess } from "../packages/native-host/session-access.mjs";
import { createStudioServer } from "../packages/native-host/http-server.mjs";
import { createAccessController } from "../desktop/access-controller.cjs";
import { createLocalTransport } from "../frontend/application/local-transport.mjs";
import { mcpServerPlugin } from "../plugins/mcp/server-plugin.mjs";
import { createBridgeService } from "../plugins/mcp/bridge-service.mjs";
import { commandPermission } from "../plugins/mcp/access-policy.mjs";
import { openStdioClient } from "../packages/native-host/stdio-client.cjs";
import { createMcpCredentials } from "../desktop/mcp-credentials.cjs";
import { createLocalConnection } from "../packages/native-host/local-connection.mjs";
import { createMcpTools } from "../plugins/mcp/tool-service.mjs";
import { connectionGuide } from "../plugins/mcp-connection/connection-guide.mjs";

const token = () => randomBytes(32).toString("hex");

test("持久授权跨请求会话复用，旧请求取消，临时自检仍会过期", () => {
  let now = 1;
  const access = createSessionAccess({
    controlToken: token(),
    now: () => now,
    ttlMs: 10,
  });
  const key = token(),
    first = access.issue({ mode: "write", persistent: true, token: key });
  const principal = access.authenticate("Bearer " + key);
  assert.equal(first.expiresAt, null);
  assert.deepEqual(
    access.issue({ mode: "write", persistent: true, token: key }),
    first,
  );
  assert.equal(principal.signal.aborted, false);
  const temporary = access.issue({ mode: "read", slot: "selftest" });
  now = 1000;
  assert.throws(() => access.authenticate("Bearer " + temporary.token), /过期/);
  access.endSessions();
  assert.equal(principal.signal.aborted, true);
  assert.throws(() => principal.assertActive(), /撤销/);
  access.authenticate("Bearer " + key).require("session.write");
  access.revoke();
  assert.throws(() => access.authenticate("Bearer " + key), /撤销/);
  access.dispose();
});

test("桌面授权存储只写加密记录，重启读回与撤销，安全存储不可用时明确拒绝", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-credentials-"));
  try {
    const file = path.join(dir, "credentials.json"),
      value = { mode: "write", token: token() };
    const secureStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (s) => Buffer.from(s).map((v) => v ^ 173),
      decryptString: (b) => b.map((v) => v ^ 173).toString(),
    };
    const storage = createMcpCredentials({ file, secureStorage });
    assert.equal(storage.read(), null);
    storage.write(value);
    assert.equal(
      (await fs.readFile(file, "utf8")).includes(value.token),
      false,
    );
    assert.deepEqual(
      createMcpCredentials({ file, secureStorage }).read(),
      value,
    );
    assert.throws(
      () =>
        createMcpCredentials({
          file,
          secureStorage: { isEncryptionAvailable: () => false },
        }).read(),
      /安全存储/,
    );
    storage.clear();
    storage.clear();
    assert.equal(storage.read(), null);
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test("复制相同权限不轮换，权限变化与撤销生效，重启恢复同一授权", async () => {
  let saved = null;
  const access = createSessionAccess({ controlToken: token() });
  const options = {
    baseUrl: "http://127.0.0.1:1",
    controlToken: token(),
    isAllowed: (e) => e === "trusted",
    credentials: {
      read: () => saved,
      write: (v) => {
        saved = structuredClone(v);
      },
      clear: () => {
        saved = null;
      },
    },
    fetchImpl: async (_url, init) => {
      const { action, ...input } = JSON.parse(init.body);
      return Response.json(
        action === "issue"
          ? access.issue(input)
          : (action === "revoke"
              ? access.revoke(input.slot)
              : access.endSessions(),
            {}),
      );
    },
  };
  const controller = createAccessController(options);
  const first = await controller.issue("trusted", { mode: "write" });
  const copies = await Promise.all([
    controller.issue("trusted", { mode: "write" }),
    controller.issue("trusted", { mode: "write" }),
  ]);
  assert.ok(copies.every((v) => v.token === first.token));
  await controller.endSession();
  access.authenticate("Bearer " + first.token).require("session.write");
  const changed = await controller.issue("trusted", { mode: "read" });
  assert.notEqual(changed.token, first.token);
  assert.throws(() => access.authenticate("Bearer " + first.token));
  access.revoke();
  await createAccessController(options).restore();
  access.authenticate("Bearer " + changed.token).require("session.read");
  await controller.revoke("trusted");
  assert.equal(saved, null);
  assert.throws(() => access.authenticate("Bearer " + changed.token));
  access.dispose();
});

test("本机连接每次发现新端口，验证实例身份后才发送凭据", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-endpoint-"));
  try {
    const connectionFile = path.join(dir, "endpoint.json"),
      instanceId = "a".repeat(48),
      calls = [];
    const save = (url) =>
      fs.writeFile(
        connectionFile,
        JSON.stringify({ version: 1, processId: process.pid, instanceId, url }),
      );
    let actualId = instanceId;
    const client = createLocalConnection({
      connectionFile,
      token: token(),
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return Response.json(
          url.endsWith("/health") ? { instanceId: actualId } : { ok: true },
        );
      },
    });
    await assert.rejects(client.request("/v1/state"), /尚未启动/);
    await save("http://127.0.0.1:4000");
    await client.request("/v1/state");
    await save("http://127.0.0.1:5000");
    await client.request("/v1/state");
    assert.equal(client.address(), "http://127.0.0.1:5000");
    assert.equal(calls[0].init.headers, undefined);
    assert.ok(calls[3].init.headers.Authorization);
    actualId = "b".repeat(48);
    await assert.rejects(client.request("/v1/state"), /尚未就绪/);
    assert.equal(calls.length, 5);
    await save("https://example.com");
    await assert.rejects(client.request("/v1/state"), /回环/);
    assert.equal(calls.length, 5);
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test("MCP 列出三种目标，按类型和 ID 选择，拒绝名称猜选与过期目标", async () => {
  let current = {
    ...structuredClone(state),
    editorConnected: true,
    savedWorkflows: [{ id: "saved", title: "同名" }],
  };
  const requests = [];
  const service = createMcpTools({
    bridge: () => "http://127.0.0.1:1",
    readState: async () => current,
    submit: async (input) => {
      requests.push(input);
      const payload = input.actions[0].payload;
      if (payload.operation === "status")
        return {
          ok: true,
          result: { recoveries: [{ id: "recovery", title: "同名" }] },
        };
      current = {
        ...current,
        documentToken: "new-token",
        project: { id: "saved", title: "同名" },
      };
      return { ok: true };
    },
  });
  const listed = (await service.call("workflow_list_workflows")).workflows;
  assert.deepEqual(
    listed.map((v) => v.kind),
    ["draft", "saved", "recovery"],
  );
  await assert.rejects(
    service.call("workflow_select_workflow", { title: "同名" }),
    /kind/,
  );
  const chosen = await service.call("workflow_select_workflow", {
    kind: "recovery",
    id: "recovery",
  });
  assert.equal(chosen.next, "workflow_get_summary");
  assert.equal(requests.at(-1).actions[0].payload.operation, "recover");
  assert.equal(requests.at(-1).documentToken, state.documentToken);
  assert.equal(
    (await service.call("workflow_get_summary")).documentToken,
    "new-token",
  );
  await assert.rejects(
    service.call("workflow_select_workflow", {
      kind: "draft",
      id: state.documentToken,
    }),
    /目标已变化/,
  );
});

test("复制给 AI 的说明与工具共用标准流程，不要求用户编辑 JSON 或激活草稿", async () => {
  const guide = await connectionGuide("write", {
    getMcpConfig: async () => ({
      executablePath: "app.exe",
      mcpServerPath: "client.mjs",
      connectionFile: "endpoint.json",
      mode: "write",
      token: token(),
    }),
  });
  const config = JSON.parse(guide.configuration).mcpServers["workflow-shader"];
  assert.equal(config.env.WORKFLOW_MCP_CONNECTION_FILE, "endpoint.json");
  assert.equal(config.env.WORKFLOW_BRIDGE_URL, undefined);
  for (const name of [
    "workflow_list_workflows",
    "workflow_select_workflow",
    "workflow_get_summary",
  ])
    assert.ok(guide.prompt.includes(name));
  assert.match(guide.prompt, /名称重复/);
  assert.match(guide.prompt, /不能沿用上一份摘要/);
  assert.doesNotMatch(guide.prompt, /[;\uFF1B]/);
});
const identity = { editorId: "editor", incarnation: "current" };
const state = {
  ...identity,
  documentToken: "draft",
  documentRevision: 0,
  project: { id: "document", title: "private draft" },
  stage: "fragment",
  graph: { revision: 0, nodes: [], links: [] },
  generatedSources: { java: { content: "private source" } },
};
const guard = {
  documentId: "document",
  documentToken: "draft",
  stage: "fragment",
  expectedRevision: 0,
  expectedDocumentRevision: 0,
};
const mutation = {
  ...guard,
  commands: [
    {
      type: "ADD_NODE",
      payload: {
        node: {
          id: "a",
          typeId: "io.input",
          canvasX: 0,
          canvasY: 0,
          properties: {},
        },
      },
    },
  ],
};
async function fixture() {
  const control = token(),
    app = await createStudioServer({
      controlToken: control,
      plugins: [mcpServerPlugin],
      frontendRoot: path.resolve("build/ui"),
    });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  const request = async (
    route,
    {
      credential = control,
      input,
      headers = {},
      method = input === undefined ? "GET" : "POST",
    } = {},
  ) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        ...(credential ? { Authorization: "Bearer " + credential } : {}),
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    };
  };
  const issue = async (mode) =>
    (await request("/host/access", { input: { action: "issue", mode } })).body
      .token;
  return {
    app,
    base,
    control,
    request,
    issue,
    publish: async () => {
      await request("/v1/state", { input: state });
      await request("/v1/activate", { input: identity });
    },
  };
}

test("会话凭据区分读写与控制权限，轮换/过期/退出均失效", () => {
  let now = 1;
  const control = token(),
    access = createSessionAccess({
      controlToken: control,
      now: () => now,
      ttlMs: 10,
    });
  const read = access.issue({ mode: "read" }),
    p = access.authenticate("Bearer " + read.token);
  p.require("session.read");
  assert.throws(() => p.require("session.write"), /权限/);
  assert.throws(() => p.require("host.manage"), /权限/);
  const write = access.issue({ mode: "write" });
  assert.equal(p.signal.aborted, true);
  assert.throws(p.assertActive, /撤销/);
  const w = access.authenticate("Bearer " + write.token);
  w.require("session.write");
  assert.throws(() => w.require("session.publish"), /权限/);
  now = 12;
  assert.throws(w.assertActive, /过期/);
  assert.throws(() => access.authenticate("Bearer " + write.token), /过期/);
  const root = access.authenticate("Bearer " + control);
  root.require("host.manage");
  access.dispose();
  assert.throws(root.assertActive, /撤销/);
});

test("HTTP 敏感路由拒绝匿名和错误凭据，公开健康信息不含草稿或插件", async () => {
  const f = await fixture();
  try {
    await f.publish();
    for (const [route, input] of [
      ["/v1/state", undefined],
      ["/host/plugins", undefined],
      ["/host/plugins", { id: "studio.mcp", enabled: false }],
      ["/host/access", { action: "issue", mode: "write" }],
      ["/v1/commands", mutation],
      ["/v1/state", state],
      ["/v1/ack", { requestId: "x" }],
    ]) {
      for (const credential of ["", token()]) {
        const r = await f.request(route, { credential, input });
        assert.equal(r.status, 401);
        assert.doesNotMatch(
          JSON.stringify(r.body),
          /private draft|private source|documentToken/,
        );
      }
    }
    const health = await f.request("/health", { credential: "" });
    assert.deepEqual(health.body, { ok: true, mode: "studio_host" });
    assert.equal(
      (await f.request("/v1/state?token=" + f.control, { credential: "" }))
        .status,
      401,
    );
    assert.equal(
      (await f.request("/host/plugins")).body.plugins[0].enabled,
      true,
    );
  } finally {
    await f.app.dispose();
  }
});

test("Host、Origin、空来源、预检与 JSON 类型在执行前检查", async () => {
  const f = await fixture();
  try {
    for (const origin of [
      "null",
      "https://evil.example",
      f.base + ".evil",
      f.base + "/",
    ])
      assert.equal(
        (await f.request("/v1/state", { headers: { Origin: origin } })).status,
        403,
      );
    assert.equal(
      (
        await f.request("/v1/state", { headers: { Origin: f.base } })
      ).headers.get("access-control-allow-origin"),
      f.base,
    );
    assert.equal(
      (await f.request("/v1/state")).headers.get("access-control-allow-origin"),
      null,
    );
    const badHost = await new Promise((resolve, reject) => {
      http
        .get(
          f.base + "/health",
          { headers: { Host: "rebound.example" } },
          (r) => {
            r.resume();
            resolve(r.statusCode);
          },
        )
        .on("error", reject);
    });
    assert.equal(badHost, 403);
    const preflight = await fetch(f.base + "/v1/state", {
      method: "OPTIONS",
      headers: {
        Origin: f.base,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.notEqual(preflight.headers.get("access-control-allow-origin"), "*");
    const nullPreflight = await fetch(f.base + "/v1/state", {
      method: "OPTIONS",
      headers: { Origin: "null", "Access-Control-Request-Method": "POST" },
    });
    assert.equal(nullPreflight.status, 403);
    assert.equal(
      (
        await f.request("/v1/state", {
          input: state,
          headers: { "Content-Type": "text/plain" },
        })
      ).status,
      415,
    );
  } finally {
    await f.app.dispose();
  }
});

test("只读分类基于实际操作，混合封包、文件写入和预览窗口修改不能伪装为读取", () => {
  for (const input of [
    { workflowCall: { method: "inspect", input: {} } },
    { previewCall: { method: "frame", input: { longEdge: 2048 } } },
    { previewCall: { method: "status", input: {} } },
    { actions: [{ type: "DESCRIBE_EXPORT_CONFIGURATION", payload: {} }] },
    { actions: [{ type: "PROJECT_FILE", payload: { operation: "status" } }] },
  ])
    assert.equal(commandPermission({ ...guard, ...input }), "session.read");
  for (const input of [
    mutation,
    { previewCall: { method: "open", input: {} } },
    { previewCall: { method: "close", input: {} } },
    { previewCall: { method: "setPlayback", input: { time: 0, playing: false } } },
    { actions: [{ type: "PROJECT_FILE", payload: { operation: "save" } }] },
    { actions: [{ type: "EXPORT_RUNTIME", payload: {} }] },
    { actions: [{ type: "EXPORT_RUNTIME_DEPENDENCY", payload: {} }] },
  ])
    assert.equal(commandPermission({ ...guard, ...input }), "session.write");
  assert.throws(
    () =>
      commandPermission({
        ...mutation,
        previewCall: { method: "frame", input: {} },
      }),
    /混入/,
  );
});

test("只读凭据可读源码快照但不能写、发布快照、取待办或管理插件", async () => {
  const f = await fixture();
  try {
    await f.publish();
    const read = await f.issue("read");
    assert.equal(
      (await f.request("/v1/state", { credential: read })).body.generatedSources
        .java.content,
      "private source",
    );
    for (const [route, input] of [
      ["/v1/commands", mutation],
      ["/v1/state", state],
      ["/v1/activate", identity],
      ["/v1/commands?editorId=editor&incarnation=current", undefined],
      ["/host/plugins", undefined],
      ["/host/access", { action: "issue", mode: "write" }],
    ])
      assert.equal(
        (await f.request(route, { credential: read, input })).status,
        403,
      );
    const write = await f.issue("write");
    assert.equal(
      (await f.request("/v1/state", { credential: read })).status,
      401,
    );
    assert.equal(
      (await f.request("/v1/state", { credential: write })).status,
      200,
    );
    assert.equal(
      (await f.request("/host/plugins", { credential: write })).status,
      403,
    );
    await f.request("/host/access", { input: { action: "revoke" } });
    assert.equal(
      (await f.request("/v1/state", { credential: write })).status,
      401,
    );
  } finally {
    await f.app.dispose();
  }
});

test("撤销会取消未投递请求，已投递请求也不会返回晚到结果", async () => {
  const access = createSessionAccess({ controlToken: token() }),
    bridge = createBridgeService();
  bridge.publish(state);
  bridge.activate(identity);
  try {
    for (const delivered of [false, true]) {
      const grant = access.issue({ mode: "write" }),
        p = access.authenticate("Bearer " + grant.token),
        wait = bridge.submit(mutation, p);
      const item = delivered ? bridge.pull(identity).requests[0] : null;
      access.revoke();
      assert.equal((await wait).ok, false);
      assert.equal(bridge.pull(identity).requests.length, 0);
      if (item)
        assert.equal(
          bridge.acknowledge({
            ...identity,
            requestId: item.requestId,
            ok: true,
            result: "private source",
          }).ignored,
          true,
        );
    }
  } finally {
    bridge.dispose();
    access.dispose();
  }
});

test("MCP 停用与编辑器断开撤销旧凭据，重新启用不复活它", async () => {
  const f = await fixture();
  try {
    await f.publish();
    const first = await f.issue("read");
    await f.request("/v1/disconnect", { input: identity });
    assert.equal(
      (await f.request("/v1/state", { credential: first })).status,
      401,
    );
    await f.publish();
    const second = await f.issue("write");
    await f.app.host.setEnabled("studio.mcp", false);
    await f.app.host.setEnabled("studio.mcp", true);
    assert.equal(
      (await f.request("/v1/state", { credential: second })).status,
      401,
    );
  } finally {
    await f.app.dispose();
  }
});

test("真实 stdio 无凭据不能读摘要，只读配置读取资源但拒绝图写入", async () => {
  const f = await fixture(),
    clients = [];
  try {
    await f.publish();
    const read = await f.issue("read");
    for (const credential of ["", read]) {
      const client = openStdioClient({
        executablePath: process.execPath,
        entry: path.resolve("ai-gateway/mcp-client.mjs"),
        env: { WORKFLOW_BRIDGE_URL: f.base, WORKFLOW_MCP_TOKEN: credential },
      });
      clients.push(client);
      await client.request("initialize", { protocolVersion: "2025-06-18" });
      const result = await client.request("tools/call", {
        name: "workflow_get_summary",
        arguments: {},
      });
      assert.equal(!!result.isError, !credential);
      if (credential) {
        assert.match(
          (
            await client.request("resources/read", {
              uri: "workflow://active/summary",
            })
          ).contents[0].text,
          /private draft/,
        );
        assert.equal(
          (
            await client.request("tools/call", {
              name: "workflow_submit_commands",
              arguments: mutation,
            })
          ).isError,
          true,
        );
      }
    }
  } finally {
    for (const c of clients) c.close();
    await f.app.dispose();
  }
});

test("桌面代理核验发送者和固定地址，不能转发控制凭据到第三方或签发接口", async () => {
  const calls = [],
    control = token(),
    event = { trusted: true };
  const c = createAccessController({
    baseUrl: "http://127.0.0.1:4174",
    controlToken: control,
    isAllowed: (e) => e.trusted,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response("{}");
    },
  });
  for (const url of [
    "https://evil.example/v1/state",
    "http://127.0.0.1:4175/v1/state",
    "http://127.0.0.1:4174/host/access",
  ])
    await assert.rejects(
      c.proxy(event, { url, method: "POST", body: "{}" }),
      /未获准/,
    );
  await assert.rejects(c.issue({ trusted: false }, { mode: "write" }), /来源/);
  assert.equal(calls.length, 0);
  await c.proxy(event, {
    url: "http://127.0.0.1:4174/v1/state",
    method: "POST",
    body: "{}",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.Authorization, "Bearer " + control);
  assert.equal(calls[0].init.redirect, "error");
});

test("L1 只给所属 L2 服务本地端口，不通过普通 fetch 泄露控制权限", async () => {
  let proxies = 0,
    networks = 0;
  const desktop = {
    bridgeRequest: async () => {
      proxies++;
      return { status: 200, body: { ok: true } };
    },
  };
  const create = (owner) =>
    createLocalTransport({
      owner,
      baseUrl: "http://127.0.0.1:4174",
      desktop,
      fetchImpl: async () => {
        networks++;
        return new Response("asset");
      },
    });
  await assert.rejects(
    create("studio.workspace")("http://127.0.0.1:4174/v1/state"),
    /未获准/,
  );
  await assert.rejects(
    create("studio.mcp-connection")("http://127.0.0.1:4174/host/access"),
    /未获准/,
  );
  assert.equal(
    (
      await create("studio.plugin-service")(
        "http://127.0.0.1:4174/host/plugins",
      )
    ).status,
    200,
  );
  await create("studio.plugin-service")(
    "http://127.0.0.1:4174/assets/developer/kit.zip",
  );
  assert.equal(proxies, 1);
  assert.equal(networks, 1);
});

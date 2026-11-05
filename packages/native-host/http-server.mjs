import http from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { PluginRuntime } from "../plugin-runtime/index.mjs";
import { createSessionAccess } from "./session-access.mjs";
import { checkRequestBoundary } from "./request-boundary.mjs";

function json(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}
async function readBody(request) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] || "")
  )
    throw Object.assign(new Error("请求必须使用 application/json"), {
      status: 415,
    });
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 4000000) throw new Error("请求过大");
  }
  return JSON.parse(text || "{}");
}
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

export async function createStudioServer({
  frontendRoot,
  plugins,
  settingsFile,
  controlToken,
  instanceId,
  allowedOrigins = [],
}) {
  const access = createSessionAccess({ controlToken });
  const host = new PluginRuntime({ enforceLayers: true }),
    routes = new Set();
  host.provide(
    "platform.http",
    "1.0.0",
    Object.freeze({
      register(handler) {
        routes.add(handler);
        return () => routes.delete(handler);
      },
      endSessions() {
        access.endSessions();
      },
    }),
    false,
    {
      methods: {
        register: { capability: "http.routes" },
        endSessions: { capability: "http.routes" },
      },
    },
  );
  let saved = {};
  if (settingsFile) {
    try {
      saved = JSON.parse(await readFile(settingsFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT")
        console.warn("Plugin settings could not be read:", error.message);
    }
  }
  for (const plugin of plugins) {
    host.register(plugin);
    await host.setEnabled(
      plugin.manifest.id,
      typeof saved[plugin.manifest.id] === "boolean"
        ? saved[plugin.manifest.id]
        : plugin.enabledByDefault !== false,
    );
  }
  let configure = Promise.resolve();
  async function setEnabled(id, enabled) {
    const before = host.list().find((item) => item.id === id);
    if (!before) throw new Error("未知插件");
    await host.setEnabled(id, enabled);
    try {
      if (settingsFile) {
        await mkdir(path.dirname(settingsFile), { recursive: true });
        await writeFile(
          settingsFile + ".tmp",
          JSON.stringify(
            Object.fromEntries(
              host.list().map((item) => [item.id, item.enabled]),
            ),
            null,
            2,
          ),
        );
        await rename(settingsFile + ".tmp", settingsFile);
      }
    } catch (error) {
      await host.setEnabled(id, before.enabled);
      throw error;
    }
    return { ok: true, plugins: host.list() };
  }
  const server = http.createServer(async (request, response) => {
    try {
      const url = checkRequestBoundary(request, response, allowedOrigins),
        method = request.method;
      if (!url) return;
      if (method === "GET" && url.pathname === "/health")
        return json(response, 200, {
          ok: true,
          mode: "studio_host",
          ...(instanceId ? { instanceId } : {}),
        });
      // 静态资源不含用户数据，所有动态入口先鉴权，再读取请求体或执行插件。
      const dynamic =
        url.pathname.startsWith("/host/") || url.pathname.startsWith("/v1/");
      const principal = dynamic
        ? access.authenticate(request.headers.authorization)
        : null;
      if (url.pathname.startsWith("/host/")) principal.require("host.manage");
      if (method === "GET" && url.pathname === "/host/plugins")
        return json(response, 200, { plugins: host.list() });
      const input = method === "POST" ? await readBody(request) : null;
      if (method === "POST" && url.pathname === "/host/access") {
        if (input?.action === "endSession") {
          access.endSessions();
          return json(response, 200, { ok: true });
        }
        if (input?.action === "issue")
          return json(response, 200, access.issue(input));
        if (input?.action === "revoke") {
          if (
            input.slot !== undefined &&
            !["external", "selftest"].includes(input.slot)
          )
            throw Error("无效接入槽位");
          access.revoke(input.slot);
          return json(response, 200, { ok: true });
        }
        throw Error("未知接入操作");
      }
      if (method === "POST" && url.pathname === "/host/plugins") {
        if (typeof input.enabled !== "boolean")
          throw new Error("enabled 必须是布尔值");
        const task = configure.then(() => setEnabled(input.id, input.enabled));
        configure = task.catch(() => {});
        return json(response, 200, await task);
      }
      // 所有插件动态路由统一位于 /v1/，静态资源不会进入业务处理器。
      for (const handler of url.pathname.startsWith("/v1/") ? routes : []) {
        const result = await handler({
          method,
          pathname: url.pathname,
          query: url.searchParams,
          input,
          principal,
        });
        if (result) {
          principal?.assertActive();
          return json(response, result.status, result.body);
        }
      }
      if (url.pathname.startsWith("/v1/"))
        return json(response, 503, {
          ok: false,
          error: "对应服务插件未启用或接口不存在",
        });
      if (url.pathname.startsWith("/host/"))
        return json(response, 404, { error: "接口不存在" });
      if (method !== "GET") return json(response, 404, { error: "Not found" });
      const requested =
        decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(frontendRoot, requested);
      if (!file.startsWith(frontendRoot + path.sep))
        return json(response, 403, { error: "Invalid path" });
      try {
        const bytes = await readFile(file);
        response.writeHead(200, {
          "Content-Type":
            contentTypes[path.extname(file)] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        response.end(bytes);
      } catch {
        json(response, 404, { error: "Not found" });
      }
    } catch (error) {
      json(response, error.status || 400, {
        ok: false,
        error: error.message || String(error),
      });
    }
  });
  return {
    server,
    host,
    async dispose() {
      access.dispose();
      await host.dispose();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

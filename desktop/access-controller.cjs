/** 受控桌面通道。控制凭据留在主进程，渲染器只能请求列明的本地操作。 */
function createAccessController({
  baseUrl,
  controlToken,
  isAllowed,
  fetchImpl = fetch,
  credentials,
}) {
  let tail = Promise.resolve();
  const allowed = new Set([
    "GET /host/plugins",
    "POST /host/plugins",
    "GET /v1/commands",
    "POST /v1/state",
    "POST /v1/activate",
    "POST /v1/disconnect",
    "POST /v1/ack",
  ]);
  const check = (event) => {
    if (!isAllowed(event)) throw Error("桌面调用来源无效");
  };
  async function request(
    route,
    input,
    method = input === undefined ? "GET" : "POST",
  ) {
    const response = await fetchImpl(baseUrl + route, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: "Bearer " + controlToken,
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
    return { status: response.status, body: await response.json() };
  }
  async function access(input) {
    const r = await request("/host/access", input);
    if (r.status !== 200) throw Error(r.body.error || "接入配置失败");
    return r.body;
  }
  function serial(operation) {
    const task = tail.then(operation);
    tail = task.catch(() => {});
    return task;
  }
  return {
    async proxy(event, { url, method = "GET", body } = {}) {
      check(event);
      const target = new URL(url);
      if (
        target.origin !== baseUrl ||
        target.username ||
        target.password ||
        target.hash ||
        !allowed.has(method + " " + target.pathname)
      )
        throw Error("本地请求路径或方法未获准");
      if (
        target.search &&
        !(method === "GET" && target.pathname === "/v1/commands")
      )
        throw Error("此接口不接受查询参数");
      const input = body === undefined ? undefined : JSON.parse(body);
      if (method === "GET" && body !== undefined)
        throw Error("GET 不接受请求体");
      const result = await request(
        target.pathname + target.search,
        input,
        method,
      );
      check(event);
      return result;
    },
    async issue(event, { mode = "write" } = {}) {
      check(event);
      if (!["read", "write"].includes(mode)) throw Error("未知接入权限");
      return serial(async () => {
        check(event);
        let saved = credentials?.read();
        if (!saved || saved.mode !== mode) {
          saved = {
            mode,
            token: require("node:crypto").randomBytes(32).toString("hex"),
          };
          credentials?.write(saved);
        }
        const grant = await access({
          action: "issue",
          ...saved,
          persistent: true,
          slot: "external",
        });
        check(event);
        return grant;
      });
    },
    async revoke(event) {
      check(event);
      return serial(async () => {
        check(event);
        credentials?.clear();
        return access({ action: "revoke" });
      });
    },
    endSession: () => serial(() => access({ action: "endSession" })),
    async restore() {
      return serial(async () => {
        const saved = credentials?.read();
        if (saved)
          await access({
            action: "issue",
            ...saved,
            persistent: true,
            slot: "external",
          });
      });
    },
    status(event) {
      check(event);
      const saved = credentials?.read();
      return { configured: !!saved, mode: saved?.mode || "write" };
    },
    async selfTest(event, run) {
      check(event);
      const grant = await serial(() =>
        access({
          action: "issue",
          mode: "read",
          slot: "selftest",
        }),
      );
      try {
        check(event);
        return await run(grant.token);
      } finally {
        await serial(() => access({ action: "revoke", slot: "selftest" }));
      }
    },
  };
}
module.exports = { createAccessController };

import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const digest = (value) => createHash("sha256").update(value).digest();
const denied = (message = "接入凭据缺失、已过期或已撤销", status = 401) =>
  Object.assign(new Error(message), { status });

/** L1 会话权限只保存在内存，持久凭据由受控桌面通道恢复，不拥有工作流状态。 */
export function createSessionAccess({
  controlToken,
  now = Date.now,
  ttlMs = 8 * 60 * 60 * 1000,
} = {}) {
  if (typeof controlToken !== "string" || !/^[a-f0-9]{64}$/.test(controlToken))
    throw Error("本地服务需要独立的 256 位控制凭据");
  if (!Number.isInteger(ttlMs) || ttlMs < 1) throw Error("无效会话有效期");
  const controlHash = digest(controlToken),
    grants = new Map(),
    controlAbort = new AbortController();
  let closed = false;
  function revoke(slot) {
    for (const [key, grant] of grants)
      if (slot === undefined || grant.slot === slot) {
        grants.delete(key);
        grant.abort.abort();
      }
  }
  function principal(grant, valid) {
    const assertActive = () => {
      if (closed || !valid()) throw denied();
    };
    return Object.freeze({
      signal: grant.abort.signal,
      assertActive,
      require(permission) {
        assertActive();
        if (!grant.permissions.includes(permission))
          throw denied("此接入配置没有所需权限：" + permission, 403);
      },
    });
  }
  return Object.freeze({
    authenticate(header) {
      if (
        closed ||
        typeof header !== "string" ||
        !/^Bearer [a-f0-9]{64}$/.test(header)
      )
        throw denied();
      const tokenHash = digest(header.slice(7));
      if (timingSafeEqual(tokenHash, controlHash))
        return principal(
          {
            abort: controlAbort,
            permissions: [
              "host.manage",
              "session.publish",
              "session.read",
              "session.write",
            ],
          },
          () => !closed,
        );
      const key = tokenHash.toString("hex"),
        grant = grants.get(key);
      if (!grant || grant.expiresAt <= now()) {
        if (grant) revoke(grant.slot);
        throw denied();
      }
      return principal(
        grant,
        () => grants.get(key) === grant && grant.expiresAt > now(),
      );
    },
    /** 只有受控桌面通道可调用，同一槽位重新签发即撤销旧凭据。 */
    issue({
      mode,
      slot = "external",
      token: suppliedToken,
      persistent = false,
    }) {
      if (closed) throw denied();
      if (
        !["read", "write"].includes(mode) ||
        !["external", "selftest"].includes(slot) ||
        typeof persistent !== "boolean" ||
        (persistent && slot !== "external") ||
        (suppliedToken !== undefined &&
          (!persistent ||
            typeof suppliedToken !== "string" ||
            !/^[a-f0-9]{64}$/.test(suppliedToken)))
      )
        throw denied("无效接入权限或槽位", 400);
      const token = suppliedToken || randomBytes(32).toString("hex"),
        expiresAt = persistent ? Infinity : now() + ttlMs,
        key = digest(token).toString("hex");
      const existing = grants.get(key);
      if (existing?.persistent && persistent && existing.mode === mode)
        return { token, mode, expiresAt: null };
      revoke(slot);
      grants.set(key, {
        slot,
        expiresAt,
        persistent,
        mode,
        abort: new AbortController(),
        permissions:
          mode === "write"
            ? ["session.read", "session.write"]
            : ["session.read"],
      });
      return { token, mode, expiresAt: persistent ? null : expiresAt };
    },
    revoke,
    /** 结束本轮请求，持久授权继续有效，旧请求不能在新会话返回。 */
    endSessions() {
      const retained = [...grants].filter(([, grant]) => grant.persistent);
      revoke();
      for (const [key, grant] of retained)
        grants.set(key, { ...grant, abort: new AbortController() });
    },
    dispose() {
      closed = true;
      revoke();
      controlAbort.abort();
    },
  });
}

import { readFile } from "node:fs/promises";

/** L1 本机连接发现，每次请求重新读取启动地址，不读取工作流或插件源码。 */
export function createLocalConnection({
  connectionFile,
  bridgeUrl,
  token,
  fetchImpl = fetch,
}) {
  let currentUrl = bridgeUrl || "";
  function address(value) {
    const url = new URL(value);
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw Error("MCP 仅连接明确的本机回环地址");
    return url.origin;
  }
  async function locate() {
    if (!connectionFile) return address(bridgeUrl);
    let saved;
    try {
      saved = JSON.parse(await readFile(connectionFile, "utf8"));
    } catch {
      throw Error(
        "工作流程序尚未启动，请打开已配置的应用后重试，无需重新配置 MCP",
      );
    }
    if (
      saved.version !== 1 ||
      !Number.isInteger(saved.processId) ||
      saved.processId < 1 ||
      !/^[a-f0-9]{48}$/.test(saved.instanceId)
    )
      throw Error("本机连接记录无效，请重新启动工作流程序");
    try {
      process.kill(saved.processId, 0);
    } catch {
      throw Error("工作流程序已退出，请重新打开后重试");
    }
    const url = address(saved.url);
    const health = await fetchImpl(url + "/health", {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!health.ok || (await health.json()).instanceId !== saved.instanceId)
      throw Error("工作流连接尚未就绪，请稍后重试");
    return url;
  }
  return {
    address: () => currentUrl,
    async request(route, input) {
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        throw Error("缺少有效接入凭据，请先完成一次 MCP 配置");
      if (!["/v1/state", "/v1/commands"].includes(route))
        throw Error("未开放的客户端路由");
      currentUrl = await locate();
      const response = await fetchImpl(currentUrl + route, {
        redirect: "error",
        signal: AbortSignal.timeout(12000),
        headers: {
          Authorization: "Bearer " + token,
          ...(input ? { "Content-Type": "application/json" } : {}),
        },
        ...(input ? { method: "POST", body: JSON.stringify(input) } : {}),
      });
      const result = await response.json();
      if (!response.ok || result.ok === false)
        throw Error(result.error || `HTTP ${response.status}`);
      return result;
    },
  };
}

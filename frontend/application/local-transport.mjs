/** L1 传输适配：仅所属服务能使用动态端口，控制凭据从不进入页面或插件。 */
export function createLocalTransport({
  owner,
  baseUrl,
  desktop,
  fetchImpl = fetch,
}) {
  const paths =
    owner === "studio.mcp-connection"
      ? new Set([
          "/v1/state",
          "/v1/activate",
          "/v1/disconnect",
          "/v1/commands",
          "/v1/ack",
        ])
      : owner === "studio.plugin-service"
        ? new Set(["/host/plugins"])
        : new Set();
  return async (input, init = {}) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      baseUrl,
    );
    const sensitive =
      url.pathname.startsWith("/v1/") || url.pathname.startsWith("/host/");
    if (!sensitive) return fetchImpl(input, init);
    if (url.origin !== baseUrl || !paths.has(url.pathname))
      throw Error("插件未获准调用此本地端口");
    if (!desktop?.bridgeRequest)
      throw Error("此通信入口需要桌面授权通道，源码开发可运行桌面入口");
    init.signal?.throwIfAborted();
    const result = await desktop.bridgeRequest({
      url: url.href,
      method: init.method || "GET",
      body: init.body,
    });
    init.signal?.throwIfAborted();
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

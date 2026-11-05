const reject = (message, status = 403) => {
  throw Object.assign(new Error(message), { status });
};

/** 先校验回环地址、Host 与精确 Origin，无 Origin 的 stdio 仍必须通过后续凭据鉴权。 */
export function checkRequestBoundary(request, response, allowedOrigins = []) {
  const address = request.socket.remoteAddress,
    port = request.socket.localPort;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address))
    reject("仅接受本机连接");
  const host = request.headers.host,
    canonical = `http://127.0.0.1:${port}`;
  if (
    ![`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host)
  )
    reject("Host 不在允许范围");
  if (!request.url?.startsWith("/") || request.url.startsWith("//"))
    reject("请求地址无效", 400);
  const origin = request.headers.origin;
  if (origin !== undefined) {
    if (origin === "null" || ![canonical, ...allowedOrigins].includes(origin))
      reject("Origin 不在允许范围");
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method === "OPTIONS") {
    if (
      !origin ||
      !["GET", "POST"].includes(
        request.headers["access-control-request-method"],
      )
    )
      reject("预检请求无效");
    const headers = (request.headers["access-control-request-headers"] || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (headers.some((x) => !["authorization", "content-type"].includes(x)))
      reject("预检请求头未获准");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.writeHead(204);
    response.end();
    return null;
  }
  if (!["GET", "POST"].includes(request.method))
    reject("不支持此请求方法", 405);
  return new URL(request.url, canonical);
}

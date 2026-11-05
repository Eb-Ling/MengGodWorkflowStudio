import readline from "node:readline";
import { createMcpTools } from "./tool-service.mjs";

/** MCP 协议层通过注入端口访问工作区，不处理磁盘、凭据存储或端口发现。 */
export function startMcpStdio({ request, bridge }) {
  const service = createMcpTools({
    bridge,
    readState: () => request("/v1/state"),
    submit: (input) => request("/v1/commands", input),
  });
  const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
  const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
  const fail = (id, code, message) =>
    send({ jsonrpc: "2.0", id, error: { code, message } });
  let initialized = false;
  const lines = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });
  let pending = Promise.resolve();
  async function receive(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      fail(null, -32700, "Invalid JSON");
      return;
    }
    const { id, method, params = {} } = message || {};
    if (message?.jsonrpc !== "2.0" || typeof method !== "string")
      return fail(id ?? null, -32600, "Invalid request");
    if (id === undefined) return; // Notifications never receive a response.
    try {
      if (method === "initialize") {
        initialized = true;
        const versions = ["2024-11-05", "2025-03-26", "2025-06-18"];
        return reply(id, {
          protocolVersion: versions.includes(params.protocolVersion)
            ? params.protocolVersion
            : "2025-06-18",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: "workflow-mcp-plugin", version: "1.0.0" },
          instructions: service.agentInstructions,
        });
      }
      if (method === "ping") return reply(id, {});
      if (!initialized) return fail(id, -32600, "Initialize first");
      if (method === "tools/list") return reply(id, { tools: service.tools });
      if (method === "resources/list")
        return reply(id, {
          resources: [
            {
              uri: "workflow://active/summary",
              name: "Active workflow summary",
              description:
                "Sanitized active draft, without preview image bytes.",
              mimeType: "application/json",
            },
          ],
        });
      if (method === "resources/read") {
        if (params.uri !== "workflow://active/summary")
          return fail(id, -32602, "Unknown resource URI");
        return reply(id, {
          contents: [
            {
              uri: params.uri,
              mimeType: "application/json",
              text: JSON.stringify(
                service.summary(await service.activeState()),
                null,
                2,
              ),
            },
          ],
        });
      }
      if (method === "tools/call") {
        if (!service.tools.some((tool) => tool.name === params.name))
          return fail(id, -32602, "Unknown tool");
        try {
          const value = await service.call(params.name, params.arguments || {});
          // 图片是标准 MCP 内容块，不把大段 Base64 混进普通文本上下文。
          if (
            params.name === "workflow_render_preview" &&
            params.arguments?.format !== "data"
          ) {
            const { dataUrl, ...metadata } = value;
            if (
              typeof dataUrl !== "string" ||
              !dataUrl.startsWith("data:image/png;base64,")
            )
              throw Error("预览未返回有效 PNG 图片");
            return reply(id, {
              content: [
                { type: "text", text: JSON.stringify(metadata) },
                {
                  type: "image",
                  mimeType: "image/png",
                  data: dataUrl.slice("data:image/png;base64,".length),
                },
              ],
            });
          }
          return reply(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(value, null, 2),
              },
            ],
          });
        } catch (error) {
          return reply(id, {
            isError: true,
            content: [{ type: "text", text: error.message || String(error) }],
          });
        }
      }
      return fail(id, -32601, "Method not found");
    } catch (error) {
      fail(id, -32603, error.message || String(error));
    }
  }
  lines.on("line", (raw) => {
    pending = pending
      .then(() => receive(raw))
      .catch((error) => console.error(error));
  });
}

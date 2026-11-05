// 客户端组合根只装配 L1 连接发现与 MCP 协议插件。
import { createLocalConnection } from "../packages/native-host/local-connection.mjs";
import { startMcpStdio } from "../plugins/mcp/stdio.mjs";
const connection = createLocalConnection({
  connectionFile: process.env.WORKFLOW_MCP_CONNECTION_FILE,
  bridgeUrl: process.env.WORKFLOW_BRIDGE_URL,
  token: process.env.WORKFLOW_MCP_TOKEN,
});
startMcpStdio({ request: connection.request, bridge: connection.address });

exports.testMcpServer = async function ({
  createClient,
  serverPath,
  bridgeUrl,
  token,
}) {
  const client = createClient({
    entry: serverPath,
    env: { ELECTRON_RUN_AS_NODE: "1", WORKFLOW_BRIDGE_URL: bridgeUrl, WORKFLOW_MCP_TOKEN:token },
  });
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "Workflow Studio self-test", version: "1.0.0" },
    });
    client.notify("notifications/initialized");
    const result = await client.request("tools/list"),
      tools = result.tools.map((tool) => tool.name);
    const requiredTools = [
      "workflow_get_status",
      "workflow_get_summary",
      "workflow_submit_commands",
    ];
    if (requiredTools.some((name) => !tools.includes(name)))
      throw new Error("缺少必要 MCP 工具");
    const status = await client.request("tools/call", {
      name: "workflow_get_status",
      arguments: {},
    });
    const connection = JSON.parse(status.content[0].text);
    if (!connection.editorConnected) throw new Error("MCP 未连接到活动草稿");
    const summary = await client.request("tools/call", {
      name: "workflow_get_summary",
      arguments: {},
    });
    if (summary.isError) throw new Error(summary.content[0].text);
    const resource = await client.request("resources/read", {
      uri: "workflow://active/summary",
    });
    if (!resource.contents?.[0]) throw new Error("MCP 草稿资源不可读");
    return {
      bridgeUrl,
      tools,
      requiredTools,
      toolCount: tools.length,
      stdioReady: true,
    };
  } finally {
    client.close();
  }
};

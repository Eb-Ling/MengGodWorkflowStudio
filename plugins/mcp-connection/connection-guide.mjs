import { WORKFLOW_AGENT_PROCEDURE } from "../../packages/plugin-sdk/contracts.mjs";
/** 配置只包含用户选择的客户端权限，控制凭据不离开主进程。 */
export async function connectionGuide(mode, desktop) {
  if (!desktop?.getMcpConfig)
    throw Error("请在桌面版或源码桌面入口生成接入配置");
  const config = await desktop.getMcpConfig({ mode });
  if (
    !config?.token ||
    !config.executablePath ||
    !config.mcpServerPath ||
    !config.connectionFile
  )
    throw Error("接入配置未生成");
  const server = {
    command: config.executablePath,
    args: [config.mcpServerPath],
    env: {
      ELECTRON_RUN_AS_NODE: "1",
      WORKFLOW_MCP_CONNECTION_FILE: config.connectionFile,
      WORKFLOW_MCP_TOKEN: config.token,
    },
  };
  return {
    configuration: JSON.stringify(
      { mcpServers: { "workflow-shader": server } },
      null,
      2,
    ),
    prompt: [
      "请为当前 AI 客户端配置名为 workflow-shader 的 stdio MCP 服务，并验证连接。请使用客户端支持的配置入口，不需要我手动编辑 JSON。已有相同配置时直接复用。",
      "启动程序：" + server.command,
      "启动参数，作为一个完整参数传入：" + server.args[0],
      "环境变量，每行一个：",
      ...Object.entries(server.env).map(([key, value]) => key + "=" + value),
      "",
      "权限：" +
        (config.mode === "read"
          ? "只读，可查看当前草稿、源码结果和预览。切换其他内容或修改需要用户在应用内改为可编辑权限。"
          : "可编辑，可选择工作流、读取、修改、保存和导出。"),
      "此配置在本机当前用户配置目录内持续有效，应用重启或端口变化无需重新配置。应用移动位置、更换用户配置目录、更改权限或撤销接入后才需要更新。凭据仅交给获准的客户端，不放进仓库或公开消息。",
      "",
      WORKFLOW_AGENT_PROCEDURE,
      "",
      "配置完成后，按我指定的草稿或工作流继续，尚未指定时再询问名称或 ID，无需我打开 MCP 面板。",
    ].join("\n"),
  };
}

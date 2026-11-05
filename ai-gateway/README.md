# Workflow Studio MCP 接入

桌面程序负责启动桥接服务。AI 客户端使用 Studio 给出的 stdio 配置，按当前用户的授权发现正在运行的编辑器。同一配置可在重启和端口改变后继续使用。控制凭据不会放进工作流文件。

[用户配置与连接步骤](../README.md) · [工具参数、目标选择、守卫与读图示例](../docs/PLUGIN_API_V1.md) · [模块与进程架构](../docs/ARCHITECTURE_V1.md)

`server.mjs` 是本机服务的组合入口，`mcp-client.mjs` 是客户端启动入口。工具路由位于 `plugins/mcp`，编辑器连接与请求分派位于 `plugins/mcp-connection`。

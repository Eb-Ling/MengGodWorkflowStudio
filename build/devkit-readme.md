# Workflow Studio 插件开发包

解压后用 `examples/minimal-node` 创建第一个节点，用 `examples/glsl-node` 直接写与界面节点相同的 GLSL 函数，用 `examples/minimal-panel` 创建设置面板。要同时提供顶点和片段节点、编译规则与可操作的面板，请看 [双阶段特效](examples/sdk-effect/README.md)。这些示例可直接在 Studio 的「插件 → 插件管理 → 添加本地插件」中选择目录登记。

[中文 API 手册](../docs/PLUGIN_API_V1.md) · [架构与插件分图](https://github.com/Eb-Ling/MengGodWorkflowStudio/blob/v1.0.0/docs/ARCHITECTURE_V1.md)

在解压目录中运行，静态检查需要 Node.js 22.12 或更高版本，无需安装额外依赖：

```powershell
node packages/plugin-testkit/cli.mjs check examples/minimal-node examples/minimal-panel
node packages/plugin-testkit/cli.mjs matrix examples/consumer examples/provider
```

要实际运行隔离插件，请指定 Electron 运行时的 electron.exe，Studio 应用本身不能替代它。以下命令可以检验双阶段、双编译目标与卸载清理：

```powershell
node examples/sdk-effect/probes.mjs > probes.json
node packages/plugin-testkit/cli.mjs smoke examples/sdk-effect --electron "D:/tools/electron/electron.exe" --fixtures probes.json
```

`check` 检查声明与依赖，`matrix` 检查不同提供者组合，`smoke` 运行真实隔离入口。测试包内的编辑和 UI 服务为内存替身，图片、按钮交互和游戏显示仍应分别在 Studio 和游戏中检查。

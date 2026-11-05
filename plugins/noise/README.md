# Noise 节点插件 v1.0

此插件仅通过 `workflow.nodes` 贡献十种噪声节点及两个目标的编译规则。唯一运行依赖是 `@workflow/plugin-sdk`，不导入内核、UI、其他插件或应用编译器。

- `manifest.mjs`：插件 ID `studio.noise`、版本 `1.0.0`、必需 API 与 `nodes.register` 能力。
- `index.mjs`：注册贡献及生命周期清理。
- `nodes.mjs`：当前节点的数据定义。
- `contribution.mjs`：生成独立贡献副本，注册 `studio.noise.*`，支持顶点/片段及 WebGL2/GLSL 430。
- `expressions.mjs`：类型化 IR 算法，没有 GLSL 原始源码注入。

在仓库根目录运行 `pnpm --filter @workflow-plugin/noise test`，可执行只依赖 Node 标准库、内核、SDK 和本插件的契约测试。无需浏览器或安装其他插件，这不是完整游戏环境测试。

用户从「插件 → 插件管理」启停。仅支持 `studio.noise.*`，当前插件停用后，带来源与端口快照的文档仍可读取。二维 Simplex/fbmSimplex 使用梯度算法，FBM 支持 scale 与 0–8 层 octaves，连接输入优先。节点的定义、编译表达式与依赖见 [架构手册](../../docs/ARCHITECTURE_V1.md)，接入见 [API 手册](../../docs/PLUGIN_API_V1.md)。

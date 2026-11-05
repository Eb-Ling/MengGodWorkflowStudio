# Math v1.0

41 个数学/向量节点，仅依赖 SDK 与 workflow.nodes。nodes.mjs 为声明，expressions.mjs 返回类型化 IR，编译目标、预览、导出均不在本插件内。使用 studio.math.* 与 studio.math.vector.*，不注册旧 ID。

通过插件中心启停，缺失节点保留当前端口快照，恢复可继续编辑。独立检查：pnpm --filter @workflow-plugin/math test。见 [架构手册](../../docs/ARCHITECTURE_V1.md) 与 [API 手册](../../docs/PLUGIN_API_V1.md)。

# SDF v1.0

10 个距离、形状及曲线节点，仅依赖 SDK 与 workflow.nodes。算法只提交 IR，不调用 Math 或 Noise。使用 studio.sdf.*、studio.sdf.shape.*、studio.sdf.curve.*，不注册旧 ID。

通过插件中心启停，普通节点库可拖入全部定义。独立检查：pnpm --filter @workflow-plugin/sdf test。见 [架构手册](../../docs/ARCHITECTURE_V1.md) 与 [API 手册](../../docs/PLUGIN_API_V1.md)。

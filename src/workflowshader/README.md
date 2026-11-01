# Java graph 兼容原型

浏览器编译与导出是主实现，见仓库根 README。此目录保留 graph、nodes、compiler、contract、application 和 preview 接口，支持既有 Java 图调用。

runtime/WorkflowShaderPlugin 现在是 data.scripts.workflow.WorkflowBatch 的适配器；资源创建、实例 SSBO、状态恢复、清理由 frontend/runtime/ 的同一份实现负责。编译本目录时必须同时编译 frontend/runtime/*.java。

不再依赖 data.methods.Kratogen_BoxBasedUtils。旧独立 GlStateGuard 和 CombatRenderPlugin 实现已移除。Java 原型的 setInput 仍是整批共享的 float/vector 接口；完整顶点图及类型化实例参数由浏览器导出器提供。

# 浏览器编辑器

从仓库根目录运行 node ai-gateway/server.mjs，打开 http://127.0.0.1:4174/ 。桌面包自动启动该服务。

- app.js：两阶段共用的 GraphStore、画布、选取、缩放、批量操作、连线、检查器、项目库与桥接。切换阶段保留各自视图与撤销栈。
- workflow-stages.js：阶段节点与输出契约；旧顶点图迁移到通用 nodes / links 格式。
- compiler/workflow-compiler.js：两阶段共用的类型化表达式、控制流、自定义节点编译器；只在最终输出适配处区分阶段。
- compiler/fragment-compiler.js：旧模块路径兼容导出。compiler/vertex-graph.js 保留 1.1 离线 API 兼容与几何配置校验；新编辑器不使用其独立 DAG 编译器。
- geometry-settings.js：顶点几何与实例预览设置，调用共享图编译结果。
- controls.css：按钮、菜单、弹窗与下拉框统一主题。
- export/：跨阶段参数 ABI、效果类与 shader 生成、ZIP 打包。
- runtime/：导出附带的唯一 GPU 运行时源码。

节点与几何预览均使用 WebGL2。几何预览逐实例上传参数，不测量 SSBO 性能。游戏 GLSL 和状态恢复由 build/RenderRegression.java 的真实 OpenGL 上下文验证。

草稿分别保存在 sessionStorage 的 workflow.graph 和 workflow.vertexTransform.graph；保存时一起写入 localStorage 项目库。旧 vertex.html 只重定向到 index.html?stage=vertex，不存在第二套画布。

详见根 README、docs/AI_WORKFLOW_FORMAT.md 和 docs/VALIDATION.md。

1.3：export/parameter-contract.js 校验面板参数 ID 与跨阶段一致性；export/java-material.js 根据类型和作用域生成必填配置类、Plugin 构造函数及使用说明。实例构造与初始化在生成类内部完成。

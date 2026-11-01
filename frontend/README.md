# 浏览器编辑器

从仓库根目录运行 node ai-gateway/server.mjs，浏览器打开 http://127.0.0.1:4174/ 。桌面包会自动启动该服务。

- app.js：片段画布、检查器、工作流库与页面桥接适配。
- compiler/fragment-compiler.js：通过显式依赖注入获得节点定义的纯 GLSL 编译器。
- compiler/vertex-graph.js：纯类型化顶点 DAG 校验、GLSL 生成和 CPU 几何求值。
- vertex.js：独立顶点图编辑器、连线选择与拖动布局、单／多实例几何预览。
- export/：统一参数 ABI、效果类和 shader 生成、无依赖 ZIP 打包。
- runtime/：导出附带的唯一 GPU 运行时源码。

片段预览使用 WebGL2，顶点预览使用同一顶点图的 CPU 求值；两者均不声称测量游戏 SSBO 性能。GPU 端实际链接、绘制及状态恢复由 build/RenderRegression.java 验证。

顶点与片段页通过同一标签页的 sessionStorage 共享当前工作流草稿。保存到工作流库后保存在 localStorage；新建项目使用独立默认顶点图，不继承另一个项目的几何。

详见根 README、docs/AI_WORKFLOW_FORMAT.md 和 docs/VALIDATION.md。

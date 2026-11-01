# 当前架构与边界

系统总图见根 README。本文件描述实际依赖，不将尚未实现的后端服务当作现有功能。

## 编辑、编译、导出

同一工作流编辑器按阶段持有两张图及各自的选区、视图、撤销栈，MCP 桥接只向用户激活的草稿投递命令。切换页面不会重放已经完成的命令。顶点页与片段页在同一标签页内共享草稿，工作流保存同时包含两个阶段。

workflow-stages.js 只定义阶段专用节点和旧格式迁移。compiler/workflow-compiler.js 共用 GLSL 表达式、控制流与自定义节点编译逻辑，末端分别输出 position / uv 或 color，不持有 GL 句柄或 DOM。export/runtime-exporter.js 根据输入声明生成统一 ABI、Java 材质类和两个 shader。

## 运行时

生成效果类 → WorkflowBatch → ShaderProgram / VAO / VBO / 两个 SSBO。每个批次拥有一种材质及图层，实例按插入顺序绘制，不跨透明批次重排。

- init/advance：CPU 状态、时间和战斗生命周期；暂停时不推进时间。
- render：检测能力，首次建立 program 与几何，提交变化的实例数据并实例化绘制。
- cleanup：标记过期，释放自有句柄并归零；重复调用无副作用。BoxUtil TemporaryCleanupPlugin 提供战斗结束兜底。
- WorkflowGlState：保存进入时的现代 GL 状态，在正常和异常路径恢复；不使用属性栈或固定管线矩阵栈。

变换 SSBO 遵守 Fixed2DStruct 32 字节布局（绑定 5）；参数 SSBO 使用 uvec4 槽位（绑定 0），float 使用位解释，bool/int/uint 保持整数。位置与方向只用于顶点；片段参数经 flat 接口传递。视口保留 BoxUtil 的 UBO，绑定空间与 SSBO 独立。

矩形及任意四边形使用真实输入顶点。只有 canonical [-1,1] 四边形借用 ShaderCore 共享 VAO，绝不向共享 VAO 写入 attribute 或删除共享 VBO。其他几何由批次拥有。顶点图无法一般性地给出 CPU 包围半径，因此当前批次禁用半径裁剪，后续可增加显式位移界限。

## 为什么暂不使用全局实例池

核对本机 BoxUtil 1.6.3 二进制后，上传助手的持久映射初始化与清理路径仍有需要单独验证的边界。当前复用稳定的 Fixed2DStruct、ShaderProgram、UBO 和共享几何接口，由批次直接拥有 SSBO；没有依赖池内部地址或把自定义参数塞进固定结构。未来引入池实现时，应替换缓冲所有权层并保留同一参数 ABI 与测试。

## 兼容层与未实现项

Java graph 原型通过 WorkflowShaderPlugin 使用同一 WorkflowBatch。它不是浏览器编译器的第二份完整实现，其输入接口仅保留原有 float/vector 共享参数。

当前没有 GPU 粒子模拟、自动跨材质合批、任意网格或 WebGL SSBO 后端。顶点几何和节点预览均使用 WebGL2；几何预览逐实例上传参数，与游戏 SSBO 性能无关。

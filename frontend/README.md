# Workflow Shader Editor MVP

推荐通过本地应用服务器启动。运行 `ai-gateway/server.mjs` 后，在浏览器打开 `http://127.0.0.1:4174/`；该进程同时提供编辑器页面和 MCP 页面桥接。AI 推荐生成符合 [AI_WORKFLOW_FORMAT.md](../docs/AI_WORKFLOW_FORMAT.md) 的 JSON 文件，再使用页面顶部“导入工作流”；程序会严格校验后加载，不需要让 AI 直接操作页面。

操作：从左侧节点库拖入节点；拖动方形节点标题栏移动；从右侧输出圆点拖向左侧输入圆点建立连接；从已经连线的输入端口拖向空白处可解除连接；点击节点选中；`Delete` 删除选中节点；右键节点可开关预览、断开全部连线或删除节点。右侧 Inspector 可以修改常量和动态运算节点的 `valueType`。

非标量节点默认输出正方形预览：`FLOAT` 为灰度、`VEC2` 为 XY 颜色编码、`VEC3/VEC4` 为 RGB。每个节点均可通过 Inspector 或右键菜单关闭预览，常量节点默认不渲染图形；任何输入值、连接、类型或属性变更都会重算预览。

“添加演示节点”会建立 `UV -> 中心化 UV -> 距离`，最后一个节点预览即以 (0, 0) 为中心的径向距离灰度图。顶点变换页和自定义 GLSL 节点页分别为 `vertex.html` 和 `custom-node.html`。

MVP 的 `GraphStore` 只在内存中维护图，但数据结构与后端 `GraphSnapshotDto`、`GraphCommand` 对齐。将来只需把 `LocalGraphTransport` 换成 HTTP/WebSocket transport，不改画布与节点组件。

## 工作流与导出

顶部“流程图”创建一个独立工作流名称、导出 Java 类名和 shader 目录；“保存工作流”会保存该配置及图快照到浏览器本地存储；“导出运行文件”会生成同名的 `.java`、`.vert`、`.frag` 三个文件。导出的 Java 为 `BaseCombatLayeredRenderingPlugin`，构造器强制接收四个顶点坐标与目标 `CombatEngineLayers`，使用 VAO/VBO、BoxUtil UBO 和 `modelMatrix`，不使用固定管线或立即模式。

数学分类覆盖常用 GLSL 函数，包括 `atan(y,x)`、`mix`、`smoothstep`、`step`、`mod`、三角/反三角、指数/对数、幂、取整、符号、角度转换；此外还提供 MengGod 的 value/Simplex/Worley/湍流噪声、光矛和线段 SDF、淡出及三/四阶贝塞尔节点。每个已实现节点均由同一节点定义驱动编辑器预览和 GLSL 发射。

生成的 Java 采用完整、可读的分行格式，并严格跟随 `Meng_MingGodSignPlugin` 的运行时顺序：`createShaderProgramFromFiles` → `getUniformLocations` → `createUniversalRectVAO` → `glPushAttrib` → `glUseProgram` → `buildModelMatrix` → `drawVAOQuad` → `glPopAttrib` → `cleanupAll`。这些方法已经全部提取为导出类的私有静态方法，因此生成物不依赖 Meng 的 `data.methods.shaders.ShaderUtil`；BoxUtil 只由顶点 shader 的 `BUtilGlobalData` UBO 提供游戏视口矩阵。

## 内置示例：明神印记旋涡

在顶部“示例工作流”选择“明神印记旋涡”，会加载 `Meng_MingGodSignPlugin` 的实际片段阶段：中心化 UV → 径向距离/极角 → `pow` → 时间缩放 → 加减乘 → `cos` → 标准 3D 湍流 → 湍流乘旋涡 → 径向与内环淡出 → RGBA 输出。`3D 湍流`是标准噪声节点，固定接受 `x/y/z` 三个 float 并输出 float；示例连接为 `x=旋涡`、`y=距离+Time×0.2`、`z=Time×0.1`。仅极角和最终颜色合成保留为自定义 GLSL 节点，因为基础节点当前没有向量分量拆分和颜色构造端口。示例导出的 `.frag` 保留原插件的 `#version 430`、`u_time`、`u_duration`、`u_progress` 接口及原计算公式；`.vert` 为对应的标准 `common.vert` 布局。

`时间 Time` 节点让导出 Java 在 `advance(float amount)` 中自动累计 `u_time`；其 `defaultValue` 仅用于编辑器节点预览。其他“输入”节点统一成为 shader 的 `u_*` 参数，初始值用于预览和插件默认值，运行时统一调用 `setInput("u_duration", duration)`、`setInput("u_progress", progress)`（也支持 2～4 个 float 的向量）即可。工作流替代渲染；原插件的投射物吸收、速度施加和爆炸等战斗逻辑应保留在调用方。

画布支持从空白区域左键拖动或中键拖动平移，滚轮以鼠标位置为中心缩放。节点预览是按图的计算 revision 缓存的：创建、连接、删除或修改会重算一次；只移动节点、平移或缩放画布时不会重新生成像素。当前 MVP 采用 CPU 离散预览；GPU 离屏预览保留给后续 `PreviewRenderer` 实现，以避免在浏览器端建立与游戏不同的 GLSL 上下文。

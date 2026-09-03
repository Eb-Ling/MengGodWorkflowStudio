# Workflow Shader Engine：完整架构

## 目标和边界

这是一个把节点工作流编译为 Starsector/BoxUtil GLSL 4.20 效果的引擎。编辑器前端、应用后端、图领域模型、GLSL 编译器和游戏渲染器必须隔离。前端可替换为网页、桌面 Java UI 或游戏内 UI；后端可从本地进程扩展到 WebSocket 服务；游戏运行时始终保持纯 Java + BoxUtil 接口。

本架构不包含立即模式和固定管线。所有效果使用 BoxUtil `BUtilGlobalData` UBO、VAO/VBO、显式 `modelMatrix` 和显式状态恢复。

## 系统总览

```text
┌──────────────────────── Frontend / Editor ────────────────────────┐
│ Canvas Node Editor │ Inspector │ Diagnostics │ Realtime Preview    │
│              只读 DTO；只写 Command；只订阅事件                    │
└──────────────────┬───────────────────────────┬────────────────────┘
                   │ HTTP/IPC Command API       │ WebSocket/Event API
┌──────────────────▼──────── Backend / Application ─────────────────┐
│ GraphApplicationService │ GraphRepository │ CompilerFacade         │
│ PreviewSessionManager   │ NodeCatalog     │ Diagnostics / Undo      │
└──────┬────────────────────┬────────────────────┬───────────────────┘
       │                    │                    │
┌──────▼──── Domain ────────▼──── Compiler ──────▼──── Runtime ─────┐
│ Graph/Node/Socket/Link      FragmentCompiler       WorkflowShader  │
│ Node definitions/catalog    GLSL source map        Plugin + BoxUtil│
│ no UI / no GL handles       no UI / no GL calls    only GL boundary│
└───────────────────────────────────────────────────────────────────┘
```

## 模块职责与依赖

| 模块 | 职责 | 严禁依赖 |
|---|---|---|
| `frontend` | 节点画布、Inspector、预览面板、快捷键 | Starsector API、OpenGL、编译器内部表达式 |
| `application` | 命令处理、事务、撤销/重做、存储、事件编排 | 具体前端框架、GL 调用 |
| `contract` | DTO、命令、响应、事件、错误码、版本号 | Graph 可变内部实现、GL handle |
| `graph` | 图、端口、类型和连线规则、Node 抽象 | UI、文件系统、OpenGL、BoxUtil |
| `nodes` | 内置节点和节点元数据 | 具体编辑器控件、GPU 状态 |
| `compiler` | 验证、拓扑排序、GLSL、源码映射、诊断 | 前端状态、游戏实体 |
| `runtime` | Program/VAO/VBO/Uniform/纹理/Pass 生命周期 | 编辑器、JSON DTO |
| `preview` | 隔离预览会话和 RenderTarget | 具体前端实现 |

依赖只能从上向下。`frontend` 不得持有可变 `Graph`，而是通过 `contract` 的快照和命令与后端交互。

## 前端页面规划

页面应作为独立项目，如 `frontend/`（React + TypeScript + Vite，或等价实现），不进入 Java `src/`：

| 页面/区域 | 功能 | 后端接口 |
|---|---|---|
| 项目浏览器 | 新建、打开、复制、版本列表 | `GraphProjectApi` |
| 节点画布 | 拖入、连线、框选、缩放、分组 | `GraphCommandApi` + `GraphChanged` |
| 节点库 | 分类、搜索、端口说明 | `NodeCatalogApi` |
| 属性检查器 | 常量、输入默认值、材质属性 | `SET_PROPERTY` command |
| 编译面板 | GLSL、警告、定位至节点/端口 | `CompileApi` + `Diagnostic` |
| 实时预览 | 主输出/单节点预览、时间与输入调节 | `PreviewApi` + `PreviewFrame` |
| 性能面板 | 编译耗时、节点数、Pass 数、FPS | `PreviewMetrics` |

前端状态只保存选中项、视图坐标、面板展开和请求状态；图的权威状态只由后端保存并以 `GraphSnapshot` 下发。

## API 契约

所有请求都带 `schemaVersion`、`projectId`、`revision`。图修改命令必须带前端已知 revision；revision 不匹配时返回 `REVISION_CONFLICT` 及最新快照，避免多窗口或自动保存覆盖。

```text
GET  /api/node-catalog                         -> NodeCatalogDto
GET  /api/projects/{id}/graph                  -> GraphSnapshotDto
POST /api/projects/{id}/commands               -> CommandResultDto
POST /api/projects/{id}/compile                -> CompilationDto
POST /api/projects/{id}/preview-sessions       -> PreviewSessionDto
PATCH /api/preview-sessions/{id}/inputs        -> PreviewStateDto
DELETE /api/preview-sessions/{id}              -> 204
WS   /api/events?projectId={id}                -> GraphChanged | Diagnostic | PreviewFrame
```

命令用统一 `type`：`ADD_NODE`、`REMOVE_NODE`、`MOVE_NODE`、`CONNECT`、`DISCONNECT`、`SET_PROPERTY`、`SET_OUTPUT`、`UNDO`、`REDO`。`GraphSnapshotDto` 只保存节点类型 ID、参数、画布坐标和 link，绝不保存 Java 类名、GLSL 源码、GPU ID 或游戏实体引用。

## 实时节点预览扩展点

前端不直接编译 GLSL。它只请求预览节点输出；后端的预览会话以可替换渲染器生成帧：

```text
PreviewPanel → PreviewApi.request(nodeId, outputSocket, settings)
             → PreviewSessionManager
             → PreviewRenderer
                ├─ BoxUtilPreviewRenderer：游戏内/同 JVM GL context
                ├─ DesktopPreviewRenderer：独立 LWJGL context
                └─ RemotePreviewRenderer：开发辅助进程/渲染农场
```

预览会话有独立 `PreviewRenderTarget` 和状态保护。图 revision 变化时取消旧编译；只接收与当前 revision 相符的帧。单节点预览把被选端口临时封装为 `vec4` 输出（float 灰阶、vec2 XY、vec3 RGB、vec4 RGBA），因此不改写原图。前端 MVP 已提供同语义 CPU 预览作为无游戏上下文回退；正式版本以离屏 GPU 渲染器替换该适配器。

## 节点注册与第三方扩展

节点类型使用稳定 ID，例如 `math.add`、`noise.fbm`、`io.input`，禁止把 Java 类名作为序列化标识。数值节点端口可使用编辑器类型变量 `AUTO`；连接到具体端口后，`GraphTypeResolver` 将该变量统一绑定为 `FLOAT/VEC2/VEC3/VEC4`。`AUTO` 只能存在于编辑器快照，后端构造 `Graph` 前必须消解它并报告未解约束；最终 Java Node 永远拥有确定的 `ValueType`。未来 `NodeCatalog` 从内置节点和插件收集：显示名、分类、说明、端口、默认参数、UI widget hint、`NodeFactory`、`GlslEmitter` 和可选 `PreviewHintProvider`。

插件节点必须是纯编译单元：不可在 Node 内创建 GL 资源或查询游戏状态。运行期值只能通过 `u_*` Input、纹理绑定描述或专门 Runtime Binding 提供。

## 编译、诊断与游戏运行时契约

编译阶段：结构验证 → 类型验证 → 拓扑排序 → 死节点剔除 → GLSL 生成 → 驱动编译/链接。每一步产生 `Diagnostic(severity, code, message, nodeId, socketName, sourceSpan)`；生成器维护 `SourceMap`，让 GLSL 报错可回到节点。

`WorkflowShaderPlugin` 是唯一允许接触 OpenGL/BoxUtil 的边界：顶点使用 `BUtilGlobalData/gameViewport`；构造时必须传入 `QuadVertices`（三角条带顺序的四个顶点），运行时不会暗中构造矩形；顶点阶段输出 `out vec2 v_uv`，片段编译器以 `in vec2 v_uv` 接收它；模型矩阵由 `Kratogen_BoxBasedUtils.maintainAnchoredFloatBuffer` 生成；每个 Pass 自己拥有 program、VAO/VBO、FBO/纹理和 `GlStateGuard`；资源仅在 `init/cleanup` 创建和释放。禁止 `glBegin/glEnd`、矩阵栈、`gl_ModelViewProjectionMatrix` 或隐式固定管线状态。

## 版本与交付阶段

工程根对象必须有 `schemaVersion`。增加参数、改名节点类型或默认值时，通过 `GraphMigrator` 迁移 DTO 后再构造领域 Graph；编译产物、预览缓存、GPU 资源不能持久化。

1. 已完成：图模型、基础节点、GLSL 4.20 编译、BoxUtil 单 Pass 渲染和状态保护。
2. 下一阶段：DTO/JSON codec、NodeCatalog、命令服务、诊断对象、工程保存加载。
3. 编辑器阶段：独立节点画布、Inspector、WebSocket 图事件、GLSL/错误面板。
4. 预览阶段：PreviewSession、离屏 RenderTarget、节点端口预览、输入实时调节。
5. 高级阶段：纹理/SDF 节点、BlendMode、多 Pass/PassGraph、缓存和性能分析。

## 外部 Agent 工作流桥接与 MCP

不再接入 AI、中转站或第三方模型服务。编辑器提供本地 loopback 页面桥接，允许 Codex 等外部 Agent 通过 MCP 读取当前页面并提交白名单命令。命令由页面按现有 `GraphStore.command()` 路径执行，保证 Agent 与用户使用同一套机制。

```text
Editor Page
  └─ POST localhost /v1/state (GraphSnapshot + project + NodeCatalog)
       └─ Local Workflow Page Bridge
            └─ command queue ← POST /v1/commands
                 └─ Editor polling → GraphStore.command()

MCP Client / Agent
  └─ stdio Workflow MCP Server
       ├─ workflow_get_current
       ├─ workflow_list_node_types
       └─ workflow_submit_commands
```

### 信任边界

- 桥接服务只监听 `127.0.0.1`，不连接外部网络，也不保存 API Key。
- 命令仅允许 `ADD_NODE`、`REMOVE_NODE`、`MOVE_NODE`、`CONNECT`、`DISCONNECT`、`SET_PROPERTY`、`RENAME_NODE`、`SET_OUTPUT`；服务端和页面端都进行白名单检查。
- Agent 提交的是实际操作命令，不再经过 AI 草稿审批；是否允许 Agent 修改当前页面是用户启动本地桥接服务这一动作本身决定的。保存工作流、导出文件仍需调用页面已有按钮或后续明确暴露的接口。
- 生产后端应为命令携带 `projectId` 与 `revision`；若页面在命令排队期间发生变化，应返回 `REVISION_CONFLICT`，防止过期命令覆盖新图。

### Agent Skill 约束

外部 Agent 应先调用 `workflow_get_current` 和 `workflow_list_node_types`，优先用数学、向量、纹理、噪声基础节点组合；必须遵守 socket 类型、端口名和 `io.output` 连接规则，禁止依赖示例节点名称。纹理节点一律视作 `SpriteAPI` 运行时绑定，并使用工作流共享的等比例采样约定。

当前可运行的页面桥接、MCP Server 与启动说明位于 `ai-gateway/`。它是前端 MVP 的过渡适配器；正式应用服务落地后应把浏览器轮询替换为 `GraphApplicationService` 的事件通道，并加入 project/revision 校验。

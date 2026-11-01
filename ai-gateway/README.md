# Workflow Page Bridge

此目录是工作流编辑器的本地页面桥接服务。它不连接任何 AI 或第三方中转站；Codex 等 Agent 通过 MCP 读取当前页面正在编辑的内存草稿，并提交白名单图命令，由页面按现有 GraphStore 机制执行。保存仅写入编辑器的工作流库，不是 MCP 读取或编辑的前置条件。

桥接采用“活动编辑器”租约：页面加载和后台同步都只发布观察状态，不能覆盖草稿、读取命令或确认操作。用户必须在目标编辑器点击画布或“工作流 → 检测桥接”明确激活租约；这样 Agent 即使错误地打开另一张编辑器页，也不会接管用户正在编辑的图。`workflow_get_current` 始终返回活动编辑器的未保存草稿，绝不会自动打开已保存工作流。

## 配置与启动

PowerShell 示例：

```powershell
$env:WORKFLOW_BRIDGE_PORT = "4174"
Set-Location "<MengGod Workflow Studio 安装目录>\ai-gateway"
node server.mjs
```

前端默认访问 `http://127.0.0.1:4174`。桥接服务只监听 loopback，不上传项目数据到网络。编辑器既可由 `http://localhost:4173` 打开，也可直接由 `file:///.../frontend/index.html` 打开；服务已允许这两种本地页面发布工作流状态。

页面顶部“工作流”窗口内提供桥接端口、连接检测和“显示 MCP 配置与接入提示”。提示会根据当前端口和项目路径生成：包含启动 `server.mjs` 的 PowerShell 命令、完整 `mcpServers` 配置（含 `WORKFLOW_BRIDGE_URL`）以及 Agent 操作规则，并显示在可选择的多行文本框中。浏览器不能直接启动本机 Node/EXE 进程，因此检测失败时仍需在终端运行 `node server.mjs`；未来封装 EXE 后可由相同按钮调用启动器。

在 Codex 的“连接至自定义 MCP”表单中，名称填写 `workflow-shader`，类型选择“STDIO”，并使用 EXE 内“工作流 → 显示 MCP 配置与接入提示”给出的当前真实命令、参数和 `WORKFLOW_BRIDGE_URL`。不要手写旧安装目录或假设端口恒为 4174。页面中的提示会显示为可选择文本，用户可以只复制需要的段落。

服务提供 `workflow_*` 工具，以及 `workflow://active/summary` 只读资源。配置成功后，Codex、Claude Desktop 等客户端应显示 `workflow_get_status`、`workflow_get_summary`、`workflow_submit_commands` 等工具；若工具未出现，说明 MCP 尚未注册到当前会话，需要按客户端要求新建或重启会话。不要以 shell 或浏览器另开编辑器页面、手工发送 JSON-RPC 作为替代操作方式。

## MCP Server

`node mcp-server.mjs` 启动 stdio MCP Server。它只读取和操作当前页面正在编辑的内存草稿，不提供文件、Shell 或外部网络工具。

页面每两秒同步一次状态。`workflow_get_status` 永远只返回连接状态；`workflow_get_summary` 是 Agent 的常规读取入口，会去除纹理预览 Base64、生成源码和完整库数据。编辑器未连接时，MCP 不会读取或写入可能过期的内存草稿。每次 MCP 写操作都会先检查活动页面与可选的 `expectedRevision`，再等待页面将整批操作实际应用并确认；页面关闭、工作流被其他人修改、无效节点或端口都会得到错误，而不是“已排队”的伪成功。

工具按页面操作分组：

- 读取与画布：`workflow_get_current`、`workflow_list_node_types`、`workflow_list_resources`、`workflow_get_generated_sources`、`workflow_submit_commands`、`workflow_auto_layout`、`workflow_set_canvas`、`workflow_select`、`workflow_modify_selection`。
- 工作流：`workflow_create`、`workflow_save`、`workflow_open`、`workflow_delete`、`workflow_import`、`workflow_load_example`、`workflow_reset`、`workflow_add_demo`、`workflow_set_project`、`workflow_export_runtime`。
- 顶点与复用：`workflow_set_vertex_transform`、`workflow_upsert_custom_node`、`workflow_delete_custom_node`、`workflow_expand_workflow_node`、`workflow_delete_workflow_node`。

保留 `workflow_apply_action` 仅用于兼容已有 Agent；新 Agent 应优先使用具名工具。命令 payload 中可直接指定节点 `canvasX/canvasY`；自动布局工具可按 LR/TB 方向和间距整理节点。

`workflow_submit_commands` 覆盖页面的基础画布编辑：`ADD_NODE`、`REMOVE_NODE`、`MOVE_NODE`、`CONNECT`、`DISCONNECT`、`SET_PROPERTY`、`RENAME_NODE`、`SET_OUTPUT`。纹理预览也是 `SET_PROPERTY`，属性名为 `previewDataUrl`，值为 `data:image/...;base64,...`。执行前必须先读取节点目录，使用真实 `typeId`、端口名和唯一节点 ID。

逻辑节点支持 `BOOL`。Agent 应以比较或逻辑节点的 `value` 连接到 `logic.if.condition`。从 If 分支对外带值时，创建 `logic.variable`，设置 `valueType`，将分支内计算结果连接至变量的 `value` 输入；变量节点可放在分区外，只从其输出端连接到分支外。编辑器会根据 `value` 输入来源所在的 TRUE/FALSE 分区自动推断归属，不保存也不要求 `ifId`、`branchIfId` 或 `branch`。导出时变量会在 `if` 前声明，并在对应分支赋值。

`workflow_apply_action` 仍覆盖其余编辑器行为：

- 工作流：`NEW_WORKFLOW`、`RESET_CURRENT_DRAFT`、`SAVE_WORKFLOW`、`OPEN_WORKFLOW`、`DELETE_WORKFLOW`、`IMPORT_WORKFLOW_DATA`、`LOAD_MING_GOD_EXAMPLE`、`EXPORT_RUNTIME`。
- 项目与顶点：`SET_PROJECT_CONFIG`、`SET_VERTEX_TRANSFORM`、`SET_VIEW`。
- 选择与批量操作：`SET_SELECTION`、`DELETE_SELECTED`、`DISCONNECT_SELECTED`、`TOGGLE_SELECTED_PREVIEW`、`SAVE_SELECTION_AS_WORKFLOW_NODE`。
- 可复用与自定义节点：`EXPAND_WORKFLOW_NODE`、`DELETE_WORKFLOW_NODE`、`UPSERT_CUSTOM_NODE`、`DELETE_CUSTOM_NODE`。
- 其他页面按钮：`ADD_DEMO`。

`IMPORT_WORKFLOW_DATA` 的 `payload.workflow` 是完整工作流 JSON，而不是文件路径。`EXPORT_RUNTIME` 会像页面按钮一样下载三个文件，同时通过 `workflow_get_generated_sources` 返回最近一次导出的源码。桥接不提供任意文件、Shell 或网络操作。

可按宿主的 MCP 配置格式注册：

```json
{
  "mcpServers": {
    "workflow-shader": {
      "command": "node",
      "args": ["D:/Starsector/mods/MengGod's legacy/ai-gateway/mcp-server.mjs"]
    }
  }
}
```

## 生产化后续

将当前浏览器传入的 `graph/catalog` 替换为本地 GraphApplicationService 的只读快照；为每个 draft 附加 `projectId`、`revision` 与命令模拟结果。应用前若 revision 不一致，应拒绝并要求重新生成草稿。

## 1.2 共享阶段编辑器

workflow_get_summary / workflow_get_current 返回 stage（vertex 或 fragment）；graph 与 catalog 对应当前阶段。workflow_set_stage 切换共享画布，随后原有 workflow_submit_commands、选区、视图和 SET_OUTPUT 操作同样适用。顶点输出是 vertex.output，必须连接 position 和 uv。顶点图使用与片段一致的 nodes / links / outputNodeId 格式，旧 op 图可迁移。导出始终包含两个阶段；顶点纹理预览数据同样默认从摘要排除。

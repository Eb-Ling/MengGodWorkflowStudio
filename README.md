# MengGod Workflow Studio

面向《远行星号》Combat shader 的可视化 GLSL 工作流编辑器。用户通过节点图构建片段着色器和顶点变换，导出后得到可直接放入 Mod 的 Java `CombatLayeredRenderingPlugin`、顶点着色器和片段着色器。

导出的 Java 代码采用 MengGod 当前 BoxUtil 渲染路径：`ShaderProgram`、`BUtilGlobalData` UBO、`ShaderCore` 默认四边形、`TransformUtil` 模型矩阵和可重复调用的 GPU 资源清理。

## 功能

- 方形节点画布、贝塞尔连线、框选、拖拽、右键操作、工作流保存与导入。
- GLSL 数学、向量、纹理、噪声、SDF、布尔、If、For、变量与顶点变换节点。
- 自定义 GLSL 节点支持 `in`、`out`、`inout` 参数。
- 节点离屏 GPU 预览；时间节点可仅为预览动画。
- 每个工作流可设置 `64-4096` 的预览画布宽高；GPU 预览按该分辨率渲染，并在方形节点内保持比例。
- 纹理入口在预览中保持比例，运行时在 Java 构造器接收 `SpriteAPI`。
- 导出前校验工作流端口、类型、分支边界、保留 uniform、Java 标识符和可映射的 public uniform 类型。
- 本地 MCP 桥接：Agent 可以读取和操作当前页面的未保存草稿。

## 目录

```text
frontend/          浏览器编辑器
ai-gateway/        本地页面服务与 stdio MCP Server
docs/              AI 工作流 JSON 格式
src/workflowshader/ Java 领域模型与后续原生运行时架构
build/             导出回归测试
```

## 启动

需要 Node.js 18 或更新版本。

```powershell
Set-Location ai-gateway
npm run start
```

然后打开 <http://127.0.0.1:4174/>。服务只监听本机回环地址，并同时提供编辑器与页面桥接。

## 导出产物

点击“导出运行文件”会生成：

- `YourPlugin.java`
- `YourPlugin.vert`
- `YourPlugin.frag`

把 Java 文件放入 Mod 源码的包路径，把两个 shader 放到项目中设置的 shader 目录。调用方创建 Plugin 时传入四个矩形顶点、`CombatEngineLayers`，以及工作流声明的 public uniform 和纹理 `SpriteAPI` 参数。生成物依赖 Starsector API 与 BoxUtil。

## MCP

源码/浏览器版先启动页面桥接：

```powershell
Set-Location ai-gateway
npm run mcp
```

再为 MCP 客户端配置以下 STDIO 服务，并把 `args` 中的占位路径替换为本机真实路径：

```json
{
  "mcpServers": {
    "workflow-shader": {
      "command": "node",
      "args": ["/absolute/path/to/MengGodWorkflowStudio/ai-gateway/mcp-server.mjs"],
      "env": {
        "WORKFLOW_BRIDGE_URL": "http://127.0.0.1:4174"
      }
    }
  }
}
```

完整 JSON 工作流格式和 Agent 提示见 [docs/AI_WORKFLOW_FORMAT.md](docs/AI_WORKFLOW_FORMAT.md)。

桌面 EXE 会自动启动页面桥接，默认使用 `http://127.0.0.1:4174`，端口被占用时自动选择空闲端口。打开“工作流 → 显示 MCP 配置与接入提示”可获得当前实际端口和无需 Node.js 的 Electron 配置。MCP 的 stdio 进程由 Codex、Claude Desktop 等客户端按需启动，不会作为 EXE 的常驻子进程。桥接只操作用户明确激活的编辑器页面未保存草稿：页面加载或后台同步不会激活；在目标页面点击画布或“激活当前草稿”即可激活，其他新开页面无法覆盖该草稿。

在 EXE 内点击“工作流 → 运行 MCP 自检”可验证该 EXE 能启动 stdio MCP 并返回 `workflow_*` 工具列表。自检通过不等于 Codex 已加载配置：用户仍需在 Codex 新建会话，并确认能看到 `workflow_get_status`。正常 Agent 工作顺序为 `workflow_get_status`、`workflow_get_summary`、按需读取节点目录、携带 `expectedRevision` 写入、再次读取摘要验证。常规读取不会传输纹理预览 Base64 或生成源码。

## 验证

在仓库根目录运行：

```powershell
node --check frontend/app.js
& .\build\verify-workflow-export.ps1
```

回归测试通过本地桥接实际导出纯色、public uniform、单/双纹理、Tint、自定义 `out/inout`、If、For，以及非法输入拒绝案例。

## 状态

当前版本为可运行的 MVP。浏览器编辑器是主实现；`src/workflowshader` 保留了与编辑器数据模型对应的 Java 架构，为后续原生服务、实时渲染和更深的游戏内集成准备。

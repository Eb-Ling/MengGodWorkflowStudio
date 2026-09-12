# AI 工作流文件格式

AI 不需要直接操作编辑器，也不需要 MCP。只要根据本文档输出一个 UTF-8 JSON 文件，用户在编辑器点击“导入工作流”即可。

页面内也提供可选的 MCP 桥接设置：打开“工作流”窗口，填写桥接端口并点击“检测桥接”，随后可点击“显示 MCP 配置与接入提示”。浏览器/源码版需要用户启动桥接服务；桌面 EXE 会自动启动页面桥接，并在提示中给出当前真实端口与无需 Node.js 的 Electron 配置。stdio MCP 服务始终由 MCP 客户端按需启动。

MCP 读取和编辑的是用户明确激活的编辑器草稿，不要求先保存。页面加载和后台同步不会自动激活；用户必须在目标页面点击画布或“工作流 -> 激活当前草稿”，新开的观察页面不会覆盖它。Agent 应依次调用 `workflow_get_status`、`workflow_get_summary`，按需读取节点目录，携带 `expectedRevision` 提交修改，再读取摘要验证。正常摘要会排除纹理预览 Base64、生成源码和完整资源库；`workflow_get_current` 仅用于明确需要完整诊断时。服务同时提供 `workflow_*` 工具和 `workflow://active/summary` 只读资源。客户端未显示工具时，应重新加载 MCP 会话，而不是用 shell 手工发送 JSON-RPC。除非用户明确要求，不得调用打开、创建、导入或重置工作流的操作。完整清单见 `ai-gateway/README.md`。

## 布尔与分支

端口类型支持 `BOOL`、`FLOAT`、`VEC2`、`VEC3`、`VEC4`。使用 `logic.equal`、`logic.notEqual`、`logic.greater`、`logic.greaterEqual`、`logic.less`、`logic.lessEqual`、`logic.and`、`logic.or`、`logic.not` 生成 `BOOL`，并连接到 `logic.if` 的 `condition`。

`logic.if` 的 TRUE/FALSE 框是布局分区。若要从分支带出数值，使用 `logic.variable`：`init` 是分支前初始化输入，可连接其他节点，未连接时使用 `initialValue`（默认 `0.0`）；`value` 是分支内修改输入。变量可以作为分支出口放在框外，并自动继承 `value` 输入来源的分支；变量输出可在分区外使用。变量的 `valueType` 可为五种数据类型；不保存也不要求 `ifId`、`branchIfId` 或 `branch`。生成 GLSL 会按依赖顺序生成初始化、`if/else` 内赋值和分支外消费者。不要把分区内的普通计算节点直接跨区连到分区外。

## 最小结构

```json
{
  "schemaVersion": 1,
  "project": {
    "id": "energy_cloud",
    "title": "Energy Cloud",
    "className": "EnergyCloudPlugin",
    "shaderDir": "data/shaders/generated",
    "previewWidth": 1024,
    "previewHeight": 1024
  },
  "graph": {
    "schemaVersion": 1,
    "revision": 0,
    "outputNodeId": "output_1",
    "nodes": [],
    "links": []
  },
  "vertexTransform": {
    "vertices": [[-180,-90],[180,-90],[-180,90],[180,90]],
    "tx": 0,
    "ty": 0,
    "sx": 1,
    "sy": 1,
    "rotation": 0
  }
}
```

## 节点格式

```json
{
  "id": "unique_node_id",
  "typeId": "input.uv",
  "title": "UV",
  "canvasX": 120,
  "canvasY": 180,
  "properties": { "previewEnabled": true }
}
```

`id` 在文件内必须唯一；`typeId` 必须是编辑器节点目录中的稳定 ID；`canvasX/canvasY` 必须是数字。标题只用于显示，不参与编译。

## 连线格式

```json
{
  "fromNode": "uv_1",
  "fromSocket": "uv",
  "toNode": "center_1",
  "toSocket": "uv"
}
```

只能连接真实节点和端口，输入端口最多一条连线。完整片段工作流应让最终 `VEC4` 节点连接到 `io.output.color`，并设置 `graph.outputNodeId`。

## 给 AI 的提示词

```text
请根据 docs/AI_WORKFLOW_FORMAT.md 生成一个 UTF-8、严格 JSON 工作流文件。
只使用我提供的节点 typeId、端口名和属性格式；不要输出 Markdown、注释或解释文字。
节点 id 必须唯一，所有 fromNode/toNode 必须存在，连线端口必须存在且类型兼容。
不要使用示例专用节点名；标题可以是中文，但编译依赖 typeId 和连线。
最后将片段颜色以 VEC4 连接到 io.output.color，并设置 outputNodeId。
需求：<在这里填写效果>
```

编辑器导入时会检查 schemaVersion、项目配置、节点 ID、节点类型、坐标以及连线引用；失败只显示错误，不会覆盖当前工作流。导入成功后会作为新的已保存工作流写入本地工作流库。

## 排版建议

为了让 AI 生成的画布更易读，按数据流从左到右排版：输入节点放在 `canvasX=80` 附近，每个逻辑阶段增加约 `240~300`，同一阶段的节点使用不同 `canvasY`（建议间隔 `110~150`）。节点坐标只是编辑器布局，不影响 GLSL 结果；也可以通过 MCP 的 `workflow_auto_layout` 自动整理。

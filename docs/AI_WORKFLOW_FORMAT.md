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

## 1.2.0：共享阶段图和实例参数

- graph 保存片段图；vertexTransform.graph 保存顶点图。两者均为 {nodes, links, outputNodeId, revision}，节点共用 id/typeId/title/canvasX/canvasY/properties，连线共用 fromNode/fromSocket/toNode/toSocket。
- 顶点入口 input.position 的 value 为 VEC2；input.uv 的 uv 为 VEC2。出口 vertex.output 具有 position、uv 两个 VEC2 输入，必须全部连接。片段图使用 io.output 的 color 输入，阶段专用节点不能放入另一阶段。
- 数学、向量、纹理、噪声、控制流、io.input 和自定义 GLSL 节点共用。io.input.properties.scope 为 shared 或 instance；valueType 支持 BOOL/INT/UINT/FLOAT/VEC2/VEC3/VEC4 的运行时参数。可在任意阶段声明，同名参数必须类型和作用域一致，导出只生成一个 setter / ABI 槽位。
- vertexTransform 保留 vertices、tx、ty、sx、sy、rotation；零缩放有效。省略 graph 使用直通顶点图。旧 {nodes:[{op,inputs,...}],output} 图仍能导入，自动迁移后保存为通用图；旧 parameter 通过片段图中同名 io.input 解析类型与作用域。
- workflow_get_summary / workflow_get_current 的 stage 标明当前阶段，graph 是当前正在编辑的图。workflow_set_stage({stage:"vertex"}) 切换后，普通节点命令、选区、视图、SET_OUTPUT 等均操作顶点图；节点目录随阶段过滤。
- workflow_set_vertex_transform 支持提交完整通用顶点图。workflow_export_runtime 在任意阶段导出整项目：Java、两个 GLSL、共用运行时、参数布局及使用说明，界面下载单个 ZIP。
- 几何预览使用两张图的 WebGL2 编译结果。实例属性在顶点读取 SSBO，经 flat 接口按需传到片段；片段不使用 gl_InstanceID。

## 1.3.0：节点参数驱动构造接口

io.input 和 input.texture 可设置 properties.parameterId；此值就是节点卡片与检查器显示的参数 ID，以及导出的 Java 字段名、构造形参名和 set_<ID> 名称。它不改变节点内部 id、连线引用或 properties.uniform。旧图缺少该属性时，以 uniform 去掉 u_ 为默认值；新建节点会自动分配独立 ID。

parameterId 必须为有效的非保留 Java 标识符。同 uniform 的重复引用必须 ID、类型、作用域全部一致；不同 uniform 不可使用同一个 parameterId。instance 作用域的 transform 保留给变换配置。

导出 Plugin(layer, SharedParameters shared, InstanceParameters... instances)。没有共享输入或纹理时省略 SharedParameters。每个实例配置构造函数要求 Transform 加全部 instance 输入，共享配置要求全部 shared 输入与纹理；顺序与 parameter-layout.json 的 construction 字段一致。配置字段按节点自动拓展，类型与节点一致，不使用无类型 Map 或字符串参数包。

Transform(x,y) 默认角度 0、缩放 1；完整形式为 Transform(x,y,angle,scaleX,scaleY)。传入几份实例配置就创建几个实例，构造器内部完成参数上传前的 CPU 初始化，不创建额外默认实例。所有输入必填，省略字段会产生 Java 编译错误；预览默认值不会替代调用参数。原 1.2 的构造函数不再生成。

参数布局 version 升为 2，parameters 记录 id 与 name（GLSL uniform），textures 记录纹理参数 ID，construction 记录两类配置的形参顺序。Java 类同时提供 instance(index) 与按参数 ID 命名的 setter，用于可选的后续更新。

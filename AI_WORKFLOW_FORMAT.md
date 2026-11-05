# AI 工作流文件格式：v1.0

只支持当前 `studio.document` 格式。旧 `graph/vertexTransform` 文件、旧顶点 `op/inputs` DAG、旧节点 ID 和旧自定义 GLSL 表达式协议均不转换。用户在界面选择 UTF-8 JSON 文件导入，校验失败不会替换当前草稿。

## 完整可导入示例

```json
{
  "kind": "studio.document",
  "schemaVersion": 1,
  "documentVersion": "1.0.0",
  "revision": 0,
  "project": {
    "id": "simple_effect",
    "title": "示例特效",
    "className": "SimpleEffect",
    "shaderDir": "data/shaders/generated",
    "runtimePath": "data/method",
    "previewWidth": 512,
    "previewHeight": 512
  },
  "graphs": {
    "vertex": {
      "revision": 0,
      "outputNodeId": "output",
      "nodes": [
        {
          "id": "position",
          "typeId": "input.position",
          "canvasX": 30,
          "canvasY": 40,
          "properties": {
            "previewEnabled": false
          }
        },
        {
          "id": "uv",
          "typeId": "input.uv",
          "canvasX": 30,
          "canvasY": 220,
          "properties": {
            "previewEnabled": false
          }
        },
        {
          "id": "output",
          "typeId": "vertex.output",
          "canvasX": 700,
          "canvasY": 100,
          "properties": {
            "previewEnabled": false
          }
        }
      ],
      "links": [
        {
          "fromNode": "position",
          "fromSocket": "value",
          "toNode": "output",
          "toSocket": "position"
        },
        {
          "fromNode": "uv",
          "fromSocket": "uv",
          "toNode": "output",
          "toSocket": "uv"
        }
      ]
    },
    "fragment": {
      "revision": 0,
      "outputNodeId": "output",
      "nodes": [
        {
          "id": "color",
          "typeId": "io.input",
          "title": "颜色",
          "canvasX": 80,
          "canvasY": 120,
          "properties": {
            "uniform": "u_color",
            "parameterId": "color",
            "valueType": "VEC4",
            "scope": "shared",
            "defaultValue": "1,0.3,0.1,1",
            "previewEnabled": true
          }
        },
        {
          "id": "output",
          "typeId": "io.output",
          "title": "片段输出",
          "canvasX": 400,
          "canvasY": 120,
          "properties": {}
        }
      ],
      "links": [
        {
          "fromNode": "color",
          "fromSocket": "value",
          "toNode": "output",
          "toSocket": "color"
        }
      ]
    }
  },
  "geometry": {
    "vertices": [
      [
        -180,
        -90
      ],
      [
        180,
        -90
      ],
      [
        -180,
        90
      ],
      [
        180,
        90
      ]
    ],
    "tx": 0,
    "ty": 0,
    "sx": 1,
    "sy": 1,
    "rotation": 0,
    "instanceInputs": {},
    "parameterModes": {}
  },
  "requiredPlugins": {}
}
```

## 文档与节点规则

- 顶层必须包含 kind、schemaVersion、documentVersion、revision、project、graphs、geometry、requiredPlugins，版本分别固定为 studio.document、1、1.0.0。revision 是非负整数。
- graphs.vertex 和 graphs.fragment 都必须存在，各自使用 nodes、links、outputNodeId、revision。节点 id 在所属阶段唯一，canvasX/canvasY 为数字，properties 为对象。
- 只使用当前节点目录提供的 typeId、端口和属性。节点标题用于显示，连线通过节点 id 和端口 name 建立。一个输入最多一条连线。
- 顶点入口 input.position.value、input.uv.uv 为 VEC2，vertex.output.position 和 uv 都要连接。片段结果以 VEC4 接 io.output.color，并指定 outputNodeId。
- 插件节点保存 plugin: {id,version} 和 portSnapshot: {inputs,outputs}。requiredPlugins 必须与两个阶段节点的精确来源一致，同一插件记录不同版本时拒绝导入。正常编辑会自动维护此映射。当前插件缺失或来源、版本、端口不匹配时保留节点与连线，影响输出时阻止编译，并在 dependencyDiagnostics 中报告原因。不会自动改写记录或转换版本。
- 几何与图数据分别位于 geometry 和 graphs，geometry 内不放 graph。示例直接使用当前格式，不依赖加载时迁移。

## Noise 节点

只使用 `studio.noise.value`、`studio.noise.fbm`、`studio.noise.simplex`、`studio.noise.perlin`、`studio.noise.fbmSimplex`、`studio.noise.worley`、`studio.noise.fbmWorley`、`studio.noise.turbulence`、`studio.noise.turbulize`、`studio.noise.turbulence3`。插件 ID 为 studio.noise，版本 1.0.0。noise.* 不再映射。

UV 类输入为 VEC2，turbulize 输入 noise 为 FLOAT，turbulence3 输入 x/y/z 为 FLOAT。具体以实时目录为准。二维 Simplex 是有符号梯度噪声，fbmSimplex 叠加五层，FBM 的 scale 默认 4，允许 -10000 至 10000 的有限数，octaves 属性默认 5。连接 octaves 端口时以连接值为准（包括 0），向下取整并截断至 0–8 层，无连接时使用属性。scale=0 合法。两阶段与双目标共用同一 IR。

## 参数与实例数组

io.input 的 properties 包含 parameterId、uniform、valueType、scope、defaultValue。valueType 可为 BOOL/INT/UINT/FLOAT/VEC2/VEC3/VEC4，scope 为 shared 或 instance。自动推导使用显式 AUTO。同一 uniform 在两阶段的参数 ID、类型与作用域必须一致，不同 uniform 不能占用同一参数 ID。

导出提供两种构造器：单点以 CombatEngineLayers layer、Vector2f position 开头，批量以 CombatEngineLayers layer、List<Vector2f> positions 开头，每个向量创建一个实例。之后依次传几何参数、节点参数和纹理。单点入口的所有参数传单值，批量入口的 shared 传单值、instance 传同类型数组，长度须等于 positions.size()。纹理传单个 SpriteAPI。位置更新使用 instance(i).setPosition(Vector2f)。

geometry.instanceInputs 的每项为 {enabled,id}，支持 tx、ty、sx、sy、rotation、v0x/v0y 至 v3x/v3y，开启后批量构造器生成具名 float[]、单点构造器生成 float，关闭使用面板固定值。geometry.parameterModes 按 uniform 名覆盖 shared/instance。旋转单位为度，零缩放合法。

project.runtimePath 是共享依赖源码包路径，如 data/method。首次导出先下载该包路径的单个 WorkflowRuntime.java，每个特效另导出一个 Java 和两个 shader。下载记录不代表已安装到 Mod。完整构造器与 init 示例在工作流配置中显示，输入数组在构造时复制，后续用 instance(i) 与具名 setter 更新，markExpired() 结束批次。

## 控制流与自定义 GLSL

比较/逻辑节点输出 BOOL，连接 logic.if.condition。分支结果通过 logic.variable.value 带出，init 在分支前初始化。分支归属从画布区域与连线推导，不填写 ifId/branchIfId/branch。

自定义节点只使用 properties.parameters 与 code，parameters 项包含 id/name/type/qualifier，qualifier 为 in/out/inout。out/inout 必须在函数体赋值，允许明确的 helperSource。必须提供 properties.sourceTargets 数组，选择 glsl-es-300（预览）与/或 glsl-430（导出），不支持某个目标时明确报错。通过主编辑器“创建自定义 GLSL 节点”或公开 workflow_upsert_custom_node 提供定义，旧 expression 协议拒绝。

## MCP 与调用顺序

MCP 是内置插件，共 41 个具名工具，stdio 入口为 plugins/mcp/stdio.mjs。插件设置中的 MCP 面板给出真实端口和桌面配置，停用不影响普通编辑。workflow_edit 自动补齐节点默认值/可读 ID 并原子提交常见图编辑，workflow_set_node_property 使用检查器校验，workflow_inspect 返回字段说明。workflow_get_export_configuration 可读取几何字段与依赖路径、试算参数修改，不提交文档，需要当前草稿守卫。旧 ai-gateway/mcp-server.mjs 和 workflow_apply_action 已删除。

先 workflow_get_status，再 workflow_get_summary，按需读取节点目录。修改携带同一摘要中的 documentId=project.id、documentToken、stage、expectedRevision=graph.revision。跨阶段 workflow_document_transaction 还需 expectedDocumentRevision，commands 每项指定 stage。修改后重读验证，保存/下载等 IO 不放入图事务。

MCP 操作用户激活的草稿。除非用户明确要求，不调用创建、打开、导入或重置。没有可用活动页面时让用户激活目标页，不开隐藏页面代替。普通读取不要索取纹理 Base64 或生成源码。

## 给 AI 的提示词

```text
根据当前 v1.0 文档格式生成一个严格 UTF-8 JSON 文件。
只用提供的当前节点目录，包含 graphs.vertex 和 graphs.fragment，不要转换旧格式。
节点 ID 和端口必须真实且唯一，连线类型一致，两阶段都连接正确的输出。
参数 ID 使用有效 Java 标识符，跨阶段声明一致。
只输出 JSON，不输出 Markdown、解释或注释。
需求：<填写效果>
```

## Math 与 SDF 的当前 ID

节点类型使用 studio.math.*、studio.math.vector.*、studio.sdf.*、studio.sdf.shape.* 和 studio.sdf.curve.*，例如 studio.math.add、studio.math.vector.combine、studio.sdf.box。通过当前 catalog 获取节点定义，不推测 ID。插件动态端口随 valueType 解析，文档 portSnapshot 保存实际解析后的端口，以支持插件停用后保留连线。

高清预览：workflow_render_preview 默认返回 text 元数据和标准 MCP image/png，AI 可直接读图。longEdge 为 64—4096，按当前画布宽高比重新渲染，与 width/height 互斥，不改变项目尺寸。显式 format:data 返回含 dataUrl 的 JSON，供逐像素分析。workflow_open_preview 打开编辑器视框，默认长边 2048。两工具均需四项守卫，常规快照不含图片，超大结果会要求降低尺寸。

首次导出调用 workflow_export_runtime_dependency，可指定 runtimePath，例如 data/method，返回公共依赖原始源码并记录路径。随后 workflow_export_runtime 返回 java/vertex/fragment 三个文件，等待统一保存成功，不触发浏览器下载。取得依赖源码不代表已安装到游戏。

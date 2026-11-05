# Workflow Studio API 手册

本手册有三个入口：在 Studio 中扩展节点或面板，使用 MCP 操作用户选定的工作流，以及在游戏中调用导出的 Java 特效。三者的授权和生命周期各自独立。需要了解模块归属时请读[架构手册](ARCHITECTURE_V1.md)。

## 先选择适合的接口

| 想做什么 | 入口 | 结果 |
| --- | --- | --- |
| 贡献顶点或片段节点 | `workflow.nodes.register` | 定义、端口和编译规则一起登记，停用时按所有者回收 |
| 从按钮编辑当前图 | `workflow.editor.addNode/edit/setProperty/inspect` | 自动生成可读 ID 和默认值，修改进入统一历史 |
| 从目录插件添加设置面板 | `studio.extension-ui.create/update/events/remove` | 提交有界 JSON 控件树，从事件游标读取交互 |
| 在受信任的界面内挂载 Vue 组件 | `studio.ui.createScope/addView/addSettingsPanel` | 通过作用域创建、更新和清理视图 |
| 在受信任插件中保存、预览或导出 | `workflow.workspace`、`workflow.preview`、`workflow.export` | 共用编辑器的保存守卫、GPU 与导出规则 |
| 在外部 AI 客户端操作 | MCP `tools/list` 和 `tools/call` | 依用户授予的权限获取摘要、编辑、读取真实图片与原始三文件 |

## 创建一个可登记的节点

在文件夹中放入 `studio-plugin.json` 和 `index.mjs`。下面两个文件构成可工作的最小特效节点。应用内选择「插件 → 插件管理 → 添加本地插件」，审阅后登记。两个阶段都可以使用这个输出 0.5 的节点。

```json
{
  "schemaVersion": 1,
  "id": "example.half",
  "name": "数值 0.5",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "layer": 3,
  "kind": "nodes",
  "entry": "index.mjs",
  "exportName": "plugin",
  "requiredApis": { "workflow.nodes": "^1.0.0" },
  "capabilities": ["nodes.register"]
}
```

```js
import { ir } from '@workflow/plugin-sdk/ir'

export const plugin = {
  activate(context) {
    const typeId = context.pluginId + '.value'
    const targets = ['glsl-es-300', 'glsl-430']
    context.api('workflow.nodes').register({
      nodes: [{
        typeId, title: '数值 0.5', category: '教学',
        inputs: [], outputs: [{name: 'value', type: 'FLOAT'}],
        properties: {}, stages: ['vertex', 'fragment'], targets
      }],
      compilers: targets.map(target => ({
        typeId, target, compile: () => ir.literal('FLOAT', 0.5)
      }))
    })
  }
}
```

`typeId` 以插件 ID 加点号开头。它标识节点类型，画布中每个节点另有可自定义的实例 ID。编译规则接收节点、输出端口和输入类型，返回一种受检 IR 表达式或它的 Promise。输入引用必须是本节点声明的端口，返回类型必须匹配输出。预览与游戏目标共用节点语义。编译器会等待异步规则，停用或替换后会拒绝失效的结果。[完整双阶段节点与面板示例](../build/examples/sdk-effect/index.mjs) · [端口和 IR 契约](../packages/plugin-sdk/ir.mjs)

## 上下文、权限与释放

`context.api(id)` 取得已声明、已获准且兼容的提供者。用 `requiredApis` 声明必需接口，用 `optionalApis` 与 `context.hasApi(id)` 实现可选功能。能力名控制具体方法，声明依赖不等于授予权限。提供者在清单的 `providesApis` 中声明版本、方法、参数与返回契约，再用 `context.provide(id, implementation)` 提供实现。只有符合条件的 JSON 提供者可以声明 `onApi:<id>` 在首次调用时激活。

用 `context.onDispose(fn)` 回收订阅、计时器和外部资源。停用后不得继续使用旧代理，重新加载获得新上下文。[上下文和通用类型](../packages/plugin-sdk/types.ts) · [目录插件声明与管理接口](../packages/plugin-sdk/plugin-management-types.ts)

## 编辑、事务与面板

清单声明 `workflow.editor` 与 `workflow.read`、`workflow.write` 后，可在按钮回调里读取当前快照并提交一次操作：

```js
const editor = context.api('workflow.editor')
const {id} = await editor.addNode({
  typeId: 'io.input',
  properties: {valueType: 'VEC4', defaultValue: '1,0.4,0.2,1'}
})
await editor.setProperty({nodeId: id, key: '$title', value: '效果颜色'})
```

用 `edit({add,remove,connect,disconnect,output}, guard)` 批量编辑，一项失败就回滚整批。依据早先快照进行异步操作时传入该次读取的守卫。精确图命令与跨阶段联合事务使用 `execute`，遇到过期修订时重新读取，不向另一份草稿重放写操作。[编辑请求与参数](../packages/plugin-sdk/workflow-edit.mjs) · [精确命令与动作定义](../packages/plugin-sdk/commands.mjs)

目录插件声明 `studio.extension-ui` 与 `extension.ui` 后可创建面板。例如在激活函数中调用：

```js
const ui = context.api('studio.extension-ui')
const id = context.pluginId + '.settings'
const {revision} = await ui.create({
  id, title: '颜色设置', placement: 'settings',
  tree: {id: 'root', type: 'column', children: [
    {id: 'create', type: 'button', label: '新增颜色参数'}
  ]}
})
```

用 `events({after})` 读取事件和下一游标，匹配面板 ID、修订和控件 ID 后调用编辑方法。`update({id,tree})` 返回新修订。停用时停止轮询。跨所有者查看面板元数据还需 `extension.ui.inspect`，不能读取控件值或触发按钮。[可直接登记的编辑面板](../build/examples/minimal-editor-panel/index.mjs) · [控件树与事件类型](../packages/plugin-sdk/extension-types.ts)

受信任的组件使用 `studio.ui` 的作用域与插槽。目录脚本使用声明式面板，或在批准的独立窗口内绘制。允许的文本读写、HTTPS 来源和固定任务由 `platform.extension` 的能力与清单共同限制，不返回任意本机文件路径。[受限平台接口](../packages/plugin-sdk/extension-platform-types.ts)

## 从图到预览和导出

| 调用 | 输入与行为 | 返回或后续动作 |
| --- | --- | --- |
| `workflow.compilation.lower({document,target,stage})` | 传入文档副本与阶段，节点目录独立于当前编辑会话 | 结构化着色模块，交给 `shader.backend.glsl.emit` |
| `workflow.preview.frame(request)` | 按节点或完整画面、时间与尺寸重新绘制 | PNG 与尺寸，高清视框用 `open/close` |
| `workflow.export.exportDependency({runtimePath,download})` | 例如 `runtimePath: "data/method"`，完成后记录依赖路径 | 公共依赖 `WorkflowRuntime.java` |
| `workflow.export.exportEffect({download:false})` | 等待保存并检查草稿，使用配置的依赖路径 | Java、顶点与片段三个原始文件对象 |
| `studio.plugins.authorized/registerAuthorized` | 只能登记用户在插件中心批准且内容未变化的目录 | 授权与登记独立，内容变化必须重新审阅 |

这些完整工作区能力供获准的受信任插件使用。目录扩展的精确开放范围见文末的方法表。[编译参数类型](../packages/plugin-sdk/pipeline-types.ts) · [工作区与导出类型](../packages/plugin-sdk/workspace-types.ts)

## MCP：列出目标、选择、读取、操作、核对

在 Studio 中按 [README 的配置步骤](../README.md) 取得客户端配置。不要将含接入凭据的配置提交到工作流或仓库。连接后使用下列调用顺序。示例中的 `client` 是已初始化的 stdio MCP 客户端，`target` 是按用户明确指定的名称和类型从本次列表匹配出的唯一目标。

```js
async function call(name, args = {}) {
  const r = await client.request('tools/call', {name, arguments: args})
  if (r.isError) throw Error(r.content[0].text)
  return r
}
async function read(name, args) {
  return JSON.parse((await call(name, args)).content.find(c => c.type === 'text').text)
}
const status = await read('workflow_get_status')
if (!status.editorConnected) throw Error('请先打开已配置的 Studio')
const {workflows} = await read('workflow_list_workflows')
const matches = workflows.filter(w => w.kind === 'saved' && w.title === '冲击波')
if (matches.length !== 1) throw Error('请用户指定唯一目标')
const target = matches[0]
await read('workflow_select_workflow', {kind: target.kind, id: target.id})
const s = await read('workflow_get_summary')
const guard = {documentId: s.project.id, documentToken: s.documentToken,
               stage: s.stage, expectedRevision: s.graph.revision}
const frame = await call('workflow_render_preview', {...guard, longEdge: 2048})
const png = frame.content.find(c => c.type === 'image')
await read('workflow_get_summary')
```

修改用 `workflow_edit` 或具名工具，提供相同目标最新的摘要守卫。预览默认返回标准 PNG 图片块，4096 长边不会修改项目尺寸。保存使用 `workflow_project_file`，没有绑定已授权源文件时保存在工作流库。插件登记使用 `workflow_list_authorized_plugins` 返回的 id 和 authorizationId，不接受任意目录。预览停用影响后按返回的 reviewKey 确认依赖影响。需要重新读取当前结果时，不依赖缓存截图或旧草稿的修订。

## 在 Starsector 中调用

公共 Java 源码按用户选择的包路径存放一次。每个特效的两个着色器保留导出路径，特效 Java 和依赖都编译进 Mod 加载的 JAR。运行时直接实现 `CombatLayeredRenderingPlugin`。下面假设导出类名为 CenterEffect，几何为单点入口且没有额外暴露参数：

```java
CenterEffect effect = new CenterEffect(
    CombatEngineLayers.ABOVE_SHIPS_LAYER,
    new Vector2f(100f, 200f)
);
engine.addLayeredRenderingPlugin(effect);
```

批量中心坐标使用 `List<Vector2f>`。共享参数传单值，逐实例参数传同下标的类型数组，准确顺序以工作流生成的构造器为准。传入的坐标是初始化快照，跟随舰船时更新 `effect.instance(i).setPosition(ship.getLocation())`。效果结束时调用 `markExpired()`，由生命周期清理，无需每帧重新登记。[游戏运行时源码](../plugins/starsector/runtime/WorkflowRuntime.java)

<!-- manifest-reference -->

## 能力和方法索引

下表按实际提供者列出方法。能力名是清单中的权限，插件还须在 requiredApis 或 optionalApis 声明 API 及版本。目录脚本只能调用下文标明的远程方法和专用节点登记入口，其他方法供相应的受信任插件使用。

### workflow.compilation

从文档生成着色模块和预览描述，查询编译身份或缓存状态。

提供者：[compiler/manifest.mjs](../plugins/compiler/manifest.mjs)，版本 `1.0.0`，契约类型 `json`。 [SDK 类型](../packages/plugin-sdk/pipeline-types.ts)

| 能力 | 方法 |
| --- | --- |
| `shaders.compile` | `describe`、`lower`、`preview`、`identity`、`status` |

### studio.declarations

将无脚本插件的面板与有限编辑动作绑定到所属插件。

提供者：[declarations/manifest.mjs](../plugins/declarations/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/declarative-types.ts)

| 能力 | 方法 |
| --- | --- |
| `declarations.mount` | `mount` |

### example.layout.grid

传入 count、columns、spacing，返回示例网格的位置数组。

提供者：[example-layout/manifest.mjs](../plugins/example-layout/manifest.mjs)，版本 `1.0.0`，契约类型 `json`。

| 能力 | 方法 |
| --- | --- |
| `无额外方法权限` | `positions` |

### studio.extension-ui

用面板 ID、位置和 JSON 控件树创建界面。用游标和修订区分当前交互与过期事件。

提供者：[extension-ui/manifest.mjs](../plugins/extension-ui/manifest.mjs)，版本 `1.0.0`，契约类型 `json`。 [SDK 类型](../packages/plugin-sdk/extension-types.ts)

| 能力 | 方法 |
| --- | --- |
| `extension.ui.inspect` | `inspect` |
| `extension.ui` | `create`、`update`、`remove`、`events` |

### shader.backend.glsl

将结构化模块发射为目标 GLSL，返回资源反射、行号映射和诊断。

提供者：[glsl-backend/manifest.mjs](../plugins/glsl-backend/manifest.mjs)，版本 `1.0.0`，契约类型 `json`。 [SDK 类型](../packages/plugin-sdk/pipeline-types.ts)

| 能力 | 方法 |
| --- | --- |
| `shaders.emit` | `emit` |

### workflow.interaction

登记选择、显示顺序或布局策略，返回意图，由编辑器验证并提交。

提供者：[interaction/manifest.mjs](../plugins/interaction/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `interaction.register` | `register` |
| `interaction.read` | `list`、`subscribe` |
| `interaction.configure` | `activate` |
| `interaction.evaluate` | `evaluate` |

### workflow.layout

用节点与连线计算布局，也可通过工作区应用排列。

提供者：[layout/manifest.mjs](../plugins/layout/manifest.mjs)，版本 `1.0.0`，契约类型 `json`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `layout.use` | `plan`、`arrange` |

### studio.mcp-connection

为受信任界面创建接入会话，暴露模型、操作和释放函数。

提供者：[mcp-connection/manifest.mjs](../plugins/mcp-connection/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/workspace-types.ts)

| 能力 | 方法 |
| --- | --- |
| `mcp.connect` | `createSession` |

### workflow.graph-snapshot

接收文档副本，解析动态端口和插件规则，不查询当前草稿。

提供者：[node-model/manifest.mjs](../plugins/node-model/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/pipeline-types.ts)

| 能力 | 方法 |
| --- | --- |
| `graph.snapshot` | `identity`、`describe`、`prepare` |

### workflow.node-catalog

读取定义副本并订阅目录变化，自定义定义写入由编辑能力负责。

提供者：[node-model/manifest.mjs](../plugins/node-model/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `nodes.read` | `list`、`subscribe`、`customNodes` |
| `nodes.configure` | `setCustom`、`removeCustom` |

### workflow.nodes

按类型 ID 查找定义，原子登记同一插件的节点与目标编译规则。

提供者：[node-model/manifest.mjs](../plugins/node-model/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `nodes.read` | `list`、`get` |
| `nodes.register` | `register` |

### platform.extension

使用经批准的插件范围文本、网络来源和任务。

提供者：[plugin-service/manifest.mjs](../plugins/plugin-service/manifest.mjs)，版本 `1.0.0`，契约类型 `json`。 [SDK 类型](../packages/plugin-sdk/extension-platform-types.ts)

| 能力 | 方法 |
| --- | --- |
| `extension.files` | `readText`、`writeText` |
| `extension.network` | `fetchText` |
| `extension.tasks` | `runTask` |

### studio.plugins

查看登记状态、批准的目录和停用影响，并按当前授权管理插件。

提供者：[plugin-service/manifest.mjs](../plugins/plugin-service/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/plugin-management-types.ts)

| 能力 | 方法 |
| --- | --- |
| `plugins.manage` | `snapshot`、`authorized`、`authorize`、`registerAuthorized`、`revokeAuthorization`、`previewDisable`、`openDirectory`、`openWindow`、`subscribe`、`choose`、`inspect`、`install`、`reload`、`setEnabled`、`remove`、`downloadKit` |

### workflow.preview

按节点、时间和尺寸获取图片，或在受信任界面挂载画布。

提供者：[preview/manifest.mjs](../plugins/preview/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `preview.render` | `mount`、`frame`、`open`、`close`、`status`、`compilationStatus` |

### workflow.file-selection

从文件选择得到的 File 打开工作流，重新核对目标草稿。

提供者：[project-files/manifest.mjs](../plugins/project-files/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/workspace-types.ts)

| 能力 | 方法 |
| --- | --- |
| `project.files` | `openFile` |

### workflow.project-files

保存库或已绑定源文件，用 fileId、备份记录和冲突版本管理读取与恢复。

提供者：[project-files/manifest.mjs](../plugins/project-files/manifest.mjs)，版本 `1.0.0`，契约类型 `json`。 [SDK 类型](../packages/plugin-sdk/project-file-types.ts)

| 能力 | 方法 |
| --- | --- |
| `project.files` | `status`、`open`、`openSaved`、`save`、`saveAs`、`reload`、`recover`、`backup` |

### studio.shortcuts

登记命令的默认键位，读取用户配置并按作用域解析按键。

提供者：[shortcuts/manifest.mjs](../plugins/shortcuts/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/shortcut-types.ts)

| 能力 | 方法 |
| --- | --- |
| `shortcuts.register` | `register` |
| `shortcuts.read` | `list`、`subscribe` |
| `shortcuts.resolve` | `resolve` |
| `shortcuts.configure` | `configure`、`reset` |

### workflow.export

检查导出条件、试算参数、生成公共依赖或三文件特效。

提供者：[starsector/manifest.mjs](../plugins/starsector/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/workspace-types.ts)

| 能力 | 方法 |
| --- | --- |
| `export.read` | `configuration`、`guide`、`dependency`、`history`、`prepareDependency`、`sources`、`readiness`、`subscribe` |
| `export.write` | `exportDependency`、`exportEffect` |

### workflow.templates

保存和展开可复用子图，查询内置示例。

提供者：[templates/manifest.mjs](../plugins/templates/manifest.mjs)，版本 `1.0.0`，契约类型 `json`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `templates.use` | `list`、`save`、`remove`、`expand`、`example` |

### studio.ui

创建组件作用域，将视图、渲染器或面板挂载到指定插槽。

提供者：[ui/manifest.mjs](../plugins/ui/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `ui.panels` | `createScope`、`addSettingsPanel`、`addOverlay`、`addView`、`addDock` |
| `ui.renderers` | `addRenderer` |

公开值：`components`。

### workflow.editor

读取双阶段快照、检查器和修订，按事务提交编辑并订阅变化。

提供者：[workflow-service/manifest.mjs](../plugins/workflow-service/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `workflow.read` | `snapshot`、`inspect`、`subscribe`、`onActivity`、`activity` |
| `workflow.write` | `execute`、`edit`、`addNode`、`setProperty` |
| `ui.status` | `report` |

### workflow.library

为受信任的存储能力提供工作流库读取、保存与备份。

提供者：[workflow-service/manifest.mjs](../plugins/workflow-service/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `project.storage` | `read`、`save`、`backup` |

### workflow.presentation

取得检查器与参数的展示数据，将界面输入转为待提交的编辑意图。

提供者：[workflow-service/manifest.mjs](../plugins/workflow-service/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/types.ts)

| 能力 | 方法 |
| --- | --- |
| `presentation.read` | `snapshot`、`edit` |
| `ui.status` | `report` |
| `workflow.read` | `activity` |

### workflow.workspace

从一个入口执行编辑、保存、模板、布局与导出，并读取就绪状态。

提供者：[workspace/manifest.mjs](../plugins/workspace/manifest.mjs)，版本 `1.0.0`，契约类型 `local`。 [SDK 类型](../packages/plugin-sdk/workspace-types.ts)

| 能力 | 方法 |
| --- | --- |
| `workflow.read` | `snapshot`、`subscribe`、`onActivity`、`inspect`、`activity`、`preferences` |
| `workflow.write` | `execute`、`edit`、`addNode`、`setProperty` |
| `ui.status` | `report` |

## 目录脚本可调用的方法

| API | 方法与所需权限 |
| --- | --- |
| `platform.extension` | `readText` → `extension.files`，`writeText` → `extension.files`，`fetchText` → `extension.network`，`runTask` → `extension.tasks` |
| `workflow.editor` | `snapshot` → `workflow.read`，`inspect` → `workflow.read`，`execute` → `workflow.write`，`edit` → `workflow.write`，`addNode` → `workflow.write`，`setProperty` → `workflow.write` |
| `workflow.workspace` | `snapshot` → `workflow.read`，`inspect` → `workflow.read`，`execute` → `workflow.write`，`edit` → `workflow.write`，`addNode` → `workflow.write`，`setProperty` → `workflow.write` |
| `workflow.nodes` | `list` → `nodes.read`，`get` → `nodes.read` |
| `studio.extension-ui` | `inspect` → `extension.ui.inspect`，`create` → `extension.ui`，`update` → `extension.ui`，`remove` → `extension.ui`，`events` → `extension.ui` |

专用的 `workflow.nodes.register` 批量登记节点和规则，需要 `nodes.register`。第三方 JSON API 按提供者的声明、参数契约和授权调用。

## MCP 工具索引

通过客户端的 tools/list 可获取完整 JSON Schema。下表的 ? 表示可选业务参数。标有“需要”的工具还须提供同一份摘要的 documentId、documentToken、stage、expectedRevision 四项守卫。跨阶段事务另需 expectedDocumentRevision。

| 工具 | 业务参数 | 草稿守卫 |
| --- | --- | --- |
| `workflow_list_authorized_plugins` | 无 | 需要 |
| `workflow_register_authorized_plugin` | `id`、`authorizationId` | 需要 |
| `workflow_remove_plugin` | `id`、`reviewKey?` | 需要 |
| `workflow_get_plugin_panels` | `id` | 需要 |
| `workflow_get_plugin_status` | 无 | 需要 |
| `workflow_preview_plugin_disable` | `id` | 需要 |
| `workflow_set_plugin_enabled` | `id`、`enabled`、`reviewKey?` | 需要 |
| `workflow_reload_plugin` | `id` | 需要 |
| `workflow_list_workflows` | 无 | 不需要 |
| `workflow_select_workflow` | `kind`、`id` | 不需要 |
| `workflow_edit` | `add?`、`remove?`、`connect?`、`disconnect?`、`output?` | 需要 |
| `workflow_set_node_property` | `nodeId`、`key`、`value` | 需要 |
| `workflow_inspect` | 无 | 需要 |
| `workflow_get_export_configuration` | `runtimePath?`、`geometry?`、`edit?` | 需要 |
| `workflow_project_file` | `operation`、`fileId?`、`id?`、`recoveryId?`、`conflictVersion?`、`expectedDocumentRevision` | 需要 |
| `workflow_get_preview_status` | 无 | 需要 |
| `workflow_get_compilation_status` | 无 | 需要 |
| `workflow_close_preview` | 无 | 需要 |
| `workflow_open_preview` | `nodeId?`、`socket?`、`longEdge?`、`time?` | 需要 |
| `workflow_render_preview` | `nodeId?`、`socket?`、`width?`、`height?`、`longEdge?`、`format?`、`time?` | 需要 |
| `workflow_get_status` | 无 | 不需要 |
| `workflow_get_summary` | 无 | 不需要 |
| `workflow_get_current` | `includePreviewAssets?`、`includeGeneratedSources?` | 不需要 |
| `workflow_agent_instructions` | 无 | 不需要 |
| `workflow_list_node_types` | 无 | 不需要 |
| `workflow_list_resources` | 无 | 不需要 |
| `workflow_get_generated_sources` | 无 | 不需要 |
| `workflow_submit_commands` | `commands` | 需要 |
| `workflow_auto_layout` | `direction?`、`gapX?`、`gapY?`、`startX?`、`startY?` | 需要 |
| `workflow_create` | `blendMode?`、`id?`、`title?`、`className?`、`shaderDir?`、`previewWidth?`、`previewHeight?` | 需要 |
| `workflow_save` | 无 | 需要 |
| `workflow_open` | `id` | 需要 |
| `workflow_delete` | `id` | 需要 |
| `workflow_import` | `workflow` | 需要 |
| `workflow_load_example` | 无 | 需要 |
| `workflow_reset` | 无 | 需要 |
| `workflow_add_demo` | 无 | 需要 |
| `workflow_set_project` | `blendMode?`、`id?`、`title?`、`className?`、`shaderDir?`、`previewWidth?`、`previewHeight?` | 需要 |
| `workflow_set_stage` | `targetStage` | 需要 |
| `workflow_set_vertex_transform` | `vertices?`、`tx?`、`ty?`、`sx?`、`sy?`、`rotation?`、`instanceInputs?`、`parameterModes?`、`graph?` | 需要 |
| `workflow_set_canvas` | `x?`、`y?`、`zoom?` | 需要 |
| `workflow_select` | `nodeIds` | 需要 |
| `workflow_modify_selection` | `operation`、`enabled?`、`title?` | 需要 |
| `workflow_upsert_custom_node` | `definition` | 需要 |
| `workflow_delete_custom_node` | `typeId` | 需要 |
| `workflow_expand_workflow_node` | `workflowNodeId`、`canvasX?`、`canvasY?` | 需要 |
| `workflow_delete_workflow_node` | `id` | 需要 |
| `workflow_export_runtime_dependency` | `runtimePath?` | 需要 |
| `workflow_export_runtime` | 无 | 需要 |
| `workflow_document_transaction` | `expectedDocumentRevision`、`transaction` | 需要 |
| `workflow_undo` | 无 | 需要 |
| `workflow_redo` | 无 | 需要 |

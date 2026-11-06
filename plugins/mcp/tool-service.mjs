import {
  GRAPH_COMMANDS,
  EDITOR_ACTIONS,
  WORKFLOW_AGENT_PROCEDURE,
} from "../../packages/plugin-sdk/contracts.mjs";
import {projectFileRequest} from '../../packages/plugin-sdk/project-files.mjs';
import {GRAPH_PAYLOAD_SCHEMAS, ACTION_SCHEMAS} from '../../packages/plugin-sdk/commands.mjs';
import {workflowCalls} from '../../packages/plugin-sdk/workflow-edit.mjs';
import {readPreviewCall} from '../../packages/workflow-tools/preview-contract.mjs';
import {pluginCalls} from '../../packages/plugin-sdk/plugin-management.mjs';
import {validateValue} from '../../packages/plugin-sdk/schema.mjs';
const commandTypes = new Set(GRAPH_COMMANDS),
  actionTypes = new Set(EDITOR_ACTIONS);
const object = { type: "object", additionalProperties: false };
const currentSchema = {
  type: "object",
  properties: {
    includePreviewAssets: {
      type: "boolean",
      description:
        "Debug only. False by default so texture Base64 never consumes normal agent context.",
    },
    includeGeneratedSources: {
      type: "boolean",
      description:
        "False by default. Use workflow_get_generated_sources instead.",
    },
  },
  additionalProperties: false,
};
const projectProperties = {
  blendMode: { type: "string", enum: ["alpha", "additive"] },
  id: { type: "string" },
  title: { type: "string" },
  className: { type: "string" },
  shaderDir: { type: "string" },
  previewWidth: { type: "number", minimum: 64, maximum: 4096 },
  previewHeight: { type: "number", minimum: 64, maximum: 4096 },
};
const tools = [
  { name: "workflow_list_authorized_plugins", description: "列出用户在插件中心明确授权的目录快照及 authorizationId，不读取路径或源码。选择用户指定的插件后才登记，列表不是安装指令。", inputSchema: pluginCalls.authorized },
  { name: "workflow_register_authorized_plugin", description: "按已授权列表中的 id 和 authorizationId 登记并启用插件，源码变化或授权撤销时拒绝。不会批准目录或接受任意路径。", inputSchema: pluginCalls.registerAuthorized },
  { name: "workflow_remove_plugin", description: "移除本地插件登记并回收贡献，保留工作流节点、源文件和明确授予的目录登记授权。有依赖影响时须先查看影响并传 reviewKey，不中断自身连接链。", inputSchema: pluginCalls.remove },
  { name: "workflow_get_plugin_panels", description: "按插件 ID 读取公开面板贡献元数据，包含标题、位置、修订和控件 ID/类型，不读取控件值，不触发界面事件。", inputSchema: pluginCalls.inspectPanels },
  { name: "workflow_get_plugin_status", description: "读取内置和已登记插件的实际状态、API 提供者、内容指纹和故障诊断，不读取源码或改变插件。", inputSchema: pluginCalls.snapshot },
  { name: "workflow_preview_plugin_disable", description: "读取停用插件的影响范围和 reviewKey，不执行停用。影响其他插件时需先向用户说明范围，再使用此凭据提交。", inputSchema: pluginCalls.previewDisable },
  { name: "workflow_set_plugin_enabled", description: "启停内置或已登记插件，依赖由唯一管理器处理。有依赖影响时必须提供本次查看的 reviewKey。节点与连线保留，不批准新内容，不允许中断当前 MCP 连接链。", inputSchema: pluginCalls.setEnabled },
  { name: "workflow_reload_plugin", description: "重读已登记插件并替换实现，内容变化需要用户在面板重新审阅，此工具不会自动批准。失败保留可用的原实现，不接受路径。", inputSchema: pluginCalls.reload },
  { name: "workflow_list_workflows", description: "先列出当前草稿、已保存工作流和恢复草稿的名称、类型与 ID，不改变当前内容。按用户指定目标匹配，名称重复或目标不明确时先询问用户。", inputSchema: object },
  { name: "workflow_select_workflow", description: "使用 workflow_list_workflows 返回的 kind 和 id 选择用户指定的目标。当前草稿不切换，保存版本和恢复草稿载入编辑器，原有未保存内容进入恢复草稿。切换内容需要可编辑权限。完成后必须重新调用 workflow_get_summary 读取，再操作。", inputSchema: { ...object, properties: { kind: { enum: ["draft", "saved", "recovery"] }, id: { type: "string", minLength: 1 } }, required: ["kind", "id"] } },
  {name:'workflow_edit',description:'常用图编辑入口：add 只需 typeId，自动补齐默认值和可读 ID，也可明确 id。remove/connect/disconnect/output 可整批提交，失败整批回滚。返回 added 列表。',inputSchema:workflowCalls.edit},
  {name:'workflow_set_node_property',description:'使用与检查器相同的规则校验并提交属性。支持 $title/$scope 和普通字段，切换 valueType 同步调整常量默认值。',inputSchema:workflowCalls.setProperty},
  {name:'workflow_inspect',description:'读取当前阶段完整检查器字段、类型选项和参数说明，由工作流能力统一生成，不改变草稿。',inputSchema:workflowCalls.inspect},
  {name:'workflow_get_export_configuration',description:'读取导出插件提供的几何字段、参数 ID 与依赖包路径说明。可传 edit 试算字段的 value/enabled/id，不修改工作流、不导出文件、不登记依赖。通过后可将结果 geometry 交给 workflow_set_vertex_transform。需要当前草稿守卫，非法/保留/重复 ID 会拒绝。',inputSchema:ACTION_SCHEMAS.DESCRIBE_EXPORT_CONFIGURATION},
  {name:'workflow_project_file',description:'工作流存储的 status/open/openSaved/save/reload/recover/backup。open 只能使用 status 返回的、用户通过桌面选择器授权过的 fileId，不弹出选择器、不接受路径。save 统一保存工作流，未关联文件时保存在工作流库，关联文件时同步更新源文件和库，冲突覆盖必须显式传最新 conflictVersion。恢复只载入草稿，不写回磁盘。',inputSchema:{...projectFileRequest,properties:{...projectFileRequest.properties,expectedDocumentRevision:{type:'integer'}},required:['operation','expectedDocumentRevision']}},
  {name:'workflow_get_preview_status',description:'读取 GPU 可用状态、当前挂载画布数量和高清视框状态，不读取或修改文件。',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'workflow_get_compilation_status',description:'读取编译缓存命中、淘汰、在途任务和容量上限，不读取或修改文件。',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'workflow_close_preview',description:'关闭当前 MCP 接入打开的高清视框并释放帧，不影响其他插件打开的视框。',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'workflow_open_preview',description:'打开高清 GPU 视框，默认跟随编辑器的播放、暂停和定位。显式传 time 固定在该秒数，长边默认 2048。',inputSchema:{type:'object',properties:{nodeId:{type:'string'},socket:{type:'string'},longEdge:{type:'integer',minimum:64,maximum:4096},time:{type:'number'}},additionalProperties:false}},
  {name:'workflow_set_preview_time',description:'设置当前编辑器共享的预览时间（秒）或播放状态，作用于节点、几何和跟随中的高清视框。定位并暂停请传 time 和 playing:false。',inputSchema:{type:'object',properties:{time:{type:'number'},playing:{type:'boolean'}},additionalProperties:false}},
  {name:'workflow_render_preview',description:'读取当前节点或完整特效的真实 GPU 预览。默认返回可直接查看的 MCP 图片及尺寸，longEdge 可取 1024/2048/4096 等尺寸，按工作流宽高比读取高清图，也可指定 width/height。format=data 时返回 dataUrl 供程序读取像素。不修改工作流、画布分辨率或文件。',inputSchema:{type:'object',properties:{nodeId:{type:'string'},socket:{type:'string'},width:{type:'integer',minimum:1,maximum:4096},height:{type:'integer',minimum:1,maximum:4096},longEdge:{type:'integer',minimum:64,maximum:4096},format:{enum:['image','data'],default:'image'},time:{type:'number'}},additionalProperties:false}},
  {
    name: "workflow_get_status",
    description:
      "首先检查工作区连接状态。应用会自动连接，未连接时等待应用启动或重试，不要求用户手动激活草稿。连接后用 workflow_list_workflows 选择用户指定的目标。",
    inputSchema: object,
  },
  {
    name: "workflow_get_summary",
    description:
      "选择目标后读取当前工作流的项目、修订、节点、连线与阶段。操作使用本次返回的标识和修订，完成后再次读取核对。",
    inputSchema: object,
  },
  {
    name: "workflow_get_current",
    description:
      "读取当前工作流的完整诊断快照，不自动选择保存版本。默认省略预览图片和生成源码，常规操作优先使用 workflow_get_summary。",
    inputSchema: currentSchema,
  },
  {
    name: "workflow_agent_instructions",
    description:
      "Read the mandatory safe workflow-agent procedure before editing: status, summary, node contracts, revision-guarded commands and verification.",
    inputSchema: object,
  },
  {
    name: "workflow_list_node_types",
    description:
      "读取当前阶段可用节点的端口、属性、阶段及目标契约。创建与连接使用准确 typeId/socket，io.input 应显式设置 valueType（FLOAT/INT/BOOL/VEC2/VEC3/VEC4/MAT4），uniform 必须以 u_ 开头，scope 为 shared 或 instance。",
    inputSchema: object,
  },
  {
    name: "workflow_list_resources",
    description:
      "Read metadata for saved workflows and current-page libraries. This is read-only and never opens or switches to a saved workflow.",
    inputSchema: object,
  },
  {
    name: "workflow_get_generated_sources",
    description:
      "Read Java, vertex GLSL and fragment GLSL from the most recent successful export.",
    inputSchema: object,
  },
  {
    name: "workflow_submit_commands",
    description:
      "Apply basic graph edits to the active draft: ADD_NODE, REMOVE_NODE, MOVE_NODE, CONNECT, DISCONNECT, SET_PROPERTY, RENAME_NODE, RENAME_NODE_ID, SET_OUTPUT. The bridge validates and waits for the page to apply the batch.",
    inputSchema: {
      type: "object",
      properties: {
        expectedRevision: { type: "number" },
        commands: {
          type: "array",
          minItems: 1,
          items: {anyOf:Object.entries(GRAPH_PAYLOAD_SCHEMAS).map(([type,payload])=>({
            type:'object',properties:{type:{enum:[type]},payload},required:['type','payload'],additionalProperties:false,
          }))},
        },
      },
      required: ["commands", "expectedRevision"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_auto_layout",
    description:
      "Arrange all current nodes in readable LR or TB columns without changing shader semantics or links.",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["LR", "TB"] },
        gapX: { type: "number" },
        gapY: { type: "number" },
        startX: { type: "number" },
        startY: { type: "number" },
        expectedRevision: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "workflow_create",
    description:
      "Create and open a new saved workflow with the normal starter graph.",
    inputSchema: {
      type: "object",
      properties: projectProperties,
      additionalProperties: false,
    },
  },
  {
    name: "workflow_save",
    description:
      "统一保存当前工作流，普通工作流保存到库，关联文件同步写回源文件与库。",
    inputSchema: object,
  },
  {
    name: "workflow_open",
    description: "Open one workflow from the saved workflow library.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_delete",
    description:
      "Delete one saved workflow by id, equivalent to the page library delete button.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_import",
    description:
      "校验、打开并保存完整工作流 JSON 对象，对应用户的导入操作，不接受文件系统路径。",
    inputSchema: {
      type: "object",
      properties: { workflow: { type: "object" } },
      required: ["workflow"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_load_example",
    description:
      "打开内置旋涡教学示例，作为普通工作流编辑。",
    inputSchema: object,
  },
  {
    name: "workflow_reset",
    description: "Reset the active draft to the normal starter graph.",
    inputSchema: object,
  },
  {
    name: "workflow_add_demo",
    description:
      "Add the same UV -> centered UV -> length demonstration chain as the page Add Demo button.",
    inputSchema: object,
  },
  {
    name: "workflow_set_project",
    description:
      "Update active workflow title, Java plugin class name, shader directory, preview canvas resolution and optional id. previewWidth/previewHeight are GPU preview dimensions in the range 64-4096.",
    inputSchema: {
      type: "object",
      properties: projectProperties,
      additionalProperties: false,
    },
  },
  {
    name: "workflow_set_stage",
    description:
      "切换到 targetStage，stage 仍使用当前摘要的阶段，不要替换成目标阶段。切换后重新读取摘要再操作。",
    inputSchema: {
      type: "object",
      properties: {
        targetStage: { type: "string", enum: ["vertex", "fragment"] },
      },
      required: ["targetStage"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_set_vertex_transform",
    description:
      "Update vertex geometry, local transform and typed vertex graph. Omitted fields retain the current draft.",
    inputSchema: {
      type: "object",
      properties: {
        vertices: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: { type: "number" },
          },
        },
        tx: { type: "number" },
        ty: { type: "number" },
        sx: { type: "number" },
        sy: { type: "number" },
        rotation: { type: "number" },
        instanceInputs: {type:'object',description:'几何参数变化开关，键为 tx/ty/sx/sy/rotation/v0x…v3y，值包含 enabled:boolean 和 id:string。',additionalProperties:{type:'object',properties:{enabled:{type:'boolean'},id:{type:'string'}},required:['enabled','id'],additionalProperties:false}},
        parameterModes: {type:'object',description:'按 uniform 名称指定 shared 或 instance，例如 {u_tint:"instance"}。',additionalProperties:{enum:['shared','instance']}},
        graph: {
          type: "object",
          properties: {
            nodes: { type: "array", items: { type: "object" } },
            output: { type: "string" },
            links: { type: "array", items: { type: "object" } },
            outputNodeId: { type: "string" },
          },
          required: ["nodes"],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "workflow_set_canvas",
    description:
      "Set canvas pan and zoom, equivalent to dragging and zooming the page.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        zoom: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "workflow_select",
    description:
      "Select graph nodes by id, equivalent to selecting/box-selecting nodes on the canvas.",
    inputSchema: {
      type: "object",
      properties: { nodeIds: { type: "array", items: { type: "string" } } },
      required: ["nodeIds"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_modify_selection",
    description:
      "Run a context-menu operation on the current selection: DELETE, DISCONNECT, SET_PREVIEW, or SAVE_AS_WORKFLOW_NODE.",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: [
            "DELETE",
            "DISCONNECT",
            "SET_PREVIEW",
            "SAVE_AS_WORKFLOW_NODE",
          ],
        },
        enabled: { type: "boolean" },
        title: { type: "string" },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_upsert_custom_node",
    description:
      "Create or edit a component in the custom.glsl plugin. Optional typeId must be custom.glsl.*, otherwise a fresh ID is allocated. Supply title, properties.parameters [{name,type,qualifier:in/out/inout}], properties.code (function body), and properties.sourceTargets (glsl-es-300 and/or glsl-430). helperSource is optional. Legacy expression definitions are rejected.",
    inputSchema: {
      type: "object",
      properties: { definition: { type: "object" } },
      required: ["definition"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_delete_custom_node",
    description:
      "Remove one component owned by custom.glsl. Existing graph nodes and links are preserved.",
    inputSchema: {
      type: "object",
      properties: { typeId: { type: "string" } },
      required: ["typeId"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_expand_workflow_node",
    description:
      "Drag-equivalent expansion of a reusable workflow node into the current canvas at canvasX/canvasY.",
    inputSchema: {
      type: "object",
      properties: {
        workflowNodeId: { type: "string" },
        canvasX: { type: "number" },
        canvasY: { type: "number" },
      },
      required: ["workflowNodeId"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_delete_workflow_node",
    description:
      "Delete a user-created reusable workflow node by id. Preset workflow nodes cannot be deleted.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "workflow_export_runtime_dependency",
    description: "导出单个公共 WorkflowRuntime.java 源码并配置当前工作流的依赖包路径。runtimePath 为相对源码根目录的 Java 包路径（如 data/method），不是任意文件系统路径。返回 filename/content/revision/runtimePath，首次使用或换路径后先调用此工具，再导出三文件特效。仅记录源码已交付，不代表已安装到游戏，不直接写入文件。",
    inputSchema:{type:'object',properties:{runtimePath:{type:'string'}},additionalProperties:false},
  },
  {
    name: "workflow_export_runtime",
    description:
      "与界面共用三文件导出逻辑，返回 Java、顶点 GLSL 和片段 GLSL，不额外触发下载。先调用 workflow_export_runtime_dependency 取得当前路径的公共依赖，VEC4 必须连接到 io.output.color。",
    inputSchema: object,
  },
];

tools.push(
  {
    name: "workflow_document_transaction",
    description:
      "原子修改顶点与片段图，必须携带 documentRevision，失败不改变任一阶段。",
    inputSchema: {
      type: "object",
      properties: {
        expectedDocumentRevision: { type: "integer" },
        transaction: {
          type: "object",
          properties: {
            commands: { type: "array" },
            patch: { type: "object" },
            label: { type: "string" },
          },
        },
      },
      required: ["transaction", "expectedDocumentRevision"],
    },
  },
  {
    name: "workflow_undo",
    description:
      "撤销当前阶段，联合事务同时恢复两个阶段，有后续编辑冲突时拒绝。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "workflow_redo",
    description: "重做当前阶段最近撤销的操作。",
    inputSchema: { type: "object", properties: {} },
  },
);
// 列表与目标选择在读取摘要之前使用，写权限仍由实际操作在服务端判断。
const toolsWithoutDraftGuards = new Set([
  "workflow_list_workflows",
  "workflow_select_workflow",
  "workflow_get_status",
  "workflow_get_summary",
  "workflow_get_current",
  "workflow_agent_instructions",
  "workflow_list_node_types",
  "workflow_list_resources",
  "workflow_get_generated_sources",
]);
const guardProperties = {
  documentId: { type: "string" },
  documentToken: { type: "string" },
  stage: { type: "string", enum: ["vertex", "fragment"] },
  expectedRevision: { type: "integer" },
};
for (const tool of tools)
  if (!toolsWithoutDraftGuards.has(tool.name)) {
    tool.inputSchema = {
      ...tool.inputSchema,
      properties: { ...tool.inputSchema.properties, ...guardProperties },
      required: [
        ...new Set([
          ...(tool.inputSchema.required || []),
          ...Object.keys(guardProperties),
        ]),
      ],
    };
    tool.description +=
      " Pass documentId=summary.project.id, documentToken, stage and expectedRevision=summary.graph.revision from the same summary.";
  }

export function createMcpTools({ readState, submit, bridge }) {
  const bridgeAddress = () => typeof bridge === "function" ? bridge() : bridge;
  async function state() {
    return readState();
  }
  function connectionStatus(current) {
    return {
      bridgeUrl: bridgeAddress(),
      bridgeReachable: true,
      editorConnected: current.editorConnected === true,
      activeEditorId: current.activeEditorId || null,
      draft: current.graph
        ? {
            projectId: current.project?.id || null,
            title: current.project?.title || null,
            revision: current.graph.revision ?? null,
            nodeCount: current.graph.nodes?.length || 0,
            linkCount: current.graph.links?.length || 0,
          }
        : null,
    };
  }
  async function activeState() {
    const current = await state();
    if (!current.editorConnected)
      throw new Error(
        "工作区尚未连接，请打开已配置的工作流应用并稍后重试。应用会自动连接，无需激活草稿或重新配置。",
      );
    return current;
  }
  function sanitizeNode(node, includePreviewAssets = false) {
    const copy = JSON.parse(JSON.stringify(node));
    const dataUrl = copy.properties?.previewDataUrl;
    if (typeof dataUrl === "string" && dataUrl) {
      if (!includePreviewAssets) {
        delete copy.properties.previewDataUrl;
        copy.previewAsset = { available: true, bytes: dataUrl.length };
      }
    }
    return copy;
  }
  function sanitizedGraph(graph, includePreviewAssets = false) {
    return {
      schemaVersion: graph?.schemaVersion ?? 1,
      revision: graph?.revision ?? 0,
      outputNodeId: graph?.outputNodeId ?? null,
      nodes: (graph?.nodes || []).map((node) =>
        sanitizeNode(node, includePreviewAssets),
      ),
      links: graph?.links || [],
    };
  }
  function sanitizedTransform(transform, assets = false) {
    return transform?.graph
      ? { ...transform, graph: sanitizedGraph(transform.graph, assets) }
      : transform || null;
  }
  function summary(current) {
    const graph = sanitizedGraph(current.graph);
    return {
      connection: connectionStatus(current),
      documentToken: current.documentToken,
      documentRevision: current.documentRevision,
      dependencyDiagnostics: current.dependencyDiagnostics || [],
      history: current.history,
      stage: current.stage || "fragment",
      project: current.project || null,
      graph,
      selection: current.selection || [],
      view: current.view || null,
      vertexTransform: sanitizedTransform(current.vertexTransform),
      outputConnected: (current.stage === "vertex"
        ? ["position", "uv"]
        : ["color"]
      ).every((socket) =>
        graph.links.some(
          (link) =>
            link.toNode === graph.outputNodeId && link.toSocket === socket,
        ),
      ),
    };
  }
  const agentInstructions = WORKFLOW_AGENT_PROCEDURE;
  const currentGuard = (current) => ({
    documentId: current.project.id, documentToken: current.documentToken,
    stage: current.stage, expectedRevision: current.graph.revision,
    expectedDocumentRevision: current.documentRevision,
  });
  async function targets(current) {
    const response = await post({ actions: [{ type: "PROJECT_FILE", payload: { operation: "status" } }] }, currentGuard(current));
    if (response.ok === false) throw Error(response.error || "读取草稿列表失败");
    const files = response.result;
    return [
      { kind: "draft", id: current.documentToken, projectId: current.project.id, title: current.project.title, current: true },
      ...(current.savedWorkflows || []).map((item) => ({ kind: "saved", id: item.id, title: item.title, current: false })),
      ...(files?.recoveries || []).map((item) => ({ kind: "recovery", id: item.id, title: item.title, updatedAt: item.updatedAt, current: false })),
    ];
  }
  async function post(input, guards) {
    if (
      typeof guards.documentId !== "string" ||
      typeof guards.documentToken !== "string" ||
      !["vertex", "fragment"].includes(guards.stage) ||
      !Number.isInteger(guards.expectedRevision)
    )
      throw new Error(
        "Writes require documentId, documentToken, stage and expectedRevision from workflow_get_summary",
      );
    return submit({
      ...input,
      documentId: guards.documentId,
      documentToken: guards.documentToken,
      stage: guards.stage,
      expectedRevision: guards.expectedRevision,
      ...(input.transaction || guards.expectedDocumentRevision!==undefined
        ? { expectedDocumentRevision: guards.expectedDocumentRevision }
        : {}),
    });
  }
  function selectionAction(operation, args, action) {
    const types = {
        DELETE: "DELETE_SELECTED",
        DISCONNECT: "DISCONNECT_SELECTED",
        SET_PREVIEW: "TOGGLE_SELECTED_PREVIEW",
        SAVE_AS_WORKFLOW_NODE: "SAVE_SELECTION_AS_WORKFLOW_NODE",
      },
      type = types[operation];
    if (!type) throw new Error("Unknown selection operation");
    return action(
      type,
      operation === "SET_PREVIEW"
        ? { enabled: args.enabled }
        : operation === "SAVE_AS_WORKFLOW_NODE"
          ? { title: args.title }
          : {},
    );
  }

  async function call(name, args = {}) {
    const pluginMethod = { workflow_list_authorized_plugins: "authorized", workflow_register_authorized_plugin: "registerAuthorized", workflow_remove_plugin: "remove", workflow_get_plugin_panels: "inspectPanels", workflow_get_plugin_status: "snapshot", workflow_preview_plugin_disable: "previewDisable", workflow_set_plugin_enabled: "setEnabled", workflow_reload_plugin: "reload" }[name];
    if (pluginMethod) {
      validateValue(args, tools.find((tool) => tool.name === name).inputSchema, "插件工具参数");
      const input = Object.fromEntries(Object.keys(pluginCalls[pluginMethod].properties).filter((key) => Object.hasOwn(args, key)).map((key) => [key, args[key]]));
      return (await post({ pluginCall: { method: pluginMethod, input } }, args)).result;
    }
    if (name === "workflow_list_workflows") {
      const current = await activeState();
      return { workflows: await targets(current), next: "workflow_select_workflow" };
    }
    if (name === "workflow_select_workflow") {
      if (!["draft", "saved", "recovery"].includes(args.kind) || typeof args.id !== "string" || !args.id)
        throw Error("请使用工作流列表返回的 kind 和 id，不能只凭名称猜选");
      const current = await activeState();
      const target = (await targets(current)).find((item) => item.kind === args.kind && item.id === args.id);
      if (!target) throw Error("目标已变化或不存在，请重新列出工作流并确认目标");
      if (target.kind !== "draft") {
        const payload = target.kind === "saved" ? { operation: "openSaved", id: target.id } : { operation: "recover", recoveryId: target.id };
        const response = await post({ actions: [{ type: "PROJECT_FILE", payload }] }, currentGuard(current));
        if (response.ok === false) throw Error(response.error || "选择工作流失败");
      }
      return { selected: target, next: "workflow_get_summary", message: "请读取所选工作流，再使用新摘要的标识、阶段和修订操作。" };
    }
    const method = {workflow_edit:'edit',workflow_set_node_property:'setProperty',workflow_inspect:'inspect'}[name];
    if(method){
      const schema=workflowCalls[method];
      const input=Object.fromEntries(Object.keys(schema.properties).filter(k=>Object.hasOwn(args,k)).map(k=>[k,args[k]]));
      return (await post({workflowCall:{method,input}},args)).result;
    }
    const action = (type, payload = {}) =>
      post({ actions: [{ type, payload }] }, args);
    if(name==='workflow_project_file'){
      if(args.operation==='open'&&!args.fileId)throw Error('MCP 打开项目需要桌面已授权的 fileId，请先读取 status');
      const payload=Object.fromEntries(Object.keys(projectFileRequest.properties).filter(k=>Object.hasOwn(args,k)).map(k=>[k,args[k]]));
      return action('PROJECT_FILE',payload);
    }
    if (name === "workflow_get_status") {
      try {
        return connectionStatus(await state());
      } catch (error) {
        return {
          bridgeUrl: bridgeAddress(),
          bridgeReachable: false,
          editorConnected: false,
          error: error.message || String(error),
        };
      }
    }
    if (name === "workflow_get_summary") return summary(await activeState());
    if (name === "workflow_get_current") {
      const current = await activeState(),
        includePreviewAssets = args.includePreviewAssets === true;
      return {
        connection: connectionStatus(current),
        documentToken: current.documentToken,
        documentRevision: current.documentRevision,
        stage: current.stage || "fragment",
        project: current.project || null,
        graph: sanitizedGraph(current.graph, includePreviewAssets),
        selection: current.selection || [],
        view: current.view || null,
        vertexTransform: sanitizedTransform(
          current.vertexTransform,
          includePreviewAssets,
        ),
        savedWorkflows: current.savedWorkflows || [],
        customNodeEditing: !!current.customNodeEditing,
        customNodes: current.customNodes || [],
        workflowNodes: current.workflowNodes || [],
        catalog: current.catalog || [],
        generatedSources:
          args.includeGeneratedSources === true
            ? current.generatedSources || null
            : undefined,
        previewAssetsIncluded: includePreviewAssets,
      };
    }
    if (name === "workflow_agent_instructions")
      return { instructions: agentInstructions };
    if (name === "workflow_list_node_types")
      return { catalog: (await activeState()).catalog || [] };
    if (name === "workflow_list_resources") {
      const current = await activeState();
      return {
        project: current.project || null,
        selection: current.selection || [],
        view: current.view || null,
        savedWorkflows: current.savedWorkflows || [],
        customNodeEditing: !!current.customNodeEditing,
        customNodes: current.customNodes || [],
        workflowNodes: current.workflowNodes || [],
        vertexTransform: current.vertexTransform || null,
      };
    }
    if (name === "workflow_get_generated_sources")
      return (
        (await activeState()).generatedSources || {
          available: false,
          message: "No successful export has been made yet.",
        }
      );
    if (name === "workflow_document_transaction")
      return post({ transaction: args.transaction }, args);
    if (name === "workflow_undo") return action("UNDO");
    if (name === "workflow_redo") return action("REDO");
    if (name === "workflow_submit_commands") {
      if (!Number.isInteger(args.expectedRevision))
        throw new Error(
          "需要 expectedRevision，请先读取当前摘要",
        );
      if (
        !Array.isArray(args.commands) ||
        !args.commands.length ||
        args.commands.some(
          (command) =>
            !commandTypes.has(command?.type) ||
            !command.payload ||
            typeof command.payload !== "object",
        )
      )
        throw new Error(
          "commands must be a non-empty array of supported commands with object payloads",
        );
      return post({ commands: args.commands }, args);
    }
    if (name === "workflow_auto_layout") return action('AUTO_LAYOUT',args);
    const preview = (method,input) => post({previewCall:readPreviewCall({method,input})},args);
    if (name === 'workflow_get_preview_status') return (await preview('status',{})).result;
    if (name === 'workflow_get_compilation_status') return (await preview('compilationStatus',{})).result;
    if (name === 'workflow_close_preview') return (await preview('close',{})).result;
    if (name === 'workflow_set_preview_time') {
      const input = Object.fromEntries(['time','playing'].filter(k => Object.hasOwn(args,k)).map(k => [k,args[k]]));
      if (!Object.keys(input).length) throw Error('请提供预览秒数或播放状态');
      return (await preview('setPlayback',input)).result;
    }
    if (name === 'workflow_open_preview') {
      const input=Object.fromEntries(['nodeId','socket','longEdge','time'].filter(k=>Object.hasOwn(args,k)).map(k=>[k,args[k]]));
      return preview('open',input);
    }
    if (name === 'workflow_render_preview') {
      const {format='image'}=args;
      if(!['image','data'].includes(format))throw Error('format 必须为 image 或 data');
      if(args.longEdge!==undefined && (args.width!==undefined||args.height!==undefined))throw Error('longEdge 与 width/height 请只选择一种尺寸方式');
      const options=Object.fromEntries(['nodeId','socket','width','height','longEdge','time'].filter(k=>Object.hasOwn(args,k)).map(k=>[k,args[k]]));
      return (await preview('frame',options)).result;
    }
    if (name === "workflow_create") return action("NEW_WORKFLOW", args);
    if (name === "workflow_save") return action("SAVE_WORKFLOW");
    if (name === "workflow_open") return action("OPEN_WORKFLOW", args);
    if (name === "workflow_delete") return action("DELETE_WORKFLOW", args);
    if (name === "workflow_import") return action("IMPORT_WORKFLOW_DATA", args);
    if (name === "workflow_load_example")
      return action("LOAD_MING_GOD_EXAMPLE");
    if (name === "workflow_reset") return action("RESET_CURRENT_DRAFT");
    if (name === "workflow_add_demo") return action("ADD_DEMO");
    if (name === "workflow_set_project")
      return action("SET_PROJECT_CONFIG", args);
    if (name === "workflow_set_stage") {
      if (!["vertex", "fragment"].includes(args.targetStage))
        throw Error("targetStage 必须为 vertex 或 fragment");
      return action("SET_STAGE", { stage: args.targetStage });
    }
    if (name === "workflow_set_vertex_transform")
      return action("SET_VERTEX_TRANSFORM", args);
    if (name === "workflow_set_canvas") return action("SET_VIEW", args);
    if (name === "workflow_select") return action("SET_SELECTION", args);
    if (name === "workflow_modify_selection")
      return selectionAction(args.operation, args, action);
    if (name === "workflow_upsert_custom_node")
      return action("UPSERT_CUSTOM_NODE", args);
    if (name === "workflow_delete_custom_node")
      return action("DELETE_CUSTOM_NODE", args);
    if (name === "workflow_expand_workflow_node")
      return action("EXPAND_WORKFLOW_NODE", args);
    if (name === "workflow_delete_workflow_node")
      return action("DELETE_WORKFLOW_NODE", args);
    if (name === "workflow_export_runtime") {
      return (await action("EXPORT_RUNTIME",{download:false})).result;
    }
    if (name === 'workflow_export_runtime_dependency')
      return (await action('EXPORT_RUNTIME_DEPENDENCY',Object.hasOwn(args,'runtimePath')?{runtimePath:args.runtimePath}:{})).result;
    if (name === 'workflow_get_export_configuration') {
      const payload = Object.fromEntries(['geometry','runtimePath','edit'].filter(k=>Object.hasOwn(args,k)).map(k=>[k,args[k]]));
      return (await action('DESCRIBE_EXPORT_CONFIGURATION',payload)).result;
    }
    throw new Error("Unknown tool");
  }

  return { tools, call, summary, activeState, agentInstructions };
}

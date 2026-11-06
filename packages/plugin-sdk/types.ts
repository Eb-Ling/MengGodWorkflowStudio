export type {WorkspaceApi,WorkflowExportApi,WorkflowFileSelectionApi,McpConnectionApi} from './workspace-types';
export type { ExtensionPlatformApi } from './extension-platform-types';
import type { Component, Slots } from "vue";
/** SDK / 应用发布版本为 v1.0，schemaVersion 为整数格式版本，与修订号无关。 */
export type Stage = "vertex" | "fragment";
import type { JsonValue, GraphPayloads, ApplicationPayloads, NodeCreationInput, WorkflowEditInput, WorkflowPropertyInput } from "./command-types";
export type { JsonValue, GraphPayloads, ApplicationPayloads, NodeCreationInput, WorkflowEditInput, WorkflowPropertyInput } from "./command-types";
export type JsonSchema = Record<string, unknown>;
/** 可重复释放的资源句柄。同步资源返回 void，异步清理返回 Promise。 */
export interface Disposable {
  dispose(): void | Promise<void>;
}
/** 注册返回值的所有者由提供者绑定，主动释放可重复调用，也会解除宿主兜底登记。 */
export interface Registration extends Disposable {
  readonly owner: string;
  readonly active: boolean;
}
/** 边界错误携带稳定类别与中文说明，数值范围等约束在运行时校验。 */
export interface ContractErrorDetail {
  code: import("./command-types").ContractErrorCode;
  message: string;
  path?: string;
}
export type PortDefinition = {
  name: string;
  type: string;
}
/** 保存节点类型与端口快照，缺失插件时保留原始内容用于恢复。 */
export type GraphNode = {
  id: string;
  typeId: string;
  title?: string;
  canvasX: number;
  canvasY: number;
  properties: Record<string, JsonValue>;
  portSnapshot?: { inputs: PortDefinition[]; outputs: PortDefinition[] };
  /** 由注册表自动记录来源，缺失插件时保存数据，恢复后重新解析。 */
  plugin?: { id: string; version: string };
}
export interface GraphLink {
  fromNode: string;
  fromSocket: string;
  toNode: string;
  toSocket: string;
}
export interface GraphSnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
  revision: number;
  outputNodeId?: string | null;
  previewRevision?: number;
}
export interface ProjectConfig {
  id: string;
  title?: string;
  className?: string;
  shaderDir?: string;
  runtimePath?: string;
  previewWidth?: number;
  previewHeight?: number;
  blendMode?: "alpha" | "additive";
}
/** 文档是双阶段唯一状态，revision 在每次提交和历史恢复后递增。 */
export interface WorkflowDocument {
  kind: "studio.document";
  schemaVersion: 1;
  documentVersion: "1.0.0";
  revision: number;
  project: ProjectConfig;
  graphs: Record<Stage, GraphSnapshot>;
  geometry: Record<string, JsonValue>;
  requiredPlugins: Record<string, string>;
}
export interface ApiMethodContract {
  arguments?: JsonSchema;
  returns?: JsonSchema;
  capability?: string;
}
export interface PluginManifest {
  /** 可选的按需启动声明，仅接受自己提供的全部 JSON API 的 onApi:能力ID，首次调用由内核激活。 */
  activationEvents?: string[];
  /** L2 提供业务能力，L3 消费场景能力，未填写时按 L3。 */
  layer?: 2 | 3;
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  /** 必需 API 自动解析提供者并按依赖顺序启动，缺失或循环会拒绝激活。 */
  requiredApis: Record<string, string>;
  /** 可选 API 仅在可用时注入，提供者停用时消费者重新激活以降级。 */
  optionalApis?: Record<string, string>;
  /** 自己提供的 API 必须声明方法参数/返回 schema，ID 使用独立公共契约标识，所有者由宿主记录。 */
  providesApis?: Record<
    string,
    {
      version: string;
      methods: Record<string, ApiMethodContract>;
      /** 默认 JSON。local 仅限宿主明确授权的受信任内置提供者，用于组件、回调等本地对象。 */
      transport?: "json" | "local";
      /** 受信任提供者可按消费者创建作用域，工厂不跨进程，JSON 方法仍验证输入输出。 */
      scoped?: boolean;
      /** local API 允许读取的值成员，如冻结组件表。 */
      values?: string[];
    }
  >;
  /** 宿主必须明确授予清单请求的能力，受信任插件同样经过调用检查。 */
  capabilities?: string[];
}
export type {
  LocalPluginManifest,
  PluginDraft,
  PluginManagementSnapshot,
  PluginDisableImpact,
  PluginManagementApi,
} from "./plugin-management-types";
/** 由上层接入适配器创建，只提供插件手续与已授权能力，不暴露内核执行端口。 */
export interface PluginContext {
  /** 当前插件 ID，用于给贡献命名，所有者由内核确定。 */
  readonly pluginId: string;
  /** 获取已声明且兼容的 API，不可用、未声明或停用后调用都会报错。 */
  api<T>(id: string): T;
  /** 判断可选 API 是否实际可用。 */
  hasApi(id: string): boolean;
  /** 发布清单声明的 API 实现，跨插件参数与返回值被复制并按 schema 校验。 */
  provide(
    id: string,
    implementation:
      | Record<string, (...args: any[]) => unknown>
      | ((owner: string, own: (cleanup: () => void) => void) => unknown),
  ): void;
  /** 逆序执行清理，激活失败也回收。返回函数仅取消兜底登记，资源提前释放后可调用。 */
  onDispose(cleanup: () => void | Promise<void>): () => void;
}
/** 单阶段 commands 可省略 stage，文档 transaction 的每项必须指定 stage。 */
export type GraphCommand = {
  [K in keyof GraphPayloads]: {
    type: K;
    payload: GraphPayloads[K];
    stage?: Stage;
  };
}[keyof GraphPayloads];
export type ApplicationCommand = {
  [K in keyof ApplicationPayloads]: {
    type: K;
    payload: ApplicationPayloads[K];
  };
}[keyof ApplicationPayloads];
export type Operation = GraphCommand | ApplicationCommand;
/** 跨阶段文档命令必须明确指定阶段，单阶段 GraphCommand 仍可省略。 */
export type DocumentGraphCommand = GraphCommand & {stage: Stage};
/** 事务只提交内存文档修改，文件保存和导出必须以独立 action 调用。 */
export interface DocumentTransaction {
  commands?: DocumentGraphCommand[];
  patch?: {
    project?: Partial<ProjectConfig>;
    geometry?: Record<string, JsonValue>;
    requiredPlugins?: Record<string, string>;
  };
  label?: string;
}
export interface WorkflowRequest {
  documentId: string;
  documentToken: string;
  stage: Stage;
  expectedRevision: number;
  /** 使用 transaction 时必填，来自同一份 snapshot.documentRevision。 */
  expectedDocumentRevision?: number;
  commands?: GraphCommand[];
  actions?: ApplicationCommand[];
  transaction?: DocumentTransaction;
}
export interface WorkflowSnapshot {
  /** 当前节点的来源、版本、端口及缺失诊断，只读投影，不写入文档格式。 */
  dependencyDiagnostics: {
    code: string;
    message: string;
    nodeId: string;
    typeId: string;
    stage: Stage;
    expected: { id: string; version: string } | null;
    actual: { id: string; version: string } | null;
  }[];
  /** 节点定义或编译规则的修订，可变化而不修改文档修订。 */
  catalogRevision: number;
  documentToken: string;
  stage: Stage;
  documentRevision: number;
  document: WorkflowDocument;
  project: ProjectConfig;
  graph: GraphSnapshot;
  selection: string[];
  history: { undo: HistoryEntry[]; redo: HistoryEntry[] };
  [key: string]: unknown;
}
export interface HistoryEntry {
  id: number;
  label: string;
  stages: Stage[];
}
export interface WorkflowResult {
  ok: boolean;
  /** 可选 JSON 操作结果，独立副本，仅返回给当前调用方，不进入文档持久化。 */
  result?: JsonValue;
  revision?: number;
  documentRevision?: number;
  error?: string;
}
/** 检查器字段是独立数据，不包含 DOM、组件实例或可写 Store。 */
export interface InspectorField {
  key: string;
  label: string;
  kind: "text" | "select" | "toggle" | "file" | "readonly";
  value: string | boolean;
  id?: string;
  ariaLabel?: string;
  hint?: string;
  error?: string;
  options?: { value: string; label: string }[];
}
/** 可选择绑定旧快照，省略时由能力入口捕获当前状态，不执行冲突重试。 */
export type WorkflowGuard = Pick<WorkflowRequest,'documentId'|'documentToken'|'stage'|'expectedRevision'|'expectedDocumentRevision'>;
export interface WorkflowInspection {
  nodes: {node:GraphNode;definition:Record<string,unknown>;description:string;fields:InspectorField[];missing:boolean}[];
  catalog:WorkflowSnapshot['catalog'];types:{value:string;label:string}[];parameters:Record<string,unknown>[];
}
export interface WorkflowApi {
  /** 常见图编辑：自动补齐节点默认值/可读 ID，整批提交或整批拒绝。guard 可绑定较早快照。 */
  edit(input: WorkflowEditInput, guard?: WorkflowGuard): Promise<WorkflowResult & {added:string[]}>;
  /** 新建一个节点，自动处理默认值与命名，返回 id，不自动改变选区。 */
  addNode(input: NodeCreationInput, guard?: WorkflowGuard): Promise<WorkflowResult & {id:string;added:string[]}>;
  /** 取得可直接显示的检查器字段，不暴露宿主语义对象。 */
  inspect(guard?: WorkflowGuard): WorkflowInspection;
  /** 统一校验并提交属性，支持 $title/$scope 和普通字段，失败抛出中文错误。 */
  setProperty(input:WorkflowPropertyInput, guard?:WorkflowGuard): Promise<WorkflowResult>;
  /** 将操作反馈显示在状态区，需要 ui.status 能力。 */
  report(message:string): void;
  /** 通知编辑器发生用户交互，不提交文档。 */
  activity(): void;
  /** 只读当前文档、阶段和节点目录的修订标记，不复制节点或连线。 */
  revision(): Pick<WorkflowSnapshot, "documentToken" | "documentRevision" | "stage" | "catalogRevision">;
  /** 取得独立 JSON 快照，修改快照不会改变工作流。 */
  snapshot(): WorkflowSnapshot;
  /** 提交图命令、文档事务或文档内动作，保存、模板及导出动作使用 WorkspaceApi。拒绝时返回 ok=false/error。 */
  execute(request: WorkflowRequest): WorkflowResult | Promise<WorkflowResult>;
  /** 订阅快照变化，回调后重新读取，返回取消订阅函数。 */
  subscribe(listener: () => void): () => void;
  /** 订阅用户在编辑器中的活动，返回取消订阅函数。 */
  onActivity(listener: () => void): () => void;
}
/** v1.0 表达式类型，目标支持范围由运行时 IR 校验器继续检查。 */
export type ExpressionType =
  | "BOOL"
  | "INT"
  | "UINT"
  | "FLOAT"
  | "VEC2"
  | "VEC3"
  | "VEC4"
  | "IVEC2"
  | "IVEC3"
  | "IVEC4"
  | "UVEC2"
  | "UVEC3"
  | "UVEC4"
  | "BVEC2"
  | "BVEC3"
  | "BVEC4"
  | "MAT2"
  | "MAT3"
  | "MAT4"
  | "SAMPLER2D"
  | "SAMPLER_CUBE";
export type TypedExpression =
  /** block 的局部引用，仅能引用此前绑定，宿主自动生成不会碰撞的 GLSL 名称。 */
  | { kind: "ref"; type: ExpressionType; name: string }
  | {
      kind: "block";
      type: ExpressionType;
      names: string[];
      args: TypedExpression[];
    }
  | {
      kind: "swizzle";
      type: ExpressionType;
      fields: string;
      args: [TypedExpression];
    }
  | {
      kind: "literal";
      type: "BOOL" | "INT" | "UINT" | "FLOAT";
      value: number | boolean;
    }
  | { kind: "input"; type: ExpressionType; name: string }
  | {
      kind: "binary";
      type: ExpressionType;
      operator: string;
      left: TypedExpression;
      right: TypedExpression;
    }
  | {
      kind: "call";
      type: ExpressionType;
      name: string;
      args: TypedExpression[];
    };
/** 节点是声明式数据，编译算法在配对的 CompilerRule 中提供。 */
export interface NodeDefinition {
  typeId: string;
  title: string;
  category?: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  properties: Record<string, JsonValue>;
  /** 声明式 GLSL 函数，可替代逐目标的 IR 回调，端口必须与参数方向及类型一致。 */
  glsl?: { name: string; parameters: { id?: string; name: string; type: string; qualifier: "in" | "out" | "inout" }[]; code: string; helpers?: string };
  propertySchema?: JsonSchema;
  stages?: Stage[];
  targets?: string[];
  /** 宿主统一解析动态端口，编译时校验实际输入/输出类型，插件不能伪造类型。 */
  dynamicKind?:
    | "output"
    | "all"
    | "splitVector"
    | "combineVector"
    | "scaleVector"
    | "mix"
    | "vectorInput";
}
export interface CompilerRule {
  typeId: string;
  target: string;
  /** 为指定输出返回类型化 IR，支持异步，上下文是副本，停用后迟到结果失效。 */
  compile(context: {
    node: GraphNode;
    socket: string;
    outputType: string;
    inputs: Record<string, string>;
    /** 实际接入连线的输入端口名，缺省表示未连接。用于区分默认值与显式零输入。 */
    connectedInputs?: string[];
  }): TypedExpression | Promise<TypedExpression>;
}
export interface NodeContribution { nodes: NodeDefinition[]; compilers: CompilerRule[] }
export interface NodeRegistration extends Registration {
  /** 原子替换此句柄拥有的组件，失败时保留旧定义，释放后的句柄不能再次使用。 */
  replace(batch: NodeContribution): void;
}
export interface NodeApi {
  /** 返回节点定义副本，包含注册所有者与版本。 */
  list(): (NodeDefinition & { owner: string; version: string })[];
  /** 查找节点定义副本，不存在或提供者停用时返回 null。 */
  get(typeId: string): NodeDefinition | null;
  /** 节点及每个目标的编译规则原子注册，ID 必须位于本插件命名空间。 */
  register(contribution: NodeContribution): NodeRegistration;
}
/** 本地节点目录，独立于编辑会话，算法插件使用 NodeApi 注册即可。 */
export interface NodeCatalogApi {
  /** 返回独立副本，不暴露 ContributionRegistry。 */
  list(): NodeDefinition[];
  /** 目录变化后重新读取，消费者停用时自动取消。 */
  subscribe(listener: () => void): () => void;

}
export interface UiScope extends Disposable {
  /** 注册本作用域内的受信任 Vue 组件，ID 必须含所有者命名空间。 */
  register(definition: {
    id: string;
    version: string;
    component: Component;
  }): void;
  /** 创建实例，支持 props/events/slots，只允许渲染到宿主授予的容器。 */
  create(
    id: string,
    target: HTMLElement,
    props?: Record<string, unknown>,
    slots?: Slots,
  ): Disposable & { update(props: Record<string, unknown>): void };
}
export interface UiApi {
  /** 注册独立停靠面板，只影响工作区显示，不改变图的顺序或游戏渲染层。 */
  addDock(dock: {
    id: string;
    title: string;
    side: "left" | "right" | "bottom";
    defaultCollapsed?: boolean;
    component: Component;
    props?: Record<string, unknown>;
  }): Registration;
  /** 公共控件表（冻结）：CloseButton/SectionHeading/Toggle/SplitView/Dock/Button/Input/Checkbox/Select/Textarea/FileInput/Tabs/Menu/Tooltip/Renderer/Panel/Disclosure/Field/Dialog/AppFrame。 */
  components: Readonly<Record<string, Component>>;
  /** 注册工作区插槽，同一插槽只能有一个提供者，停用时自动卸载。 */
  addView(view: {
    id: string;
    slot:
      | "graph"
      | "catalog"
      | "inspector"
      | "geometry"
      | "preview-controls"
      | "stage-tabs"
      | "workspace-actions"
      | "project-config"
      | "project-library"
      | "project-examples"
      | "project-actions"
      | "project-title-actions";
    component: Component;
    props?: Record<string, unknown>;
  }): Registration;
  /** node 用 typeId，port 用 GLSL 类型，field 用 typeId.key，精确类型优先，随后比较 priority。同级重复拒绝。 */
  addRenderer(renderer: {
    id: string;
    kind: "node" | "port" | "field";
    typeIds: string[];
    priority?: number;
    component: Component;
  }): Registration;
  /** owner 必须为当前插件 ID，停用时宿主兜底回收注册及实例。 */
  createScope(owner: string): UiScope;
  /** 注册设置面板插槽。设置分区按 title 自动生成折叠入口，首次展开调用 mount，收起保留实例，移除或关闭中心时清理。 */
  addSettingsPanel(panel: {
    id: string;
    title: string;
    /** 插件中心的分区，未指定时进入“插件设置”，开发演示应明确标为 developer。 */
    category?: "management" | "settings" | "developer";
    mount(target: HTMLElement): Disposable;
  }): Registration;
  /** 在宿主提供的浮层插槽创建组件，停用插件时自动卸载，不访问其他插件 DOM。 */
  addOverlay(overlay: {
    id: string;
    component: Component;
    props?: Record<string, unknown>;
  }): Registration;
}
export interface BrowserApi {
  /** 当前插件独占的持久配置，重启后保留，不能用于跨插件通信。 */
  settings: { get(key: string): string | null; set(key: string, value: string): void };
  /** 当前页面对应的本地宿主服务地址。 */
  baseUrl: string;
  /** 网络能力。当前受信任内置插件可用，第三方代码沙箱尚未开放。 */
  fetch: typeof fetch;
  /** 当前插件命名空间下的会话配置，不得作为跨插件通信通道。 */
  preferences: {
    get(key: string): string | null;
    set(key: string, value: string): void;
  };
  /** 桌面平台桥接，平台接口通用化不进入图内核。 */
  desktop?: {
    /** 复用本机授权，只有权限变化才替换凭据，不返回桌面控制凭据。 */
    getMcpConfig(options:{mode:'read'|'write'}): Promise<{ executablePath: string; mcpServerPath: string; bridgeUrl:string;connectionFile:string;token:string;mode:'read'|'write';expiresAt:number|null }>;
    /** 读取已保存权限，不返回凭据。 */
    mcpStatus():Promise<{configured:boolean;mode:'read'|'write'}>;
    /** 把用户要求复制的接入说明放到系统剪贴板。 */
    copyText(value:string):Promise<void>;
    /** 撤销外部接入，正常编辑不受影响。 */
    revokeMcp():Promise<unknown>;
    testMcp(): Promise<{
      toolCount: number;
      tools: string[];
      requiredTools: string[];
      bridgeUrl: string;
    }>;
  };
}
/** 原生 HTTP 宿主接口：只分发已认证的 /v1/ 动态路由，未处理返回 null。注销函数需在停用时调用。 */
export interface HttpApi {
  register(
    handler: (request: {
      method: string;
      pathname: string;
      query: URLSearchParams;
      input: unknown;
      /** L1 已认证的请求上下文，不含原始凭据。业务插件按操作要求权限。 */
      principal: {signal:AbortSignal;assertActive():void;require(permission:string):void};
    }) =>
      | null
      | { status: number; body: unknown }
      | Promise<null | { status: number; body: unknown }>,
  ): () => void;
  /** 结束本轮请求并取消晚到结果，保留用户的持久授权。 */
  endSessions():void;
}

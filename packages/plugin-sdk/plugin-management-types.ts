/** 本地目录插件声明，扩展能力需在管理面板明确授予，磁盘重读不能自动扩大。 */
interface LocalPluginBase {
  /** 仅代码插件可声明 onApi:能力ID，不支持本地同步 API 或任意事件。 */
  activationEvents?: string[];
  /** 默认 L3，提供底层业务能力可声明 L2。层级不替代能力授权。 */
  layer?: 2 | 3;
  schemaVersion: 1;
  apiVersion: "1.0.0";
  id: string;
  name: string;
  version: string;
  requiredApis: Record<string, string>;
  optionalApis?: Record<string, string>;
  providesApis?: import("./types").PluginManifest["providesApis"];
  capabilities: string[];
  /** 独立 renderer 窗口与允许联网的来源，变化后必须重新授权。 */
  isolation?: {
    window?: { width: number; height: number };
    networkOrigins?: string[];
  };
}
export type LocalPluginManifest = LocalPluginBase &
  (
    | {
        kind: "nodes" | "extension";
        entry: string;
        exportName: string;
        declaration?: never;
      }
    | {
        kind: "declarative";
        declaration: import("./declarative-types").Declaration;
        entry?: never;
        exportName?: never;
      }
  );
/** 文件夹选择凭据来自原生宿主，不能以任意字符串路径替代。 */
export interface PluginDraft {
  token: string;
  directory: string;
  manifest: LocalPluginManifest;
  entries: string[];
  hasManifest: boolean;
  error: string;
  replaceId: string | null;
  permissionsApproved?: boolean;
  /** 当前读取内容的 SHA-256，仅用于诊断与本机授权，不写入工作流格式。 */
  fingerprint?: string;
  /** 目录当前内容与上次批准不同，保存前必须重新审阅。 */
  contentChanged?: boolean;
}
export interface PluginManagementSnapshot {
  ready: boolean;
  busy: boolean;
  error: string;
  notice: string;
  desktop: boolean;
  plugins: {
    id: string;
    name: string;
    version: string;
    requiredApis: Record<string, string>;
    enabled: boolean;
    /** enabled 包含按需待命，active 表示实现已实际启动。 */
    active?: boolean;
    activationState?: "active" | "waiting" | "disabled" | "failed";
    error: string | null;
    source: string;
    directory: string;
    protected?: boolean;
    /** 开发演示仅在插件中心的“开发者示例”分区呈现。 */
    developmentOnly?: boolean;
    nativeWindow?: boolean;
    /** 当前实际绑定的 API 提供者，包含宿主提供者 $host。 */
    bindings?: Record<string, string>;
    /** 本机已加载或已批准快照的内容指纹，内置插件为 null。 */
    fingerprint?: string | null;
    /** 本次目录加载代次，用于区分重载前后的故障与异步结果。 */
    generation?: string | null;
    /** 逐插件诊断，不构成另一套生命周期状态。 */
    diagnostic?: {
      code: string;
      message: string;
      generation: string | null;
    } | null;
  }[];
}
/** 停用前的只读影响快照，内核计算必需消费者和可选消费者，不执行变更。 */
export interface PluginDisableImpact {
  id: string;
  name: string;
  stop: { id: string; name: string }[];
  restart: { id: string; name: string }[];
  /** 确认对应的影响范围，执行前再次比较，范围改变时拒绝旧确认。 */
  reviewKey: string;
}
/** 管理插件通过此接口使用内核生命周期，无需访问 PluginHost 或平台私有对象。 */
export interface PluginManagementApi {
  /** 列出用户明确批准的目录快照，不提供任意路径和源码。 */
  authorized(): Promise<
    {
      id: string;
      authorizationId: string;
      name: string;
      version: string;
      fingerprint: string;
      registered: boolean;
    }[]
  >;
  /** 用户在面板审阅后授予目录登记许可，不修改源码，不加载插件。 */
  authorize(
    draft: PluginDraft,
    manifest: LocalPluginManifest,
  ): Promise<{ id: string; authorizationId: string }>;
  /** 只登记已授权且内容未变的目录，激活和回滚统一由内核管理。 */
  registerAuthorized(id: string, authorizationId: string): Promise<void>;
  /** 撤销未来登记许可，不自动停用已加载插件。 */
  revokeAuthorization(id: string, authorizationId: string): Promise<void>;
  /** 下载随当前发布提供的独立开发包，界面无需取得联网或原生端口。 */
  downloadKit(): Promise<void>;
  /** 由用户操作打开插件自己声明的原生窗口，关闭窗口隐藏，停用才销毁。 */
  openWindow(id: string): Promise<void>;
  /** 桌面版打开内置或已登记插件目录，仅接受插件 ID，缺失目录会报告错误。 */
  openDirectory(id: string): Promise<void>;
  /** 返回状态副本。 */ snapshot(): PluginManagementSnapshot;
  /** 查看停用影响，不停用任何插件。 */ previewDisable(
    id: string,
  ): PluginDisableImpact;
  /** 订阅状态，返回取消函数，消费者停用时内核兜底回收。 */ subscribe(
    listener: (state: PluginManagementSnapshot) => void,
  ): () => void;
  /** 原生文件夹选择，id 存在时重定位该插件，取消返回 null。 */ choose(
    id?: string,
  ): Promise<PluginDraft | null>;
  /** 重新读取已登记目录的声明，不执行入口。 */ inspect(
    id: string,
  ): Promise<PluginDraft>;
  /** 校验、激活、登记，失败恢复旧插件。可生成不覆盖现有文件的示例。 */ install(
    draft: PluginDraft,
    manifest: LocalPluginManifest,
    createTemplate?: boolean,
    /** 用户在管理面板审阅当前内容、能力及 API 声明后允许。 */ approvePermissions?: boolean,
  ): Promise<void>;
  /** 从磁盘重读入口并由内核替换，失败保留原有贡献。 */ reload(
    id: string,
  ): Promise<void>;
  /** 依赖启停和资源清理由内核管理，影响其他插件的停用必须传入已审阅的 reviewKey。 */ setEnabled(
    id: string,
    enabled: boolean,
    reviewKey?: string,
  ): Promise<void>;
  /** 卸载并移除目录登记，保留用户所有源文件。 */ remove(
    id: string,
    reviewKey?: string,
  ): Promise<void>;
}

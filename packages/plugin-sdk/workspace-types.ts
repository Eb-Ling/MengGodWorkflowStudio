import type { WorkflowApi, JsonValue } from "./types";
/** 完整工作区入口：编辑、保存、模板和导出共用守卫，具体业务由所属能力负责。 */
export interface WorkspaceApi extends WorkflowApi {
  /** 状态是数据投影，工作区不访问 DOM，也不承担界面控件生命周期。 */
  snapshot(): ReturnType<WorkflowApi["snapshot"]> & {
    exportReadiness: { ready: boolean; pending?: boolean; message: string };
  };
  /** 仅保存当前消费插件的视图偏好，不修改工作流文档。 */
  preferences(): {
    get(key: string): string | null;
    set(key: string, value: string): void;
  };
}
export interface SourceFile {
  filename: string;
  content: string;
}
export interface EffectSources {
  java: SourceFile;
  vertex: SourceFile;
  fragment: SourceFile;
}
export interface DependencyStatus {
  path: string;
  packageName: string;
  state: "missing" | "outdated" | "current";
}
/** 本地导出能力，节点/几何配置来自当前文档，无需消费方串联编译和文件端口。 */
export interface WorkflowExportApi {
  /** 只读配置试算，不要求图可编译。 */
  configuration(options?: Record<string, JsonValue>): Record<string, JsonValue>;
  /** 返回当前构造器签名、调用示例和说明。 */
  guide(options?: {
    count?: number;
  }): Promise<{ signature: string; example: string; description: string }>;
  /** 查看指定路径的依赖生成状态，不代表已安装到游戏。 */
  history(options: { path: string }): DependencyStatus;
  /** 生成并返回依赖，成功后记录路径，download 控制是否触发本地下载。 */
  exportDependency(options?: {
    runtimePath?: string;
    download?: boolean;
  }): Promise<SourceFile & { revision: string; runtimePath: string }>;
  /** 只读预览依赖源码和路径说明，不记录导出。 */
  prepareDependency(options: { runtimePath: string }): Promise<{
    configuration: Record<string, JsonValue>;
    dependency: SourceFile & { revision: string };
    status: DependencyStatus;
  }>;
  dependency(options: {
    runtimePath: string;
  }): Promise<SourceFile & { revision: string }>;
  /** 校验依赖、等待保存并核验文档仍有效，返回原始 Java/vert/frag。 */
  exportEffect(options?: { download?: boolean }): Promise<EffectSources>;
  /** 最近成功导出的副本，文档或节点规则改变后为 null。 */
  sources(): EffectSources | null;
  readiness(): { ready: boolean; pending?: boolean; message: string };
  subscribe(listener: () => void): () => void;
}
/** 仅本地 UI 可用，选择等待期间若文档变化，拒绝覆盖当前草稿。 */
export interface WorkflowFileSelectionApi {
  openFile(file: File): Promise<Record<string, JsonValue>>;
}
/** MCP 设置界面使用的会话，连接、租约与异常清理由连接能力拥有。 */
export interface McpConnectionApi {
  createSession(): {
    model: {
      port: string;
      status: string;
      prompt: string;
      configuration: string;
      busy: boolean;
      mode: "read" | "write";
    };
    actions: {
      /** 选择权限，生成后才应用，权限变化时替换旧凭据。 */
      setMode(value: string): void;
      activate(): Promise<void>;
      selfTest(): Promise<void>;
      showConfig(): Promise<void>;
      copyGuide(): Promise<void>;
      revoke(): Promise<void>;
    };
    dispose(): Promise<void>;
  };
}

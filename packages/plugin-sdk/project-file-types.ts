/** 用户通过文件选择器授权的项目，fileId 为不透明句柄，不能用任意路径代替。 */
export interface ProjectFileReference {
  fileId: string;
  name: string;
  path: string;
  version: string | null;
}
/** 由应用注入的工作流库端口，文件插件统一编排，外部消费者使用 workflow.project-files。 */
export interface WorkflowLibraryStorage {
  /** 返回保存的 Document 快照与来源，未保存时返回 null。 */
  read(input: {
    id: string;
  }): { document: unknown; file: ProjectFileReference | null } | null;
  /** 原子提交库内快照、来源索引和上次保存备份，不会更改当前编辑器文档。 */
  save(input: { document: unknown; file: ProjectFileReference | null }): {
    document: unknown;
    file: ProjectFileReference | null;
  };
  /** 取得上次保存前的快照，恢复与重新保存由调用方明确发起。 */
  backup(input: { id: string }): unknown;
}
export interface ProjectFileStatus {
  /** 已在工作流库保存，或从外部文件读取，可重新载入。 */
  saved: boolean;
  /** 仅操作返回值携带，用户取消原生选择器时为 true。 */
  cancelled?: boolean;
  available: boolean;
  dirty: boolean;
  busy: boolean;
  file: ProjectFileReference | null;
  error: string;
  conflict: { version: string | null; message: string } | null;
  recent: ProjectFileReference[];
  recoveries: {
    id: string;
    title: string;
    updatedAt: string;
    path: string | null;
  }[];
}
/** L1 可替换存储端口。路径由系统选择器授权，业务插件不接触 Node/Rust 文件对象。 */
export interface ProjectFileStorage {
  readonly available: boolean;
  chooseOpen(): Promise<ProjectFileReference | null>;
  chooseSave(): Promise<ProjectFileReference | null>;
  list(): Promise<ProjectFileReference[]>;
  read(input: {
    fileId: string;
  }): Promise<ProjectFileReference & { text: string }>;
  /** expectedVersion 必须与磁盘内容哈希一致，冲突抛出 code=CONFLICT、version 的错误。 */
  write(input: {
    fileId: string;
    expectedVersion: string | null;
    text: string;
  }): Promise<ProjectFileReference>;
  backup(input: { fileId: string }): Promise<{ text: string; version: string }>;
  recoveries(): Promise<ProjectFileStatus["recoveries"]>;
  recover(input: { recoveryId: string }): Promise<{
    document: unknown;
    file: ProjectFileReference | null;
    baseline: string | null;
  }>;
  /** 关闭兜底必须完成落盘，record=null 清除当前已保存的恢复记录。 */
  checkpoint(input: {
    id: string;
    record: {
      document: unknown;
      file: ProjectFileReference | null;
      baseline: string | null;
    } | null;
  }): void;
  /** 宿主生命周期适配，返回取消监听函数，不穿过远程 JSON 协议。 */
  onClose(callback: () => void): () => void;
}
/** L2 项目文件能力，所有内存变更仍通过 workflow.editor 的修订守卫。 */
export interface ProjectFilesApi {
  /** 返回保存状态、已授权项目及可恢复草稿，不会切换文档。 */
  status(): Promise<ProjectFileStatus>;
  /** 无 fileId 时由桌面选择文件，MCP 必须给出已授权 fileId。 */
  open(options?: { fileId?: string }): Promise<ProjectFileStatus>;
  /** 从工作流库打开，关联外部文件时读取源文件，保留用户节点 ID。 */
  openSaved(options: { id: string }): Promise<ProjectFileStatus>;
  /** 统一保存工作流，关联文件时同步源文件和库，冲突覆盖必须再次确认。 */
  save(options?: {
    conflictVersion?: string | null;
  }): Promise<ProjectFileStatus>;
  /** 桌面另存为，先选择目标，再按内容版本检查写入。 */
  saveAs(): Promise<ProjectFileStatus>;
  /** 重新读取磁盘，先将当前未保存内容留在恢复草稿中。 */
  reload(): Promise<ProjectFileStatus>;
  /** 恢复草稿到编辑器，不会自动覆盖磁盘项目。 */
  recover(options: { recoveryId: string }): Promise<ProjectFileStatus>;
  /** 将最后一次成功保存前的备份读入编辑器，仍需显式保存。 */
  backup(): Promise<ProjectFileStatus>;
}

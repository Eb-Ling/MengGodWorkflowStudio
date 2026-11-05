import type { JsonValue, JsonSchema, Registration, GraphSnapshot } from "./types";
/** 宿主只向插件提供其声明的内置文本资源，不接受 URL 或磁盘路径。 */
export interface AssetApi {
  /** 读取当前插件的资源名，插件停用后原调用句柄失效。 */
  readText(name: string): Promise<string>;
}
/** 通用数据操作注册。业务格式由插件实现，注册项由内核按所有者回收。 */
export interface OperationApi {
  /** 原子注册一组操作，ID 必须属于当前插件命名空间。 */
  register(
    operations: {
      id: string;
      title: string;
      inputSchema: JsonSchema;
      outputSchema: JsonSchema;
      run(input: JsonValue): JsonValue | Promise<JsonValue>;
    }[],
  ): Registration;
  /** 只返回声明副本，不暴露处理函数。 */
  list(): {
    id: string;
    title: string;
    owner: string;
    version: string;
    inputSchema: JsonSchema;
    outputSchema: JsonSchema;
  }[];
  /** 参数与返回值均经过 schema 校验。旧提供者的异步结果在停用后失效。 */
  execute(id: string, input: JsonValue): JsonValue | Promise<JsonValue>;
  /** 订阅操作变化，消费者停用时内核兜底清理。 */
  subscribe(listener: () => void): () => void;
}
/** 编译前端公开异步纯数据接口，实现可跨进程，不能返回编辑器对象。 */
export interface CompilationApi {
  /** 编译输入与实际节点提供者的会话身份，不含绘制时的时间或画布尺寸。 */
  identity(request: { document: CompilationDocument; stage?: "vertex" | "fragment"; nodeId?: string; socket?: string }): Promise<{ key: string }>;
  /** 有界缓存的只读统计，bytes 是保留 JSON 与键的 UTF-16 估算值。 */
  status(): Promise<Record<string, JsonValue>>;
  /** 编译节点或完整特效的预览程序与参数，绘图和资源生命周期由预览能力负责。 */
  preview(request: {
    document: CompilationDocument;
    stage?: "vertex" | "fragment";
    nodeId?: string;
    socket?: string;
  }): Promise<Record<string, JsonValue>>;
  describe(document: CompilationDocument): Promise<CompilationDescription>;
  lower(request: {
    document: CompilationDocument;
    target: "glsl-430" | "glsl-es-300";
    stage: "vertex" | "fragment";
    nodeId?: string;
    sockets?: string[];
  }): Promise<Record<string, JsonValue>>;
}
/** 应用只负责解析当前节点声明、端口和受检节点 IR。 */
export interface GraphSnapshotApi {
  /** 返回所用节点的提供者、版本、指纹及本次登记代次，不执行节点编译。 */
  identity(request: { document: CompilationDocument; stage?: "vertex" | "fragment" }): unknown[];
  describe(document: CompilationDocument): CompilationDescription;
  /** 隔离节点首次编译会等待远端结果，调用方应使用 await，不需要重试。 */
  prepare(request: GraphCompileRequest): Record<string, unknown> | Promise<Record<string, unknown>>;
}
export interface GraphCompileRequest {
  document: CompilationDocument;
  target: "glsl-430" | "glsl-es-300";
  stage: "vertex" | "fragment";
  nodeId?: string | null;
  sockets?: string[] | null;
}
/** GLSL 后端跨语言协议，调用者应 await 并检查 ok。 */
export interface ShaderBackendApi {
  emit(request: {
    target: "glsl-430" | "glsl-es-300";
    module: Record<string, JsonValue>;
  }): Promise<{
    ok: boolean;
    source: string;
    diagnostics: Record<string, JsonValue>[];
    reflection: Record<string, JsonValue>;
    sourceMap: Record<string, JsonValue>[];
  }>;
}
/** 编译前端只解释图和几何。config 是透传给调用方的 JSON，目标专属字段由目标自行校验。 */
export interface CompilationDocument {
  config: Record<string, JsonValue>;
  fragment: GraphSnapshot;
  geometry: Record<string, JsonValue>;
}
/** 参数和纹理仍是语义描述，不包含 Java 类型、BoxUtil 结构或 SSBO 槽位。 */
export interface CompilationDescription {
  config: Record<string, JsonValue>;
  geometry: Record<string, JsonValue>;
  inputs: Record<string, JsonValue>[];
  textures: Record<string, JsonValue>[];
  uniforms: { name: string; type: string; scope: string; source: string }[];
}

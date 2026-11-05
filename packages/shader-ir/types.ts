/** 编译目标是协议值，与应用发布版本分开。 */
export type ShaderTarget = "glsl-es-300" | "glsl-430";
export type ShaderStage = "vertex" | "fragment";
/** 标量/向量使用 SDK 大写类型名，用户结构类型保留声明的大小写。 */
export type ShaderType = string;
/** 用于将验证错误及驱动源码行号回溯到节点。 */
export interface ShaderOrigin {
  stage: ShaderStage;
  nodeId: string;
  socket?: string;
}
export type ShaderExpression =
  | { kind: "literal"; type: ShaderType; value: number | boolean }
  | { kind: "symbol" | "ref"; type: ShaderType; name: string }
  | {
      kind: "binary";
      type: ShaderType;
      operator: string;
      left: ShaderExpression;
      right: ShaderExpression;
    }
  | {
      kind: "unary";
      type: ShaderType;
      operator: string;
      value: ShaderExpression;
    }
  | { kind: "call"; type: ShaderType; name: string; args: ShaderExpression[] }
  | {
      kind: "block";
      type: ShaderType;
      names: string[];
      args: ShaderExpression[];
    }
  | {
      kind: "swizzle";
      type: ShaderType;
      fields: string;
      args: [ShaderExpression];
    }
  | { kind: "member"; type: ShaderType; field: string; value: ShaderExpression }
  | {
      kind: "index";
      type: ShaderType;
      value: ShaderExpression;
      index: ShaderExpression;
    }
  | {
      kind: "select";
      type: ShaderType;
      condition: ShaderExpression;
      yes: ShaderExpression;
      no: ShaderExpression;
    };
/** 所有语句使用词法作用域，局部声明不能被另一个分支或块外引用。 */
export type ShaderStatement = { origin?: ShaderOrigin } & (
  | { kind: "declare"; name: string; type: ShaderType; value: ShaderExpression }
  | { kind: "assign"; to: ShaderExpression; value: ShaderExpression }
  | { kind: "call"; value: ShaderExpression }
  | { kind: "return"; value?: ShaderExpression }
  | {
      kind: "if";
      condition: ShaderExpression;
      yes: ShaderStatement[];
      no?: ShaderStatement[];
    }
  | {
      kind: "for";
      index: string;
      count: ShaderExpression;
      body: ShaderStatement[];
    }
);
export interface ShaderMember {
  name: string;
  type: ShaderType;
}
export type ShaderResource = { origin?: ShaderOrigin } & (
  | {
      storage: "in" | "out" | "uniform" | "const";
      name: string;
      type: ShaderType;
      flat?: boolean;
      location?: number;
      value?: ShaderExpression;
    }
  | {
      storage: "buffer" | "uniformBlock";
      name: string;
      layout: "std140" | "std430";
      binding?: number;
      readonly?: boolean;
      members: (ShaderMember & { array?: boolean })[];
    }
);
export interface ShaderParameter extends ShaderMember {
  qualifier: "in" | "out" | "inout";
}
export type ShaderFunction = {
  name: string;
  returns: ShaderType;
  parameters: ShaderParameter[];
  origin?: ShaderOrigin;
} & (
  | { raw?: false; body: ShaderStatement[] }
  /** 原始 GLSL 不具备跨语言可移植性，必须显式声明目标，正文仍由 GL 驱动检查。 */
  | { raw: true; code: string; helpers?: string; targets: ShaderTarget[] }
);
/** 完整后端输入。禁止 input 占位符、函数回调、DOM、编辑器或 GPU 对象。 */
export interface ShaderModuleIR {
  schemaVersion: 1;
  stage: ShaderStage;
  structs: { name: string; members: ShaderMember[] }[];
  resources: ShaderResource[];
  functions: ShaderFunction[];
  body: ShaderStatement[];
}
export interface ShaderDiagnostic {
  code: string;
  message: string;
  origin?: ShaderOrigin;
}
export interface ShaderEmission {
  ok: boolean;
  source: string;
  diagnostics: ShaderDiagnostic[];
  reflection: {
    stage?: ShaderStage;
    target?: ShaderTarget;
    resources?: ShaderResource[];
  };
  /** 行号从 1 开始，只映射具有明确节点来源的行。 */
  sourceMap: ({ line: number } & ShaderOrigin)[];
}
/** 实现者可使用 JS、Worker、WASM 或进程，调用方始终 await 纯 JSON 结果。 */
export interface ShaderBackend {
  emit(request: {
    module: ShaderModuleIR;
    target: ShaderTarget;
  }): Promise<ShaderEmission>;
}

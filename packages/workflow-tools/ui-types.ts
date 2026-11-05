import type {
  WorkflowSnapshot,
  GraphCommand,
  ApplicationCommand,
} from "../plugin-sdk/types";
import type {
  GraphNode,
  NodeDefinition,
  PortDefinition,
  UiApi,
} from "../plugin-sdk/types";
/** 展示数据递归只读，运行时由视图插件冻结，扩展只能经回调提交意图。 */
export type ViewData<T> = T extends object
  ? { readonly [K in keyof T]: ViewData<T[K]> }
  : T;
export interface NodePresentation {
  node: GraphNode;
  definition: NodeDefinition & { missing?: boolean };
  description: string;
  fields: InspectorField[];
  missing: boolean;
}
/** 节点渲染器的公开 props，preview 命名插槽由工作流视图提供。 */
export interface NodeRendererProps {
  controls: UiApi["components"];
  entry: ViewData<NodePresentation>;
  position: Readonly<{ x: number; y: number }>;
  selected: boolean;
  pending: Readonly<{ direction: "input" | "output"; type: string }> | null;
  onNodeDown(event: PointerEvent, node: ViewData<GraphNode>): void;
  onPortDown(
    event: PointerEvent,
    port: {
      nodeId: string;
      socket: string;
      direction: "input" | "output";
      type: string;
    },
  ): void;
  onContext(event: MouseEvent, nodeId: string): void;
}
/** 端口组件的公开 props，定位锚点需遵循 P5_UI_V1.md 的 data-port-id 契约。 */
export interface PortRendererProps {
  nodeId: string;
  port: ViewData<PortDefinition>;
  direction: "input" | "output";
  compatible: boolean;
  onPortDown: NodeRendererProps["onPortDown"];
}
/** 每个字段实例持有自己的草稿，onCommit 校验文档、阶段和修订，失败抛出中文诊断。 */
export interface FieldRendererProps {
  controls: UiApi["components"];
  nodeId: string;
  field: ViewData<InspectorField>;
  onCommit(value: unknown): Promise<unknown>;
}
import type {InspectorField} from '../plugin-sdk/types';
export type {InspectorField} from '../plugin-sdk/types';
/** 平台的只读语义投影，写入仍调用 workflow.editor.execute 的修订守卫。 */
export interface PresentationApi {
  snapshot(): {
    nodes: {
      node: WorkflowSnapshot["graph"]["nodes"][number];
      definition: Record<string, unknown>;
      description: string;
      fields: InspectorField[];
      missing: boolean;
    }[];
    catalog: WorkflowSnapshot["catalog"];
    types: { value: string; label: string }[];
    parameters: Record<string, unknown>[];
  };
  edit(request: { nodeId: string; key: string; value: unknown }): {
    commands?: GraphCommand[];
    actions?: ApplicationCommand[];
  };
  /** 更新宿主状态栏，不修改工作流。 */
  report(request: { message: string }): void;
  /** 用户在当前视图操作时激活对应 MCP 草稿。后台同步不得调用。 */
  activity(): void;
}

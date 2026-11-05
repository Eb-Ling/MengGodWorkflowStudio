/** 受控开关：使用 v-model，label 同时作为默认文字和无障碍名称。 */
export interface UiToggleProps {
  modelValue: boolean;
  disabled?: boolean;
  label?: string;
}

/** 可调整分栏：使用 v-model:size，first/second 插槽承载内容，尺寸单位为 CSS 像素。 */
export interface UiSplitViewProps {
  /** 默认固定 first 插槽，reverse 为 true 时固定 second 插槽。 */
  size?: number;
  min?: number;
  max?: number;
  /** 为另一侧保留的最小空间，窗口缩小时尺寸按可用空间夹取。 */
  reserve?: number;
  /** true 为上下排列，false 为左右排列。 */
  vertical?: boolean;
  reverse?: boolean;
  label?: string;
}

/** 面板容器：默认插槽承载内容，actions 插槽追加标题栏操作。 */
export interface UiDockProps {
  title: string;
  /** 提供此属性时使用 v-model:collapsed，否则由组件自行管理收起状态。 */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  side?: "left" | "right" | "bottom";
  /** 收起时显示窄侧栏标题，仅用于工作区左右主面板。 */
  rail?: boolean;
}

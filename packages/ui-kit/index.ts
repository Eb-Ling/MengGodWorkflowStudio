import UiToggle from "./components/UiToggle.vue";
import UiDrawingSurface from "./components/UiDrawingSurface.vue";
export { UiDrawingSurface };
import UiSectionHeading from "./components/UiSectionHeading.vue";
import UiCloseButton from "./components/UiCloseButton.vue";
export { UiCloseButton };
export { UiSectionHeading };
import UiSplitView from "./components/UiSplitView.vue";
import UiDock from "./components/UiDock.vue";
export { UiToggle, UiSplitView, UiDock };
export type { UiToggleProps, UiSplitViewProps, UiDockProps } from "./types";
import UiButton from "./components/UiButton.vue";
import UiPanel from "./components/UiPanel.vue";
import UiDisclosure from "./components/UiDisclosure.vue";
import UiField from "./components/UiField.vue";
import UiDialog from "./components/UiDialog.vue";
import UiInput from "./components/UiInput.vue";
import UiCheckbox from "./components/UiCheckbox.vue";
import UiSelect from "./components/UiSelect.vue";
import UiTextarea from "./components/UiTextarea.vue";
import UiFileInput from "./components/UiFileInput.vue";
import UiTabs from "./components/UiTabs.vue";
import UiMenu from "./components/UiMenu.vue";
import UiTooltip from "./components/UiTooltip.vue";
import UiRenderer from "./components/UiRenderer.vue";
import AppFrame from "./components/AppFrame.vue";
import ThemeProvider from "./components/ThemeProvider.vue";

// 受信任 UI 的公共组件入口，插件通过 studio.ui 使用，不导入实现路径。
export { UiButton, UiPanel, UiField, UiDialog, AppFrame, ThemeProvider };
export { UiDisclosure };
export { UiInput, UiCheckbox };
export {
  UiSelect,
  UiTextarea,
  UiFileInput,
  UiTabs,
  UiMenu,
  UiTooltip,
  UiRenderer,
};
export const uiComponents = Object.freeze({
  UiDrawingSurface,
  UiCloseButton,
  UiSectionHeading,
  UiToggle,
  UiSplitView,
  UiDock,
  UiButton,
  UiPanel,
  UiDisclosure,
  UiField,
  UiDialog,
  UiInput,
  UiCheckbox,
  UiSelect,
  UiTextarea,
  UiFileInput,
  UiTabs,
  UiMenu,
  UiTooltip,
  UiRenderer,
  AppFrame,
});
export type { UiInstance, ComponentDefinition } from "./component-registry";

export { default as ExtensionPanel } from "./components/ExtensionPanel.vue";
export { createComponentRegistry } from "./component-registry";

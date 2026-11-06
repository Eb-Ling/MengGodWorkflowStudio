import { componentType } from "../../packages/workflow-tools/custom-component-import.mjs";
import { createPluginSettings } from "../application/plugin-settings.mjs";

/** 一次接收既有组件定义，不覆盖插件后续手动修改或清空的库。 */
export function adoptCustomSettings(storage) {
  const settings = createPluginSettings(storage, "custom.glsl");
  if (
    settings.get("components") !== null ||
    settings.get("initial-import") !== null
  )
    return;
  const old = storage.getItem("workflow.customNodes"),
    overrides = storage.getItem("workflow.customNodeOverrides");
  if (!old && !overrides) return;
  const values = [
    ...Object.values(JSON.parse(overrides || "{}")),
    ...JSON.parse(old || "[]"),
  ];
  settings.set(
    "initial-import",
    JSON.stringify(
      values.map((d) => ({ ...d, typeId: componentType(d.typeId) })),
    ),
  );
}

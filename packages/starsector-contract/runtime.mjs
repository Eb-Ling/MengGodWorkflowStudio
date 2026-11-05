import { validJavaIdentifier } from "./parameters.mjs";
export const runtimeDependency = {
  api: 3,
  revision: "3",
  className: "WorkflowRuntime",
  defaultPath: "data/method",
};
export function runtimePackage(value) {
  const packageName = String(value ?? runtimeDependency.defaultPath)
    .trim()
    .replaceAll("\\", "/")
    .replaceAll("/", ".");
  if (
    !packageName ||
    packageName.split(".").some((part) => !validJavaIdentifier(part))
  )
    throw new Error(
      "请输入有效的 Java 源码包路径，例如 data/method 或 data.method，不能包含 ..、空格、盘符或 Java 关键字。",
    );
  return packageName;
}
export const runtimeSourcePath = (value) =>
  runtimePackage(value).replaceAll(".", "/") +
  "/" +
  runtimeDependency.className +
  ".java";
export function dependencySource(template, value) {
  return template.replace(
    /^package [^;]+;/,
    `package ${runtimePackage(value)};`,
  );
}
export const dependencyExportKey = (value) =>
  runtimePackage(value) + "@" + runtimeDependency.revision;
export function dependencyExportState(value, history = {}) {
  if (history?.[dependencyExportKey(value)]) return "current";
  const prefix = runtimePackage(value) + "@";
  return Object.keys(history || {}).some(
    (key) => key.startsWith(prefix) && history[key],
  )
    ? "outdated"
    : "missing";
}

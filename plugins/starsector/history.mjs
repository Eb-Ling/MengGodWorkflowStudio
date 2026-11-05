import {
  runtimePackage,
  dependencyExportKey,
  dependencyExportState,
} from "../../packages/starsector-contract/runtime.mjs";
/** 运行依赖下载记录的存储适配，不持有 UI、生成器或文件系统。 */
export function createRuntimeHistory(storage) {
  const read = () => {
    try {
      return JSON.parse(
        storage.getItem("workflow.runtimeDependencyExports") || "{}",
      );
    } catch {
      return {};
    }
  };
  return {
    status({ path }) {
      const packageName = runtimePackage(path);
      return {
        path: packageName.replaceAll(".", "/"),
        packageName,
        state: dependencyExportState(packageName, read()),
      };
    },
    /** 仅在用户开始下载当前版本依赖后记录，不是“已安装到 Mod”的证明。 */
    recordExport({ path }) {
      const history = read();
      history[dependencyExportKey(path)] = true;
      storage.setItem(
        "workflow.runtimeDependencyExports",
        JSON.stringify(history),
      );
    },
  };
}

const { ipcMain, dialog, BrowserWindow } = require("electron");
/** 仅主界面持有项目 IO 桥，原生路径只能由系统选择器登记。 */
function installProjectController({ repository, isAllowed }) {
  const check = (event) => {
    if (!isAllowed(event) || event.senderFrame !== event.sender.mainFrame)
      throw Error("工作流文件调用来源无效");
  };
  const result = async (fn) => {
    try {
      return { ok: true, value: await fn() };
    } catch (e) {
      return { ok: false, error: e.message, code: e.code, version: e.version };
    }
  };
  ipcMain.handle("workflowDesktop:projects", (event, method, input = {}) =>
    result(async () => {
      check(event);
      if (method === "selectedFile") return repository.grant(input.path);
      if (method === "chooseOpen" || method === "chooseSave") {
        const window = BrowserWindow.fromWebContents(event.sender),
          filters = [{ name: "工作流文件", extensions: ["workflow.json"] }];
        const choice =
          method === "chooseOpen"
            ? await dialog.showOpenDialog(window, {
                title: "打开工作流文件",
                filters,
                properties: ["openFile"],
              })
            : await dialog.showSaveDialog(window, {
                title: "另存工作流文件",
                filters,
                defaultPath: "未命名.workflow.json",
              });
        if (choice.canceled) return null;
        return repository.grant(choice.filePath || choice.filePaths[0]);
      }
      if (method === "list") return repository.list();
      if (method === "recoveries") return repository.recoveries();
      if (method === "read" || method === "backup")
        return repository[method](input.fileId);
      if (method === "recover") return repository.recover(input.recoveryId);
      if (method === "write") return repository.write(input);
      throw Error("未知工作流文件操作");
    }),
  );
  const listener = (event, input) => {
    try {
      check(event);
      repository.checkpoint(input);
      event.returnValue = { ok: true };
    } catch (e) {
      event.returnValue = { ok: false, error: e.message };
    }
  };
  ipcMain.on("workflowDesktop:projectCheckpoint", listener);
  return () => {
    ipcMain.removeHandler("workflowDesktop:projects");
    ipcMain.removeListener("workflowDesktop:projectCheckpoint", listener);
  };
}
module.exports = { installProjectController };

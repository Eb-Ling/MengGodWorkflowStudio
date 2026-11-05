const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const {
  createExtensionRunner,
} = require("../extension-host/electron-runner.cjs");
const requestPath = process.argv
  .find((s) => s.startsWith("--request="))
  ?.slice(10);
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  let input;
  try {
    input = JSON.parse(await fs.readFile(requestPath, "utf8"));
    const { inspectPlugin } = await import("./index.mjs");
    const { runSandboxSuite } = await import("./sandbox-suite.mjs");
    const bundles = await Promise.all(input.directories.map(inspectPlugin));
    const report = await runSandboxSuite(bundles, {
      ...input.options,
      createRunner: createExtensionRunner,
      // 只观测测试进程，工作集不是泄漏证明，也不是资源配额。
      measure: () => ({
        elapsedMs: Math.round(performance.now()),
        mainRssBytes: process.memoryUsage().rss,
        windows: BrowserWindow.getAllWindows().length,
        processes: app
          .getAppMetrics()
          .map(({ type, memory }) => ({
            type,
            workingSetKB: memory.workingSetSize,
          })),
      }),
    });
    if (BrowserWindow.getAllWindows().length) throw Error("隔离窗口未释放");
    await fs.writeFile(
      input.output,
      JSON.stringify({ ...report, remainingWindows: 0 }, null, 2),
    );
    app.exit(0);
  } catch (error) {
    if (input?.output)
      await fs.writeFile(
        input.output,
        JSON.stringify(
          {
            ...error.testReport,
            ok: false,
            mode: "electron-sandbox",
            error: String(error.stack),
            remainingWindows: BrowserWindow.getAllWindows().length,
          },
          null,
          2,
        ),
      );
    app.exit(1);
  }
});

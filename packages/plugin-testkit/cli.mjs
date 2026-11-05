import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inspectPlugin, checkPluginSet, checkPluginMatrix } from "./index.mjs";

/** 开发工具 CLI。check 不执行代码，smoke 仅通过显式指定的 Electron 沙箱加载。 */
async function main() {
  const [mode, ...args] = process.argv.slice(2),
    directories = [],
    options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (
        !["electron", "output", "fixtures"].includes(key) ||
        !args[i + 1] ||
        Object.hasOwn(options, key)
      )
        throw Error("未知或重复选项：" + args[i]);
      options[key] = args[++i];
    } else directories.push(path.resolve(args[i]));
  }
  if (
    !["check", "matrix", "smoke"].includes(mode) ||
    !directories.length ||
    directories.length > 16
  )
    throw Error(
      "用法：node packages/plugin-testkit/cli.mjs check|matrix|smoke <目录...> [--output report.json] [--fixtures fixtures.json] [--electron electron.exe]",
    );
  const fixture = options.fixtures
    ? JSON.parse(await fs.readFile(options.fixtures, "utf8"))
    : {};
  if (mode === "check" || mode === "matrix")
    return (mode === "matrix" ? checkPluginMatrix : checkPluginSet)(
      await Promise.all(directories.map(inspectPlugin)),
      fixture,
    );
  if (!options.electron)
    throw Error(
      "smoke 需要 --electron 指定 Electron 运行时的 electron.exe（不是已打包的 Studio EXE）",
    );
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-testkit-"));
  try {
    const output = path.join(temp, "result.json"),
      request = path.join(temp, "request.json");
    await fs.writeFile(
      request,
      JSON.stringify({ directories, options: fixture, output }),
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    let failure;
    try {
      await promisify(execFile)(
        path.resolve(options.electron),
        [
          path.join(import.meta.dirname, "electron-main.cjs"),
          "--request=" + request,
        ],
        { env, windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 },
      );
    } catch (error) {
      failure = error;
    }
    const report = await fs
      .readFile(output, "utf8")
      .then(JSON.parse, () => null);
    if (!report)
      throw Error("测试进程没有生成报告：" + String(failure?.message || ""));
    return report;
  } finally {
    // 只清除由本次 mkdtemp 创建的目录，从不删除用户插件或指定输出。
    if (
      path.dirname(temp) !== path.resolve(os.tmpdir()) ||
      !path.basename(temp).startsWith("workflow-testkit-")
    )
      throw Error("临时目录边界错误");
    await fs.rm(temp, { recursive: true, force: true });
  }
}
const outputAt = process.argv.indexOf("--output"),
  output = outputAt >= 0 ? process.argv[outputAt + 1] : null;
let report;
try {
  report = await main();
} catch (error) {
  report = { ok: false, error: String(error.message || error) };
}
if (output) {
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;

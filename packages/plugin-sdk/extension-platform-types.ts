/** 每个插件独占一个数据命名空间，停用立即撤销接口，异步结果均为 JSON。 */
export interface ExtensionPlatformApi {
  /** 读取自己保存的 UTF-8 文本，名称仅允许英数、横线、下划线及 .json/.txt 后缀。不存在返回 null。 */
  readText(name: string): Promise<string | null>;
  /** 原子保存到自己的数据目录，单文件 64 KiB，最多 32 文件、总计 1 MiB。 */
  writeText(name: string, text: string): Promise<null>;
  /** 只对安装授权的 HTTPS 来源执行 GET，不发 cookies、不跟随重定向，拒绝内网地址，返回最多 256 KiB UTF-8 文本。 */
  fetchText(url: string): Promise<{ status: number; text: string }>;
  /** 在宿主独立短进程执行固定任务，不接受脚本、命令行、可执行路径。输入最多 256 KiB。 */
  runTask(task: 'sha256' | 'validate-json', input: string): Promise<{ sha256: string } | { valid: boolean; error?: string }>;
}

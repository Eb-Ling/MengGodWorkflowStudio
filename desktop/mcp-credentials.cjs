const fs = require("node:fs");
const path = require("node:path");

/** 当前系统用户的持久接入授权，凭据由桌面安全存储加密，不进入工作流文件。 */
function createMcpCredentials({ file, secureStorage }) {
  function read() {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    const saved = JSON.parse(content);
    if (saved.version !== 1 || typeof saved.encrypted !== "string")
      throw Error("MCP 授权记录无效，请撤销后重新配置");
    if (!secureStorage.isEncryptionAvailable())
      throw Error("系统安全存储暂不可用");
    const value = JSON.parse(
      secureStorage.decryptString(Buffer.from(saved.encrypted, "base64")),
    );
    if (
      !/^[a-f0-9]{64}$/.test(value.token) ||
      !["read", "write"].includes(value.mode)
    )
      throw Error("MCP 授权记录无效，请撤销后重新配置");
    return value;
  }
  return {
    read,
    write(value) {
      if (!secureStorage.isEncryptionAvailable())
        throw Error("系统安全存储暂不可用，无法保存接入授权");
      const encrypted = secureStorage
        .encryptString(JSON.stringify(value))
        .toString("base64");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(
        file + ".tmp",
        JSON.stringify({ version: 1, encrypted }),
      );
      fs.renameSync(file + ".tmp", file);
    },
    clear() {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
  };
}
module.exports = { createMcpCredentials };

const { spawn } = require("node:child_process");

// Generic native transport. Plugin-specific tools and checks stay in the plugin.
exports.openStdioClient = function ({
  executablePath,
  entry,
  env = {},
  timeoutMs = 12000,
}) {
  const child = spawn(executablePath, [entry], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const pending = new Map();
  let nextId = 1,
    buffer = "",
    stderr = "",
    closed = false;
  function rejectAll(error) {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
  }
  child.on("error", rejectAll);
  child.on("exit", () => {
    closed = true;
    rejectAll(new Error("stdio 服务已退出" + (stderr ? ": " + stderr : "")));
  });
  child.stdin.on("error", rejectAll);
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + String(chunk)).slice(-4000);
  });
  child.stdout.on("data", (chunk) => {
    buffer += String(chunk);
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      try {
        const message = JSON.parse(line),
          item = pending.get(message.id);
        if (!item) continue;
        clearTimeout(item.timer);
        pending.delete(message.id);
        if (message.error) item.reject(new Error(message.error.message));
        else item.resolve(message.result);
      } catch (error) {
        rejectAll(error);
      }
    }
  });
  return {
    request(method, params = {}) {
      if (closed) return Promise.reject(new Error("stdio 服务已关闭"));
      return new Promise((resolve, reject) => {
        const id = nextId++,
          timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error("stdio 请求超时：" + method));
          }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(
          JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
        );
      });
    },
    notify(method, params = {}) {
      if (!closed)
        child.stdin.write(
          JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n",
        );
    },
    close() {
      if (closed) return;
      closed = true;
      rejectAll(new Error("stdio 客户端已关闭"));
      child.stdin.end();
      child.kill();
    },
  };
};

/** 将常见 GL 驱动日志行号映射回节点，未知日志格式保留原文，不猜测来源。 */
export function formatShaderLog(log, sourceMap = [], stage = "") {
  return String(log)
    .split("\n")
    .map((line) => {
      const match = /(?:ERROR:\s*\d+:(\d+):|\b\d+\((\d+)\)\s*:)/.exec(line);
      if (!match) return line;
      const sourceLine = Number(match[1] || match[2]);
      const origin = sourceMap.find((entry) => entry.line === sourceLine);
      if (!origin?.nodeId) return line;
      return `[${origin.stage || stage} 节点 ${origin.nodeId}${origin.socket ? " / " + origin.socket : ""}] ${line}`;
    })
    .join("\n");
}

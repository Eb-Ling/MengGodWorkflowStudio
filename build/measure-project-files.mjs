// 文件 IO 实测，仅创建自己的临时项目，不操作用户项目或编辑器状态。
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createProjectFiles } from "../packages/native-host/project-files.mjs";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-p7-measure-"));
const out = path.resolve(
  process.argv[2] || "build/verification/p7-storage-performance.json",
);
const results = [];
const distribution = (values) => {
  values.sort((a, b) => a - b);
  return {
    medianMs: values[Math.floor(values.length / 2)],
    p95Ms: values[Math.ceil(values.length * 0.95) - 1],
    maxMs: values.at(-1),
  };
};
try {
  const repo = createProjectFiles({ root: path.join(root, "profile") });
  for (const size of [64 * 1024, 1024 * 1024]) {
    let ref = await repo.grant(path.join(root, size + ".workflow.json"));
    const save = [],
      read = [],
      checkpoint = [],
      id = crypto.randomUUID();
    for (let i = 0; i < 30; i++) {
      const text = JSON.stringify({ iteration: i, data: "x".repeat(size) });
      let begin = performance.now();
      ref = await repo.write({
        fileId: ref.fileId,
        expectedVersion: ref.version,
        text,
      });
      save.push(performance.now() - begin);
      begin = performance.now();
      await repo.read(ref.fileId);
      read.push(performance.now() - begin);
      begin = performance.now();
      repo.checkpoint({
        id,
        record: { document: JSON.parse(text), baseline: text, file: ref },
      });
      checkpoint.push(performance.now() - begin);
    }
    results.push({
      payloadBytes: size,
      samples: 30,
      save: distribution(save),
      read: distribution(read),
      checkpoint: distribution(checkpoint),
    });
  }
  const result = {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    results,
    scope:
      "本机临时目录，包含 fsync，不代表网络盘或断电保证。编译器与预览未修改。",
  };
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("workflow-p7-measure-")
  )
    throw Error("Unsafe cleanup");
  await fs.rm(root, { recursive: true, force: true });
}

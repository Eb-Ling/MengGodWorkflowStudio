// 只审计用户实际下载的文件，不调用生成器，也不替换下载内容。
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const hash = (text) => createHash("sha256").update(text).digest("hex");
async function report(root) {
  for (const file of ["desktop-report.json", "report.json"])
    try {
      return JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  throw Error("缺少真实用户路径报告");
}
async function walk(dir, result = []) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await walk(file, result);
    else result.push(file);
  }
  return result;
}
export async function auditExportContract(current, baseline) {
  const value = await report(current),
    prior = baseline ? await report(baseline) : null,
    artifacts = [];
  for (const item of value.downloads) {
    const files = await walk(item.directory);
    assert.equal(files.length, 3, item.name + " 必须恰好三个文件");
    const javaFile = files.find((f) => f.endsWith(".java")),
      vert = files.find((f) => f.endsWith(".vert")),
      frag = files.find((f) => f.endsWith(".frag"));
    assert.ok(javaFile && vert && frag);
    const java = await fs.readFile(javaFile, "utf8"),
      vs = await fs.readFile(vert, "utf8"),
      ps = await fs.readFile(frag, "utf8");
    assert.match(
      java,
      new RegExp(
        "public final class " + item.name + " extends WorkflowRuntime",
      ),
    );
    const signature = java.match(
      new RegExp("public " + item.name + "\\(([^)]*)\\)"),
    )?.[1];
    assert.ok(
      signature?.startsWith("CombatEngineLayers layer, List<Vector2f> positions"),
    );
    assert.match(
      java,
      /configuredInstances = new Instance\[positions.size\(\)\]/,
    );
    assert.match(
      java,
      /createInstance\(\).setPosition\(positions.get\(wf_index\)\)/,
    );
    const runtime = java.match(/import ([\w.]+)\.WorkflowRuntime;/)?.[1];
    assert.ok(runtime);
    for (const shader of [vert, frag])
      assert.ok(
        java.includes(
          '"' +
            path.relative(item.directory, shader).replaceAll("\\", "/") +
            '"',
        ),
        "Shader 路径与 Java 引用必须一致",
      );
    assert.ok(vs.startsWith("#version 430"));
    assert.ok(ps.startsWith("#version 430"));
    assert.doesNotMatch(ps, /gl_InstanceID/);
    assert.doesNotMatch(
      java,
      /import (?:workflowshader|studio\.|plugins\.)/,
      "特效不能依赖编辑器插件",
    );
    const before = prior?.downloads.find((d) => d.name === item.name),
      matches = [];
    if (prior) assert.ok(before, "基线缺少同名真实导出 " + item.name);
    if (before) {
      for (const file of files) {
        const relative = path.relative(item.directory, file),
          other = await fs.readFile(path.join(before.directory, relative));
        assert.equal(
          hash(await fs.readFile(file)),
          hash(other),
          item.name + "/" + relative + " 与已发布导出变化",
        );
        matches.push(relative);
      }
    }
    artifacts.push({
      name: item.name,
      signature,
      runtimePackage: runtime,
      files: files.map((file) => path.relative(item.directory, file)),
      baselineIdentical: before ? matches : undefined,
      sha256: Object.fromEntries(
        await Promise.all(
          files.map(async (file) => [
            path.relative(item.directory, file),
            hash(await fs.readFile(file)),
          ]),
        ),
      ),
    });
  }
  const dependencies = [];
  for (const source of value.dependencies || []) {
    const file = typeof source === "string" ? source : source.source,
      text = await fs.readFile(file, "utf8");
    assert.ok(
      /public abstract class WorkflowRuntime implements CombatLayeredRenderingPlugin/.test(
        text,
      ),
      "依赖必须直接实现 Starsector 分层插件接口",
    );
    assert.ok(
      /void render\(CombatEngineLayers layer,\s*ViewportAPI viewport\)/.test(
        text,
      ),
      "依赖必须提供分层渲染入口",
    );
    const pkg = text.match(/package ([\w.]+);/)?.[1];
    if (prior) {
      const old = await Promise.all(
        (prior.dependencies || []).map(async (entry) =>
          fs.readFile(typeof entry === "string" ? entry : entry.source, "utf8"),
        ),
      );
      assert.ok(
        old.some(
          (candidate) =>
            candidate.match(/package ([\w.]+);/)?.[1] === pkg &&
            hash(candidate) === hash(text),
        ),
        "运行依赖必须与基线逐字一致",
      );
    }
    dependencies.push({ file, package: pkg, sha256: hash(text) });
  }
  const result = {
    ok: true,
    mode: "actual user downloads only",
    current,
    baseline,
    artifacts,
    dependencies,
  };
  await fs.writeFile(
    path.join(current, "starsector-contract.json"),
    JSON.stringify(result, null, 2),
  );
  return result;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const result = await auditExportContract(
    path.resolve(process.argv[2]),
    process.argv[3] ? path.resolve(process.argv[3]) : undefined,
  );
  console.log(
    `PASS: ${result.artifacts.length} 份三文件 Starsector 导出、单入口构造器和依赖格式${result.baseline ? "，全部与基线逐字一致" : ""}`,
  );
}

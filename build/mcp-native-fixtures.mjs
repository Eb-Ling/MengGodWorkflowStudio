// 由调用方提供已获授权的公开 MCP 客户端，不能导入生成器或直接修改工作流文件。
import assert from "node:assert/strict";
import { acceptanceSession } from "./final-mcp-acceptance.mjs";

/**
 * 用户授权回归测试后创建两个独立工作流，返回原始源码供 Java 17 与原生 GL 验证。
 * 不保存到 Mod，不修改返回源码，清理由调用方通过公开工具完成。
 */
export async function createNativeExportFixtures(client, prefix) {
  assert.match(prefix, /^[A-Za-z_][A-Za-z0-9_]*$/);
  const session = acceptanceSession(client);
  const ids = [prefix + "_single", prefix + "_batch"];
  const targets = (await session.call("workflow_list_workflows")).workflows;
  assert.ok(ids.every(id => !targets.some(target => target.id === id)), "回归 ID 已存在");
  const results = [];

  for (const [index, className] of ["FinalNativeSingle", "FinalBatch"].entries()) {
    await session.mutate("workflow_create", {
      id: ids[index],
      title: "MCP 原生回归 " + className,
      className,
      previewWidth: 256,
      previewHeight: 256,
    });
    await session.mutate("workflow_set_stage", { targetStage: "fragment" });
    if (index === 0) {
      await session.replace([
        session.add("tint", "studio.math.constant", { valueType: "VEC4", value: "0.2,0.5,0.9,0.65" }),
        session.add("output", "io.output", {}, 450, 60),
        session.link("tint", "value", "output", "color"),
        { type: "SET_OUTPUT", payload: { nodeId: "output" } },
      ]);
      await session.mutate("workflow_set_vertex_transform", {
        vertices: [[-200, -200], [200, -200], [-200, 200], [200, 200]],
      });
    } else {
      await session.replace(session.colorGraph());
      await session.mutate("workflow_set_vertex_transform", {
        vertices: [[-128, -128], [128, -128], [-128, 128], [128, 128]],
        instanceInputs: { sx: { enabled: true, id: "scale" }, rotation: { enabled: true, id: "spin" } },
        parameterModes: { u_color: "instance" },
      });
    }
    const dependency = await session.mutate("workflow_export_runtime_dependency", {
      runtimePath: index === 0 ? "data/methods" : "data/custom/effects",
    });
    const files = await session.exportEffect();
    assert.equal(files.java.filename, "src/data/scripts/" + className + ".java");
    await session.frame({ width: 256, height: 256 });
    await session.mutate("workflow_save");
    results.push({ id: ids[index], className, dependency, files });
  }
  return { results, report: session.report() };
}

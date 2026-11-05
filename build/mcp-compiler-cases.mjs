import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
/** 此阶段只调用公开 MCP，返回的文件原样保存供 Java/GL 驱动检查。 */
export async function compilerCases({ tool, mutate, guards, add, link, out }) {
  const results = [];
  for (const mode of ["Loop", "IfTrue", "IfFalse"]) {
    const name = "Mcp" + mode + "Effect";
    await mutate("workflow_create", {
      title: "模块 IR " + mode,
      className: name,
      previewWidth: 128,
      previewHeight: 128,
    });
    await mutate('workflow_set_stage',{targetStage:'fragment'});
    const old = await tool("workflow_get_summary");
    const custom = {
      typeId: "custom.mcp"+mode,
      title: "MCP module",
      properties: {
        parameters:
          mode === "Loop"
            ? [
                { name: "value", type: "FLOAT", qualifier: "inout" },
                { name: "color", type: "VEC4", qualifier: "out" },
              ]
            : [
                { name: "a", type: "FLOAT", qualifier: "in" },
                { name: "b", type: "FLOAT", qualifier: "in" },
                { name: "color", type: "VEC4", qualifier: "out" },
              ],
        code:
          mode === "Loop"
            ? "value = unitScale(value); color = vec4(value,0.0,0.0,1.0);"
            : "color = vec4(a,b,0.0,1.0);",
        helperSource:
          mode === "Loop" ? "float unitScale(float x) { return x / 6.0; }" : "",
        sourceTargets: ["glsl-es-300", "glsl-430"],
      },
    };
    await mutate("workflow_upsert_custom_node", { definition: custom });
    const commands = old.graph.nodes.map((n) => ({
      type: "REMOVE_NODE",
      payload: { nodeId: n.id },
    }));
    const constant = (id, valueType, value, x, y) =>
      add(id, "studio.math.constant", { valueType, value }, x, y);
    if (mode === "Loop")
      commands.push(
        constant("count", "FLOAT", "4", 0, 0),
        add("for", "logic.for", {}, 100, 100),
        add(
          "acc",
          "logic.variable",
          { valueType: "FLOAT", initialValue: "0" },
          130,
          200,
        ),
        add("add", "studio.math.add", { valueType: "FLOAT" }, 330, 200),
        link("count", "value", "for", "count"),
        link("acc", "value", "add", "a"),
        link("for", "i", "add", "b"),
        link("add", "value", "acc", "value"),
      );
    else
      commands.push(
        constant(
          "condition",
          "BOOL",
          mode === "IfTrue" ? "true" : "false",
          0,
          0,
        ),
        constant("one", "FLOAT", "1", 0, 600),
        add("if", "logic.if", {}, 100, 100),
        add(
          "a",
          "logic.variable",
          { valueType: "FLOAT", initialValue: "0" },
          150,
          180,
        ),
        add(
          "b",
          "logic.variable",
          { valueType: "FLOAT", initialValue: "0" },
          650,
          180,
        ),
        link("condition", "value", "if", "condition"),
        link("one", "value", "a", "value"),
        link("one", "value", "b", "value"),
      );
    commands.push(
      add("custom", "custom.mcp"+mode, {}, 950, 550),
      add("output", "io.output", {}, 1200, 550),
      link("custom", "color", "output", "color"),
      { type: "SET_OUTPUT", payload: { nodeId: "output" } },
    );
    if (mode === "Loop") commands.push(link("acc", "value", "custom", "value"));
    else
      commands.push(
        link("a", "value", "custom", "a"),
        link("b", "value", "custom", "b"),
      );
    await mutate("workflow_submit_commands", { commands });
    if (mode === "Loop") {
      custom.properties.sourceTargets = ["glsl-es-300"];
      await mutate("workflow_upsert_custom_node", { definition: custom });
      await tool(
        "workflow_export_runtime",
        guards(await tool("workflow_get_summary")),
        true,
      );
      custom.properties.sourceTargets = ["glsl-es-300", "glsl-430"];
      await mutate("workflow_upsert_custom_node", { definition: custom });
    }
    const files = await mutate("workflow_export_runtime");
    assert.equal(Object.keys(files).length, 3);
    const directory = path.join(out, "control-cases", name);
    for (const file of Object.values(files)) {
      const target = path.resolve(directory, file.filename);
      assert.ok(target.startsWith(directory + path.sep));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content);
    }
    assert.match(
      files.fragment.content,
      mode === "Loop" ? /for \(int/ : /if \(/,
    );
    results.push({
      name,
      directory,
      expectedColor: mode === "IfFalse" ? [0, 1, 0, 1] : [1, 0, 0, 1],
    });
    await mutate("workflow_save");
  }
  await fs.writeFile(
    path.join(out, "control-cases.json"),
    JSON.stringify(results, null, 2),
  );
  return results;
}

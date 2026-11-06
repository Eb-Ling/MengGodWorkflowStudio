import { copyJson } from "../../packages/plugin-sdk/schema.mjs";
import { normalizeTransform } from "../../packages/workflow-tools/geometry.mjs";

/** 应用适配只解析当前节点声明/端口与调用受检节点 IR，不生成 GLSL，不传私有对象。 */
export function createGraphSnapshotApi({ semantics, data, registry }) {
  const {
    nodeDef,
    dependencyIssue,
    validateStageGraph,
    validateGraphProperties,
    variableBranchOwner,
    typeKey,
  } = semantics;
  /** 返回本次实际涉及的提供者身份，不把函数或注册表交给编译消费者。 */
  function identity({ document, stage } = {}) {
    if (
      !document ||
      (stage !== undefined && !["vertex", "fragment"].includes(stage))
    )
      throw Error("编译身份请求缺少文档或阶段无效");
    const graphs =
      stage === "vertex"
        ? [normalizeTransform(document.geometry).graph]
        : stage === "fragment"
          ? [document.fragment]
          : [document.fragment, normalizeTransform(document.geometry).graph];
    return registry.identity(
      graphs.flatMap((graph) => graph.nodes.map((node) => node.typeId)),
    );
  }
  function describe(input) {
    const document = copyJson(input),
      geometry = normalizeTransform(document.geometry),
      fragment = document.fragment;
    if (!document.config || !fragment) throw Error("编译请求缺少文档");
    validateStageGraph(fragment, "fragment");
    validateStageGraph(geometry.graph, "vertex");
    validateGraphProperties(fragment);
    validateGraphProperties(geometry.graph);
    const inputs = [],
      textures = [],
      uniforms = [];
    for (const node of [...fragment.nodes, ...geometry.graph.nodes]) {
      if (node.typeId === "io.input") {
        const p = data.graphInputs({ nodes: [node] })[0];
        inputs.push(p);
        uniforms.push({
          name: p.name,
          type: p.type,
          scope: geometry.parameterModes[p.name] ?? p.scope,
          source: node.title || node.id,
        });
      }
      if (node.typeId === "input.texture") {
        const p = data.graphTextureInputs({ nodes: [node] })[0];
        textures.push({ ...p, type: "SAMPLER2D", scope: "shared" });
        uniforms.push(
          {
            name: p.name,
            type: "SAMPLER2D",
            scope: "shared",
            source: node.title || node.id,
          },
          {
            name: data.textureAspectUniformName(p.name),
            type: "VEC2",
            scope: "shared",
            source: node.id,
          },
        );
      }
    }
    return copyJson({
      config: document.config,
      geometry,
      inputs,
      textures,
      uniforms,
    });
  }
  /** @param {import('../../packages/plugin-sdk/pipeline-types').GraphCompileRequest} request */
  function prepare(request) {
    const { document, target, stage, nodeId = null, sockets = null } = request;
    if (
      !["glsl-es-300", "glsl-430"].includes(target) ||
      !["vertex", "fragment"].includes(stage)
    )
      throw Error("编译目标或阶段无效");
    const doc = copyJson(document),
      graph =
        stage === "vertex"
          ? normalizeTransform(doc.geometry).graph
          : doc.fragment;
    validateStageGraph(graph, stage);
    validateGraphProperties(graph);
    const final =
      graph.nodes.find((n) => n.id === (nodeId || graph.outputNodeId)) ||
      graph.nodes.find(
        (n) =>
          n.typeId === (stage === "vertex" ? "vertex.output" : "io.output"),
      );
    if (!final)
      throw Error("缺少" + (stage === "vertex" ? "顶点" : "片段") + "输出");
    const wanted =
        sockets || (stage === "vertex" ? ["position", "uv"] : ["color"]),
      active = new Set();
    function visit(id) {
      if (active.has(id)) return;
      active.add(id);
      const n = graph.nodes.find((n) => n.id === id);
      if (!n) throw Error("连接源节点不存在：" + id);
      for (const l of graph.links.filter((l) => l.toNode === id))
        visit(l.fromNode);
      if (n.typeId === "logic.variable") {
        const owner = variableBranchOwner(graph, n);
        if (owner) {
          visit(owner.ownerId);
          for (const v of graph.nodes.filter(
            (n) =>
              n.typeId === "logic.variable" &&
              variableBranchOwner(graph, n)?.ownerId === owner.ownerId,
          ))
            visit(v.id);
        }
      }
    }
    visit(final.id);
    const nodes = [],
      compilations = [];
    for (const n of graph.nodes.filter((n) => active.has(n.id))) {
      const d = nodeDef(n);
      const issue = dependencyIssue(n, stage);
      if (!d || d.missing || issue)
        throw Error(
          issue?.message ||
            d?.diagnostic?.message ||
            "缺少节点插件：" + n.typeId,
        );
      const ports = (key) =>
        d[key].map((p) => ({
          name: p.name,
          type: typeKey(p.type) === "ANY" ? "FLOAT" : typeKey(p.type),
        }));
      const item = {
        node: n,
        inputs: ports("inputs"),
        outputs: ports("outputs"),
        branch:
          n.typeId === "logic.variable" ? variableBranchOwner(graph, n) : null,
        expressions: {},
      };
      if (d.glsl) {
        item.custom = {
          ...d.glsl,
          parameters: d.glsl.parameters.map(({ name, type, qualifier }) => ({
            name,
            type,
            qualifier,
          })),
          targets: d.targets,
        };
      } else if (registry.owner(n.typeId)?.id !== "studio.builtin") {
        for (const output of item.outputs)
          compilations.push({
            item,
            output,
            context: {
              node: n,
              socket: output.name,
              outputType: output.type,
              inputs: Object.fromEntries(
                item.inputs.map((p) => [p.name, p.type]),
              ),
              connectedInputs: graph.links
                .filter((l) => l.toNode === n.id)
                .map((l) => l.toSocket),
            },
          });
      }
      nodes.push(item);
    }
    if (["vertex.output", "io.output"].includes(final.typeId))
      for (const s of wanted)
        if (!graph.links.some((l) => l.toNode === final.id && l.toSocket === s))
          throw Error(
            (stage === "vertex" ? "顶点" : "片段") + "输出缺少连接：" + s,
          );
    const pending = [];
    // 先验证整个活动图，再等待所有隔离编译。调用方只收到完整且受检的快照。
    for (const { item, output, context } of compilations) {
      try {
        const result = registry.compile(item.node.typeId, target, context);
        if (result && typeof result.then === "function")
          pending.push(
            Promise.resolve(result).then((value) => {
              item.expressions[output.name] = value;
            }),
          );
        else item.expressions[output.name] = result;
      } catch (error) {
        // 保留同步规则的诊断，同时接管其他已发出的异步调用，避免悬空拒绝。
        if (!pending.length) throw error;
        pending.push(Promise.reject(error));
        break;
      }
    }
    const finish = () =>
      copyJson({
        target,
        stage,
        nodes,
        links: graph.links.filter(
          (l) => active.has(l.toNode) && active.has(l.fromNode),
        ),
        finalNode: final.id,
        sockets: wanted,
        inputs: data.graphInputs(graph).filter((p) => active.has(p.nodeId)),
        textures: data
          .graphTextureInputs(graph)
          .filter((p) => active.has(p.nodeId)),
      });
    return pending.length ? Promise.all(pending).then(finish) : finish();
  }
  return { describe, prepare, identity };
}

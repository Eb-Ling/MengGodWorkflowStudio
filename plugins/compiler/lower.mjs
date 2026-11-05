import {
  shader as s,
  constant,
  sourceName,
} from "../../packages/shader-ir/index.mjs";
import { copyJson } from "../../packages/plugin-sdk/schema.mjs";

/** 从已解析的图快照降低到语句/表达式 IR。没有 GLSL 字符串、回调或编辑器引用。 */
export function lowerGraph(snapshot) {
  const graph = copyJson(snapshot),
    records = new Map(graph.nodes.map((n) => [n.node.id, n])),
    refs = new Map(),
    visiting = new Set(),
    variables = new Set(),
    controls = new Set(),
    functions = new Map();
  let body = [];
  const names = new Set(
    graph.nodes.flatMap((r) =>
      [r.node.properties?.uniform, r.custom?.name].filter(Boolean),
    ),
  );
  const origin = (id, socket) => ({
    nodeId: id,
    stage: graph.stage,
    ...(socket ? { socket } : {}),
  });
  // 名称保留用户节点 ID 和输出端口，仅在清洗后碰撞时增加后缀。
  const local = (id, socket = "value") => {
    const base = ("wf_" + sourceName(id) + "_" + sourceName(socket)).replace(
      /_+/g,
      "_",
    );
    let name = base,
      index = 2;
    while (names.has(name)) name = base + "_" + index++;
    names.add(name);
    return name;
  };
  const link = (id, socket) =>
    graph.links.find((l) => l.toNode === id && l.toSocket === socket);
  const zero = (t) => constant(t, 0);
  const input = (r, socket) => {
    const l = link(r.node.id, socket),
      port = r.inputs.find((p) => p.name === socket);
    return l ? visit(l.fromNode, l.fromSocket) : zero(port?.type || "FLOAT");
  };
  const bind = (e, inputs) => {
    if (Array.isArray(e)) return e.map((x) => bind(x, inputs));
    if (e && typeof e === "object") {
      if (e.kind === "input") {
        if (!inputs[e.name]) throw Error("IR 输入不存在：" + e.name);
        return copyJson(inputs[e.name]);
      }
      return Object.fromEntries(
        Object.entries(e).map(([k, v]) => [k, bind(v, inputs)]),
      );
    }
    return e;
  };
  function variable(r) {
    if (variables.has(r.node.id)) return;
    const group = r.branch
      ? graph.nodes.filter(
          (x) =>
            x.node.typeId === "logic.variable" &&
            x.branch?.ownerId === r.branch.ownerId,
        )
      : [r];
    for (const v of group) {
      if (variables.has(v.node.id)) continue;
      variables.add(v.node.id);
      const t = v.outputs[0].type,
        n = local(v.node.id, "value"),
        initial = link(v.node.id, "init");
      const init = initial
        ? visit(initial.fromNode, initial.fromSocket)
        : constant(t, v.node.properties.initialValue ?? 0);
      refs.set(v.node.id + ":value", s.symbol(t, n));
      body.push(s.declare(n, t, init, origin(v.node.id)));
    }
    if (!r.branch || controls.has(r.branch.ownerId)) return;
    const control = records.get(r.branch.ownerId);
    if (!control) throw Error("变量作用域所属节点缺失");
    controls.add(control.node.id);
    const loop = control.node.typeId === "logic.for",
      condition = input(control, loop ? "count" : "condition"),
      index = local(control.node.id, "i");
    if (loop)
      refs.set(
        control.node.id + ":i",
        s.call("FLOAT", "float", s.symbol("INT", index)),
      );
    const collect = (branch) => {
      const outer = body,
        scopeRefs = new Map(refs);
      body = [];
      const members = group.filter((v) => v.branch?.branch === branch);
      // 先降低依赖表达式，再按文档顺序赋值，维持现有变量节点的执行顺序。
      const updates = members.map((v) => ({ v, value: input(v, "value") }));
      for (const { v, value } of updates)
        body.push(
          s.assign(refs.get(v.node.id + ":value"), value, origin(v.node.id)),
        );
      const result = body;
      body = outer;
      refs.clear();
      for (const [k, v] of scopeRefs) refs.set(k, v);
      return result;
    };
    if (loop)
      body.push({
        kind: "for",
        index,
        count: condition,
        body: collect("loop"),
        origin: origin(control.node.id),
      });
    else
      body.push({
        kind: "if",
        condition,
        yes: collect("true"),
        no: collect("false"),
        origin: origin(control.node.id),
      });
  }
  function visit(id, socket) {
    const key = id + ":" + socket;
    if (refs.has(key)) return refs.get(key);
    if (visiting.has(key)) throw Error("节点图存在循环：" + key);
    const r = records.get(id);
    if (!r) throw Error("缺少节点：" + id);
    const { node } = r,
      t =
        r.outputs.find((p) => p.name === socket)?.type ||
        r.inputs.find((p) => p.name === socket)?.type ||
        "FLOAT",
      o = origin(id, socket);
    visiting.add(key);
    let value;
    try {
      if (node.typeId === "logic.variable") {
        variable(r);
        return refs.get(key);
      }
      if (r.custom) {
        const f = r.custom;
        if (!f.targets.includes(graph.target))
          throw Error(
            "自定义 GLSL 节点 " +
              (node.title || id) +
              " 未声明支持目标：" +
              graph.target,
          );
        const name = sourceName(f.name),
          existing = functions.get(name);
        if (
          existing &&
          (JSON.stringify(existing.parameters) !==
            JSON.stringify(f.parameters) ||
            existing.code !== f.code ||
            existing.helpers !== f.helpers)
        )
          throw Error("自定义函数名称冲突：" + name);
        functions.set(name, {
          name,
          returns: "VOID",
          parameters: f.parameters,
          raw: true,
          code: f.code,
          helpers: f.helpers,
          targets: f.targets,
          origin: o,
        });
        const args = f.parameters.map((p) => {
          if (p.qualifier === "in") return input(r, p.name);
          const n = local(id, p.name),
            v = p.qualifier === "inout" ? input(r, p.name) : zero(p.type);
          body.push(s.declare(n, p.type, v, o));
          const ref = s.symbol(p.type, n);
          refs.set(id + ":" + p.name, ref);
          return ref;
        });
        body.push({
          kind: "call",
          value: s.call("VOID", name, ...args),
          origin: o,
        });
        return refs.get(key) || zero(t);
      }
      switch (node.typeId) {
        case "input.position":
          value = s.symbol("VEC2", "a_position");
          break;
        case "input.uv":
          value = s.symbol("VEC2", "v_uv");
          break;
        case "input.time":
          value = s.symbol("FLOAT", "u_time");
          break;
        case "io.input":
        case "input.texture":
          value = s.symbol(
            t,
            /^u_[A-Za-z0-9_]+$/.test(node.properties.uniform)
              ? node.properties.uniform
              : "u_value",
          );
          break;
        case "vertex.output":
          value = input(r, socket);
          break;
        case "io.output":
          value = input(r, "color");
          break;
        case "logic.for":
          throw Error("循环索引只能在所属循环体内使用：" + id);
        case "texture.sample2d": {
          const tex = input(r, "texture");
          if (tex.kind !== "symbol") throw Error("纹理采样需要纹理入口");
          value = s.call(
            "VEC4",
            "sampleTexture_" + sourceName(tex.name),
            tex,
            input(r, "uv"),
          );
          break;
        }
        case "logic.not":
          value = s.unary("BOOL", "!", input(r, "value"));
          break;
        default: {
          const op = {
            "logic.equal": "==",
            "logic.notEqual": "!=",
            "logic.greater": ">",
            "logic.greaterEqual": ">=",
            "logic.less": "<",
            "logic.lessEqual": "<=",
            "logic.and": "&&",
            "logic.or": "||",
          }[node.typeId];
          if (op) value = s.binary("BOOL", op, input(r, "a"), input(r, "b"));
          else if (r.expressions[socket])
            value = bind(
              r.expressions[socket],
              Object.fromEntries(
                r.inputs.map((p) => [p.name, input(r, p.name)]),
              ),
            );
          else throw Error("未实现的节点语义：" + node.typeId);
        }
      }
      if (
        !["input.texture", "vertex.output", "io.output"].includes(node.typeId)
      ) {
        const n = local(id, socket);
        body.push(s.declare(n, value.type, value, o));
        value = s.symbol(value.type, n);
      }
      refs.set(key, value);
      return value;
    } finally {
      visiting.delete(key);
    }
  }
  const outputs = Object.fromEntries(
    graph.sockets.map((socket) => [socket, visit(graph.finalNode, socket)]),
  );
  return copyJson({
    schemaVersion: 1,
    stage: graph.stage,
    body,
    outputs,
    functions: [...functions.values()],
    inputs: graph.inputs,
    textures: graph.textures,
  });
}

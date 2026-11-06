import { defineGlslNode } from "../../packages/plugin-sdk/glsl-node.mjs";
import { seeds } from "./seeds.mjs";

const prefix = "custom.glsl.";
function freeId(title, components) {
  const stem =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "node";
  let id = prefix + stem;
  for (let i = 2; components.has(id); i++) id = prefix + stem + "_" + i;
  return id;
}
/** 参数表属于节点类型，画布实例只引用类型 ID，不复制函数源码。 */
function component(input, components) {
  const title = String(input.title || "自定义节点").trim() || "自定义节点";
  const typeId = input.typeId ?? freeId(title, components);
  if (!/^custom\.glsl\.[A-Za-z0-9._-]+$/.test(typeId))
    throw Error("只能编辑本插件命名空间 custom.glsl.* 内的节点");
  const p = input.properties ?? input;
  // ID 的分隔符也编码，避免 a-b、a_b 与 a.b 生成同名函数。
  const name =
    "wf_" +
    typeId.replace(
      /[^A-Za-z0-9]/g,
      (c) => "_" + c.charCodeAt(0).toString(16) + "_",
    );
  return defineGlslNode({
    typeId,
    title,
    category: "自定义 GLSL",
    targets: input.targets ?? p.sourceTargets,
    glsl: input.glsl ?? {
      name: p.functionName || components.get(typeId)?.glsl.name || name,
      parameters: p.parameters,
      code: p.code,
      helpers: p.helperSource,
    },
    properties: {},
  });
}

/** 每个组件单独持有普通节点登记句柄。只替换这个组件，不使同库其他节点的编译缓存失效。 */
export function createComponentLibrary(nodes, settings) {
  const components = new Map(),
    handles = new Map();
  const batch = (node) => ({ nodes: [node], compilers: [] });
  const raw = settings.get("components");
  const imported =
    raw === null ? JSON.parse(settings.get("initial-import") || "[]") : [];
  const initial = new Map([...seeds, ...imported].map((d) => [d.typeId, d]));
  for (const input of raw === null ? initial.values() : JSON.parse(raw)) {
    const d = component(input, components);
    if (components.has(d.typeId)) throw Error("组件类型 ID 重复：" + d.typeId);
    handles.set(d.typeId, nodes.register(batch(d)));
    components.set(d.typeId, d);
  }
  function change(id, next) {
    const old = components.get(id),
      handle = handles.get(id);
    const updated = new Map(components);
    if (next) updated.set(id, next);
    else updated.delete(id);
    // 写入失败时，已安装节点和编译规则完全不变。
    const previous = JSON.stringify([...components.values()]);
    settings.set("components", JSON.stringify([...updated.values()]));
    try {
      if (!next) {
        components.delete(id);
        handles.delete(id);
        handle.dispose();
      } else {
        components.set(id, next);
        if (handle) handle.replace(batch(next));
        else handles.set(id, nodes.register(batch(next)));
      }
    } catch (error) {
      if (old) components.set(id, old);
      else components.delete(id);
      settings.set("components", previous);
      throw error;
    }
  }
  return {
    list: () => structuredClone([...components.values()]),
    upsert(input) {
      const d = component(input, components);
      if (input.createOnly && components.has(d.typeId))
        throw Error("组件类型 ID 已存在，请选择其他名称");
      change(d.typeId, d);
      return { typeId: d.typeId };
    },
    remove(id) {
      if (!components.has(id)) throw Error("本插件没有这个节点组件：" + id);
      change(id, null);
      return { typeId: id };
    },
  };
}

// 独立测试包可直接使用此脚本生成探针，不加载插件入口，不依赖 Studio 源码。
// node examples/sdk-effect/probes.mjs > probes.json
const id = "example.sdk-effect", probes = [];
for (const target of ["glsl-es-300", "glsl-430"])
  for (const stage of ["vertex", "fragment"])
    for (const type of ["scale", "tint"])
      probes.push({
        kind: "compile", pluginId: id, typeId: id + "." + type, target,
        context: { node: { id: "probe", typeId: id + "." + type, properties: {} }, socket: type === "scale" ? "value" : "color", stage },
        expected: type === "scale"
          ? { kind: "binary", type: "VEC2", operator: "*", left: { kind: "input", type: "VEC2", name: "value" }, right: { kind: "literal", type: "FLOAT", value: 0.5 } }
          : { kind: "call", type: "VEC4", name: "vec4", args: [0.2, 0.5, 0.9, 1].map(value => ({ kind: "literal", type: "FLOAT", value })) },
      });
console.log(JSON.stringify({ cycles: 3, probes }, null, 2));

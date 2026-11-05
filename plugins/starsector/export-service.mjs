import {
  validateParameterIds,
  validJavaIdentifier,
} from "../../packages/starsector-contract/parameters.mjs";
import {
  geometryParameters,
  effectiveParameters,
} from "../../packages/workflow-tools/geometry.mjs";
import {
  runtimeDependency,
  runtimeSourcePath,
  dependencySource,
} from "../../packages/starsector-contract/runtime.mjs";
import { buildRuntimeSources } from "./runtime-exporter.mjs";
import { exportConfiguration } from "./configuration.mjs";
import {
  constructionGuide,
  constructorArguments,
  initExample,
} from "./java-material.mjs";

const unique = (items) =>
  items.filter((p, i) => items.findIndex((q) => q.name === p.name) === i);
/** 游戏目标的 ABI 校验。浏览器预览不导入也不调用此函数。 */
export function validateStarsectorParameters(data) {
  const inputs = effectiveParameters(data.inputs, data.geometry),
    textures = data.textures;
  validateParameterIds([
    ...geometryParameters(data.geometry),
    ...inputs,
    ...textures,
  ]);
  const supported = new Set([
    "BOOL",
    "INT",
    "UINT",
    "FLOAT",
    "VEC2",
    "VEC3",
    "VEC4",
  ]);
  const unsupported = inputs.filter((p) => !supported.has(p.type));
  if (unsupported.length)
    throw Error(
      "当前 Java Plugin 的公共 uniform 参数不支持：" +
        unsupported.map((p) => p.name + ": " + p.type).join("，"),
    );
  const seen = new Map();
  for (const p of data.uniforms) {
    if (["u_time", "u_viewportAlpha", "u_instanceOffset", "u_viewProjection"].includes(p.name))
      throw Error(
        "uniform 名称 " + p.name + " 由运行时保留，不能作为自定义输入。",
      );
    const old = seen.get(p.name);
    if (old && (old.type !== p.type || old.scope !== p.scope))
      throw Error("uniform 名称冲突：" + p.name + " 的类型和作用域必须一致");
    seen.set(p.name, p);
  }
  return { inputs: unique(inputs), textures: unique(textures) };
}
/** 仅依赖公开编译快照及自身 Java 模板，不访问工作区、编辑器或节点插件实现。 */
export function createStarsectorExport({
  compilation,
  backend,
  runtimeTemplate,
}) {
  async function describe(document) {
    const data = await compilation.describe(document);
    return { ...data, ...validateStarsectorParameters(data) };
  }
  return {
    configuration: exportConfiguration,
    async generate({ document }) {
      const data = await describe(document);
      if (!validJavaIdentifier(data.config.className))
        throw Error("Java 类名无效：" + data.config.className);
      const [vertex, fragment] = await Promise.all(
        ["vertex", "fragment"].map((stage) =>
          compilation.lower({ document, target: "glsl-430", stage }),
        ),
      );
      return buildRuntimeSources({
        config: data.config,
        graph: document.fragment,
        transform: data.geometry,
        inputs: data.inputs,
        textures: data.textures,
        vertex,
        fragment,
        backend,
      });
    },
    async guide({ document, count = 8 }) {
      if (!Number.isInteger(count) || count < 1 || count > 64)
        throw Error("示例实例数需要在 1–64 之间");
      const data = await describe(document),
        parameters = [...geometryParameters(data.geometry), ...data.inputs];
      if (!validJavaIdentifier(data.config.className))
        throw Error("Java 类名无效：" + data.config.className);
      return {
        signature: `new ${data.config.className}(\n    ${constructorArguments(
          parameters,
          data.textures,
          count === 1,
        )
          .map((p) => `${p.javaType} ${p.id}`)
          .join(",\n    ")}\n)`,
        example: initExample(data.config, parameters, data.textures, count),
        description: constructionGuide(data.config, parameters, data.textures),
      };
    },
    dependency({ runtimePath }) {
      return {
        filename: runtimeSourcePath(runtimePath),
        content: dependencySource(runtimeTemplate, runtimePath),
        revision: runtimeDependency.revision,
      };
    },
  };
}

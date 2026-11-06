/** 内置浏览器插件的业务角色，接入手续单独由 L1 plugin-runtime 承接。新增角色须明确登记。 */
export const pluginLayers = Object.freeze({
  "custom.glsl": 2,
  "studio.compiler": 2,
  "studio.declarations": 2,
  "example.layout": 2,
  "example.showcase": 3,
  "studio.extension-ui": 2,
  "studio.geometry-ui": 3,
  "studio.glsl": 2,
  "studio.interaction": 2,
  "studio.layout": 2,
  "studio.math": 2,
  "studio.mcp": 3,
  "studio.noise": 2,
  "studio.node-model": 2,
  "studio.plugin-manager": 3,
  "studio.preview": 2,
  "studio.project-files": 2,
  "studio.project-ui": 3,
  "studio.sdf": 2,
  "studio.shortcuts": 2,
  "studio.starsector": 2,
  "studio.templates": 2,
  "studio.ui": 2,
  "studio.workflow-service": 2,
  "studio.workflow-ui": 3,
  "studio.workspace": 2,
  "studio.plugin-service": 2,
  "studio.mcp-connection": 2,
});
/** P8.1 已完成，例外清单保持为空，新增跨层依赖必须被门禁拒绝。 */
export const pendingLayerEdges = Object.freeze([]);
/** 同层也按职责单向依赖，禁止节点或编译能力重新依附编辑器和界面。 */
export function inspectBusinessDependencies(manifests) {
  const pure = {
    "studio.node-model": ["platform.node-registry"],
    "studio.compiler": [
      "workflow.graph-snapshot",
      "shader.backend.glsl",
      "workflow.operations",
    ],
    "custom.glsl": ["workflow.nodes", "workflow.operations", "platform.browser"],
    "studio.math": ["workflow.nodes"],
    "studio.noise": ["workflow.nodes"],
    "studio.sdf": ["workflow.nodes"],
  };
  for (const plugin of manifests) {
    const apis = Object.keys({
      ...plugin.requiredApis,
      ...plugin.optionalApis,
    });
    for (const api of apis) {
      if (pure[plugin.id] && !pure[plugin.id].includes(api))
        throw Error(
          "无会话能力不得依赖编辑或界面服务：" + plugin.id + " -> " + api,
        );
      if (
        plugin.id === "studio.workspace" &&
        [
          "studio.ui",
          "studio.plugins",
          "workflow.preview",
          "studio.extension-ui",
          "platform.ui-shell",
        ].includes(api)
      )
        throw Error("工作区不负责界面、插件管理或 GPU 调度：" + api);
    }
  }
}
export function inspectLayers(manifests, hostApis) {
  const providers = new Map(
    hostApis.map((id) => [id, { id: "$host", layer: 1 }]),
  );
  for (const manifest of manifests) {
    const layer = pluginLayers[manifest.id];
    if (layer === undefined)
      throw Error("插件尚未登记业务层级：" + manifest.id);
    if (manifest.layer !== layer)
      throw Error("清单层级与职责登记不符：" + manifest.id);
    for (const id of Object.keys(manifest.providesApis || {})) {
      if (providers.has(id)) throw Error("API 提供者归属不唯一：" + id);
      providers.set(id, { id: manifest.id, layer });
    }
  }
  const edges = [],
    pending = [];
  for (const manifest of manifests)
    for (const id of Object.keys({
      ...manifest.optionalApis,
      ...manifest.requiredApis,
    })) {
      const provider = providers.get(id),
        layer = pluginLayers[manifest.id];
      if (!provider) throw Error("API 未登记提供者归属：" + id);
      const edge = {
        consumer: manifest.id,
        fromLayer: layer,
        api: id,
        provider: provider.id,
        toLayer: provider.layer,
      };
      edges.push(edge);
      if (layer - provider.layer > 1 || layer < provider.layer) {
        const key = manifest.id + " -> " + id;
        if (!pendingLayerEdges.includes(key))
          throw Error("禁止新增跨层业务调用：" + key);
        pending.push(edge);
      }
    }
  for (const key of pendingLayerEdges)
    if (!pending.some((e) => e.consumer + " -> " + e.api === key))
      throw Error("迁移后请删除失效跨层记录：" + key);
  return { edges, pending, fullyLayered: pending.length === 0 };
}

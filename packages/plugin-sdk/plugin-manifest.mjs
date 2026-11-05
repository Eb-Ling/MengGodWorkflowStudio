import { remoteMethods } from "./extension-protocol.mjs";
import { readActivationEvents } from "./plugin-activation.mjs";
import { validateSchema } from "./schema-definition.mjs";
import { readIsolation } from "./extension-platform.mjs";
import {
  readDeclaration,
  defaultDeclaration,
  declarationRequirements,
} from "./declarative.mjs";
const idPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;
const apiRange = /^\^?\d+\.\d+\.\d+$/;
/** 目录提供者的 schema 会在宿主校验，只接受有界结构，不执行插件给出的正则或引用。 */
function validateRemoteSchema(schema) {
  let count = 0;
  const keys = new Set([
    "type",
    "enum",
    "anyOf",
    "items",
    "minItems",
    "maxItems",
    "properties",
    "required",
    "additionalProperties",
    "minimum",
    "maximum",
    "minLength",
  ]);
  const plain = (v) => v && typeof v === "object" && !Array.isArray(v);
  function visit(s, depth) {
    if (
      !plain(s) ||
      depth > 8 ||
      ++count > 256 ||
      Object.keys(s).some((k) => !keys.has(k))
    )
      throw Error("远程 schema 超限或包含未开放规则（不支持正则/引用）");
    if (
      s.type !== undefined &&
      ![
        "array",
        "object",
        "string",
        "number",
        "integer",
        "boolean",
        "null",
      ].includes(s.type)
    )
      throw Error("远程 schema 类型无效");
    for (const key of ["minItems", "maxItems", "minLength"])
      if (s[key] !== undefined && (!Number.isSafeInteger(s[key]) || s[key] < 0))
        throw Error("远程 schema 长度无效");
    for (const key of ["minimum", "maximum"])
      if (s[key] !== undefined && !Number.isFinite(s[key]))
        throw Error("远程 schema 范围无效");
    if (
      s.enum !== undefined &&
      (!Array.isArray(s.enum) ||
        s.enum.length > 64 ||
        s.enum.some(
          (v) =>
            v !== null && !["string", "number", "boolean"].includes(typeof v),
        ))
    )
      throw Error("远程 schema 枚举必须是有界标量数组");
    if (s.anyOf !== undefined) {
      if (!Array.isArray(s.anyOf) || !s.anyOf.length || s.anyOf.length > 8)
        throw Error("远程 schema 分支超限");
      s.anyOf.forEach((v) => visit(v, depth + 1));
    }
    if (s.items !== undefined) visit(s.items, depth + 1);
    if (s.properties !== undefined) {
      if (!plain(s.properties) || Object.keys(s.properties).length > 64)
        throw Error("远程 schema 字段超限");
      Object.values(s.properties).forEach((v) => visit(v, depth + 1));
    }
    if (
      s.required !== undefined &&
      (!Array.isArray(s.required) ||
        s.required.length > 64 ||
        s.required.some((k) => typeof k !== "string"))
    )
      throw Error("远程 schema 必填字段无效");
    if (
      s.additionalProperties !== undefined &&
      typeof s.additionalProperties !== "boolean"
    )
      visit(s.additionalProperties, depth + 1);
  }
  visit(schema, 1);
  validateSchema(schema);
}
/** 外部目录插件的唯一声明格式。读取声明不执行插件脚本，平台能力默认拒绝。
 * @returns {import('./plugin-management-types').LocalPluginManifest}
 */
export function readPluginManifest(input) {
  const value = JSON.parse(JSON.stringify(input));
  const activationEvents = readActivationEvents(value || {});
  if (value?.kind === "declarative" && activationEvents.length) throw Error("声明式插件不提供按需 API");
  if(value.layer!==undefined&&![2,3].includes(value.layer))throw Error('插件业务层级只能为 2 或 3');
  if (!value || value.schemaVersion !== 1 || value.apiVersion !== "1.0.0")
    throw new Error("插件声明必须使用 schemaVersion 1 / apiVersion 1.0.0");
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/.test(value.id || ""))
    throw new Error("插件 ID 需要命名空间，例如 mymod.effects");
  if (!value.name?.trim() || value.name.length > 100)
    throw new Error("请填写插件名称（最多 100 字）");
  if (!/^\d+\.\d+\.\d+$/.test(value.version || ""))
    throw new Error("版本格式应为 1.0.0");
  if (!["nodes", "extension", "declarative"].includes(value.kind))
    throw new Error("目录插件类型应为 nodes、extension 或 declarative");
  if (value.kind === "declarative") {
    const declaration = readDeclaration(value.declaration),
      requirements = declarationRequirements(declaration);
    const sorted = (v) =>
      JSON.stringify(
        Object.entries(v || {}).sort(([a], [b]) => a.localeCompare(b)),
      );
    if (
      value.entry !== undefined ||
      value.exportName !== undefined ||
      Object.keys(value.optionalApis || {}).length ||
      Object.keys(value.providesApis || {}).length ||
      sorted(value.requiredApis) !== sorted(requirements.requiredApis) ||
      JSON.stringify([...(value.capabilities || [])].sort()) !==
        JSON.stringify([...requirements.capabilities].sort())
    )
      throw Error(
        "声明式插件的 API 和权限必须与实际动作一致，不能包含脚本入口",
      );
    return {
      schemaVersion: 1,
      id: value.id,
      name: value.name.trim(),
      version: value.version,
      apiVersion: "1.0.0",
      kind: "declarative",
      ...(value.layer!==undefined?{layer:value.layer}:{}),
      declaration,
      ...requirements,
    };
  }
  if (
    !/^[\w./ -]+\.m?js$/.test(value.entry || "") ||
    value.entry.startsWith("/") ||
    value.entry.split("/").some((p) => !p || p === ".." || p === ".")
  )
    throw new Error("入口必须是目录内的相对 .js / .mjs 路径");
  if (!/^(?:default|[A-Za-z_$][\w$]*)$/.test(value.exportName || ""))
    throw new Error("请填写入口导出名，例如 plugin 或 default");
  if (
    value.kind === "nodes" &&
    (JSON.stringify(value.requiredApis) !==
      JSON.stringify({ "workflow.nodes": "^1.0.0" }) ||
      JSON.stringify(value.capabilities) !== JSON.stringify(["nodes.register"]))
  )
    throw new Error(
      "外部节点插件仅可声明 workflow.nodes ^1.0.0 与 nodes.register",
    );
  const requiredApis = value.requiredApis || {},
    optionalApis = value.optionalApis || {},
    providesApis = value.providesApis || {};
  for (const entries of [requiredApis, optionalApis, providesApis])
    if (
      !entries ||
      typeof entries !== "object" ||
      Array.isArray(entries) ||
      Object.keys(entries).length > 16
    )
      throw Error("API 声明必须是最多 16 项的对象");
  for (const [id, range] of Object.entries({
    ...optionalApis,
    ...requiredApis,
  })) {
    if (!idPattern.test(id) || !apiRange.test(range))
      throw Error("API 名称或版本无效");
    if (
      /^(workflow|studio|platform|shader)\./.test(id) &&
      !Object.hasOwn(remoteMethods, id)
    )
      throw Error("隔离宿主尚未开放 API：" + id);
  }
  if (Object.keys(requiredApis).some((id) => Object.hasOwn(optionalApis, id)))
    throw Error("API 不能同时必需和可选");
  const allowedCaps = new Set([
    "nodes.register",
    ...Object.values(remoteMethods).flatMap(Object.values),
  ]);
  if (
    !Array.isArray(value.capabilities) ||
    value.capabilities.length > 32 ||
    new Set(value.capabilities).size !== value.capabilities.length
  )
    throw Error("能力列表无效");
  allowedCaps.add('extension.window');
  const isolation = readIsolation(value.isolation, value.capabilities);
  if (Object.keys(isolation).length && value.kind !== 'extension') throw Error('只有 extension 类型可声明原生隔离范围');
  for (const cap of value.capabilities) {
    if (
      !idPattern.test(cap) ||
      (!allowedCaps.has(cap) &&
        !Object.keys({
          ...requiredApis,
          ...optionalApis,
          ...providesApis,
        }).some(
          (id) =>
            !/^(workflow|studio|platform|shader)\./.test(id) &&
            cap.startsWith(id + "."),
        ))
    )
      throw Error("隔离宿主未开放能力：" + cap);
  }
  for (const [id, api] of Object.entries(providesApis)) {
    if (
      !id.startsWith(value.id + ".") ||
      api.transport === "local" ||
      api.scoped ||
      api.values ||
      !/^\d+\.\d+\.\d+$/.test(api.version || "")
    )
      throw Error("目录插件只能提供自身命名空间下的 JSON API");
    if (
      !api.methods ||
      Object.keys(api.methods).length > 32 ||
      !Object.keys(api.methods).length
    )
      throw Error("API 方法声明无效");
    for (const [method, contract] of Object.entries(api.methods)) {
      if (
        !/^[a-zA-Z][\w]*$/.test(method) ||
        ["constructor", "then", "toString", "prototype"].includes(method) ||
        !contract.arguments ||
        !contract.returns ||
        (contract.capability && !contract.capability.startsWith(id + "."))
      )
        throw Error("API 方法必须声明 JSON schema 与所属能力");
      validateRemoteSchema(contract.arguments);
      validateRemoteSchema(contract.returns);
    }
  }
  if (
    value.kind === "nodes" &&
    (Object.keys(optionalApis).length || Object.keys(providesApis).length)
  )
    throw Error("nodes 类型只提供节点，复合贡献使用 extension 类型");
  return {
    schemaVersion: 1,
    id: value.id,
    name: value.name.trim(),
    version: value.version,
    apiVersion: "1.0.0",
    kind: value.kind,
    ...(activationEvents.length ? { activationEvents } : {}),
    ...(value.layer!==undefined?{layer:value.layer}:{}),
    entry: value.entry,
    exportName: value.exportName,
    requiredApis,
    ...(Object.keys(optionalApis).length ? { optionalApis } : {}),
    ...(Object.keys(providesApis).length ? { providesApis } : {}),
    capabilities: value.capabilities,
    ...(Object.keys(isolation).length ? { isolation } : {}),
  };
}

/** 从目录名称生成可编辑草稿，不会自动登记或加载。
 * @returns {import('./plugin-management-types').LocalPluginManifest}
 */
export function pluginManifestDraft(
  folderName,
  entry = "index.mjs",
  kind = "nodes",
) {
  const slug =
    folderName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "nodes";
  if (kind === "declarative") {
    const declaration = defaultDeclaration();
    return {
      schemaVersion: 1,
      id: "local." + (/^[a-z]/.test(slug) ? slug : "plugin-" + slug),
      name: folderName,
      version: "1.0.0",
      apiVersion: "1.0.0",
      kind: "declarative",
      declaration,
      ...declarationRequirements(declaration),
    };
  }
  return {
    schemaVersion: 1,
    id: "local." + (/^[a-z]/.test(slug) ? slug : "plugin-" + slug),
    name: folderName,
    version: "1.0.0",
    apiVersion: "1.0.0",
    kind,
    entry,
    exportName: "plugin",
    requiredApis:
      kind === "extension"
        ? { "studio.extension-ui": "^1.0.0", "workflow.editor": "^1.0.0" }
        : { "workflow.nodes": "^1.0.0" },
    capabilities:
      kind === "extension"
        ? ["extension.ui", "workflow.read", "workflow.write"]
        : ["nodes.register"],
  };
}

/** 安装授权的稳定指纹：重读磁盘不得自动扩大能力、依赖或提供者契约。 */
export function pluginPermissionKey(manifest) {
  const sort = (v) =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sort(v[k])]),
          )
        : v;
  return JSON.stringify(
    sort({
      kind: manifest.kind,
      requiredApis: manifest.requiredApis,
      optionalApis: manifest.optionalApis || {},
      providesApis: manifest.providesApis || {},
      capabilities: [...manifest.capabilities].sort(),
      isolation: manifest.isolation || {},
    }),
  );
}

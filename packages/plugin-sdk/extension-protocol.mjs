import { copyJson } from "./schema.mjs";
import { extensionPlatformMethods } from "./extension-platform.mjs";
/** 跨进程协议版本，独立于发布版本，所有消息均为有界 JSON。 */
export const EXTENSION_PROTOCOL = 1;
export const EXTENSION_MAX_BYTES = 2 * 1024 * 1024;
export function extensionJson(value) {
  const copy = copyJson(value);
  if (
    new TextEncoder().encode(JSON.stringify(copy)).byteLength >
    EXTENSION_MAX_BYTES
  )
    throw Error("扩展消息超过 2 MB");
  return copy;
}
export function readExtensionMessage(input) {
  const m = extensionJson(input);
  if (
    m?.protocol !== EXTENSION_PROTOCOL ||
    !Number.isSafeInteger(m.id) ||
    m.id < 1
  )
    throw Error("扩展消息版本或请求 ID 无效");
  return m;
}
/** 仅这些宿主能力可通过远程代理使用，本地组件/句柄不穿过进程边界。 */
export const remoteMethods = Object.freeze({
  "platform.extension": extensionPlatformMethods,
  "workflow.editor": { snapshot: "workflow.read", inspect: "workflow.read", execute: "workflow.write", edit: "workflow.write", addNode: "workflow.write", setProperty: "workflow.write" },
  "workflow.workspace": { snapshot: "workflow.read", inspect: "workflow.read", execute: "workflow.write", edit: "workflow.write", addNode: "workflow.write", setProperty: "workflow.write" },
  "workflow.nodes": { list: "nodes.read", get: "nodes.read" },
  "studio.extension-ui": {
    inspect: "extension.ui.inspect",
    create: "extension.ui",
    update: "extension.ui",
    remove: "extension.ui",
    events: "extension.ui",
  },
});
const reserved = /^(?:workflow|studio|platform|shader)\./;
export function remoteCapability(manifest, api, method) {
  if (
    !Object.hasOwn({ ...manifest.optionalApis, ...manifest.requiredApis }, api)
  )
    throw Error("未声明远程 API：" + api);
  if (
    typeof method !== "string" ||
    !/^[A-Za-z][\w]*$/.test(method) ||
    ["constructor", "then", "toString", "prototype"].includes(method)
  )
    throw Error("无效远程方法");
  const cap = remoteMethods[api]?.[method];
  if (reserved.test(api) && !cap)
    throw Error("远程调用未开放：" + api + "." + method);
  if (cap && !manifest.capabilities.includes(cap))
    throw Error("缺少能力：" + cap);
  return cap;
}
/** 远程编辑权限仅覆盖当前草稿，项目文件、下载及管理动作另行授予，当前不开放。 */
export function validateRemoteCall(manifest, request) {
  const value = extensionJson(request);
  remoteCapability(manifest, value.api, value.method);
  if (!Array.isArray(value.args) || value.args.length > 8)
    throw Error("远程参数必须为有界数组");
  if (["workflow.editor","workflow.workspace"].includes(value.api) && value.method === "execute") {
    const action = value.args[0];
    if (
      action?.actions?.some(
        (a) => !["UNDO", "REDO", "SET_STAGE"].includes(a.type),
      )
    )
      throw Error("远程插件只能编辑当前草稿，不能执行项目文件/下载管理动作");
  }
  // 身份、代次和关联 ID 必须由宿主填入，目录脚本不能经额外字段覆盖它们。
  return { api: value.api, method: value.method, args: value.args };
}

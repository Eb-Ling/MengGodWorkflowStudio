/** 内核管理与状态入口，仅供宿主适配使用，公开插件接入由 plugin-runtime 负责。 */
export { GraphStore } from "./graph-store.mjs";
export { DocumentStore } from "./document-store.mjs";
export { createCommandGateway } from "./command-gateway.mjs";
export { ContributionRegistry } from "./contribution-registry.mjs";
export { OperationRegistry } from "./operation-registry.mjs";
export { PluginHost, compatibleVersion } from "./plugin-lifecycle.mjs";

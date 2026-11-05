import { createExtensionRuntime } from "./runtime.mjs";
import {
  EXTENSION_PROTOCOL,
  readExtensionMessage,
  extensionJson,
} from "../plugin-sdk/extension-protocol.mjs";
const bridge = window.pluginRuntime;
// 唯一动态入口仍在隔离进程，由宿主目录快照与请求白名单限制。
const runtime = createExtensionRuntime({
  load: (payload) => import(payload.entryUrl),
  call: (request) => bridge.call(request),
});
bridge.onRequest(async (input) => {
  let request;
  try {
    request = readExtensionMessage(input);
    const value = await runtime.execute(request);
    bridge.reply({
      protocol: EXTENSION_PROTOCOL,
      id: request.id,
      value: extensionJson(value),
    });
  } catch (error) {
    bridge.reply({
      protocol: EXTENSION_PROTOCOL,
      id: request?.id || input?.id,
      error: String(error?.message || error).slice(0, 4000),
    });
  }
});
window.addEventListener("error", (event) =>
  bridge.reply({
    protocol: EXTENSION_PROTOCOL,
    fatal: String(event.message).slice(0, 4000),
  }),
);
window.addEventListener("unhandledrejection", (event) =>
  bridge.reply({
    protocol: EXTENSION_PROTOCOL,
    fatal: String(event.reason).slice(0, 4000),
  }),
);
bridge.reply({ protocol: EXTENSION_PROTOCOL, ready: true });

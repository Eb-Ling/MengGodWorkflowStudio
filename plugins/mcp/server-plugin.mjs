import { serverManifest } from "./manifest.mjs";
import { createBridgeService } from "./bridge-service.mjs";
import { commandPermission } from "./access-policy.mjs";

export const mcpServerPlugin = {
  manifest: serverManifest,
  activate(context) {
    const bridge = createBridgeService();
    const http = context.api("platform.http");
    context.onDispose(() => bridge.dispose());
    context.onDispose(() => http.endSessions());
    const remove = context
      .api("platform.http")
      .register(async ({ method, pathname, query, input, principal }) => {
        const handlers = {
          "GET /v1/state": () => bridge.state(),
          "POST /v1/state": () => bridge.publish(input),
          "POST /v1/activate": () => bridge.activate(input),
          "POST /v1/disconnect": () => {
            const result = bridge.disconnect(input);
            if (result.disconnected) http.endSessions();
            return result;
          },
          "GET /v1/commands": () => bridge.pull(Object.fromEntries(query)),
          "POST /v1/commands": () => bridge.submit(input, principal),
          "POST /v1/ack": () => bridge.acknowledge(input),
        };
        const handler = handlers[`${method} ${pathname}`];
        if (!handler) return null;
        principal.require(
          method === "GET" && pathname === "/v1/state"
            ? "session.read"
            : method === "POST" && pathname === "/v1/commands"
              ? commandPermission(input)
              : "session.publish",
        );
        try {
          const body = await handler();
          return { status: body.ok === false ? 409 : 200, body };
        } catch (error) {
          return {
            status: 400,
            body: { ok: false, error: error.message || String(error) },
          };
        }
      });
    context.onDispose(remove);
  },
};

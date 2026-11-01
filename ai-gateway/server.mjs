import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.WORKFLOW_BRIDGE_PORT || 4174);
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../frontend");
const commandTypes = new Set(["ADD_NODE", "REMOVE_NODE", "MOVE_NODE", "CONNECT", "DISCONNECT", "SET_PROPERTY", "RENAME_NODE", "SET_OUTPUT"]);
const actionTypes = new Set(["SET_STAGE", "SAVE_WORKFLOW", "EXPORT_RUNTIME", "NEW_WORKFLOW", "RESET_CURRENT_DRAFT", "LOAD_MING_GOD_EXAMPLE", "OPEN_WORKFLOW", "DELETE_WORKFLOW", "IMPORT_WORKFLOW_DATA", "SET_PROJECT_CONFIG", "SET_VERTEX_TRANSFORM", "SET_VIEW", "SET_SELECTION", "DELETE_SELECTED", "DISCONNECT_SELECTED", "TOGGLE_SELECTED_PREVIEW", "SAVE_SELECTION_AS_WORKFLOW_NODE", "EXPAND_WORKFLOW_NODE", "DELETE_WORKFLOW_NODE", "UPSERT_CUSTOM_NODE", "DELETE_CUSTOM_NODE", "ADD_DEMO"]);

const editorLeaseMs = 10_000;
let latestState = { source: "awaiting_active_editor", graph: null, project: null, catalog: [] };
let activeEditorId = null;
let editorSeenAt = 0;
const editorStates = new Map();
let nextId = 1;
const queue = [];
const pending = new Map();

function json(response, status, payload) { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }); response.end(JSON.stringify(payload)); }
function body(request) { return new Promise((resolve, reject) => { let text = ""; request.on("data", chunk => { text += chunk; if (text.length > 4_000_000) reject(new Error("Request body is too large")); }); request.on("end", () => { try { resolve(JSON.parse(text || "{}")); } catch { reject(new Error("Invalid JSON")); } }); request.on("error", reject); }); }
function contentType(file) { return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
async function serveFrontend(request, response) { const rawPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname), requested = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, ""), file = path.resolve(frontendRoot, requested); if (!file.startsWith(`${frontendRoot}${path.sep}`) && file !== frontendRoot) return json(response, 403, { error: "Invalid path" }); try { const source = await readFile(file); response.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-store" }); response.end(source); } catch { json(response, 404, { error: "Not found" }); } }
function pageIsConnected() { return !!activeEditorId && latestState.source === "active_editor_draft" && Date.now() - editorSeenAt < editorLeaseMs; }
function editorOwnsLease(editorId) { return pageIsConnected() && editorId === activeEditorId; }
function requireEditorId(input) { const editorId = String(input?.editorId || ""); if (!editorId) throw new Error("The editor page did not provide an editorId. Reload the workflow page."); return editorId; }
function rememberEditor(input) {
  const editorId = requireEditorId(input);
  const state = { ...input, source: "active_editor_draft", editorId };
  editorStates.set(editorId, state);
  return { editorId, state };
}
function activateEditor(editorId) {
  const state = editorStates.get(editorId);
  if (!state) throw new Error("This editor has not published a draft yet.");
  activeEditorId = editorId;
  latestState = state;
  editorSeenAt = Date.now();
}
function getNode(graph, id) { return graph.nodes.find(node => node.id === id); }
function nodeDefinition(typeId) { return (latestState.catalog || []).find(definition => definition.typeId === typeId); }
function socketPort(definition, direction, name) { return definition?.[direction === "output" ? "outputs" : "inputs"]?.find(item => item.name === name); }
function typeKey(type) { const value=String(type || "").toUpperCase(); return value === "SAMPLERCUBE" ? "SAMPLER_CUBE" : value; }
function compatible(from, to) { return typeKey(from) === "ANY" || typeKey(to) === "ANY" || typeKey(from) === typeKey(to); }
function finite(value, label) { if (!Number.isFinite(Number(value))) throw new Error(`${label} must be a finite number`); }
function validateCommands(commands, expectedRevision) {
  if (!pageIsConnected()) throw new Error("The editor page is not connected. Open the workflow page and click Detect Bridge first.");
  const graph = latestState.graph;
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) throw new Error("The connected editor has no active graph.");
  if (expectedRevision !== undefined && Number(expectedRevision) !== Number(graph.revision)) throw new Error(`Revision conflict: expected ${expectedRevision}, current ${graph.revision}. Read workflow_get_current and retry.`);
  const model = JSON.parse(JSON.stringify(graph));
  const ids = new Set(model.nodes.map(node => node.id));
  for (const command of commands) {
    if (!command || !commandTypes.has(command.type) || !command.payload || typeof command.payload !== "object") throw new Error("Unsupported graph command or payload.");
    const payload = command.payload;
    if (command.type === "ADD_NODE") { const node = payload.node; if (!node || typeof node.id !== "string" || !node.id || ids.has(node.id)) throw new Error("ADD_NODE requires a unique node.id."); if (!nodeDefinition(node.typeId)) throw new Error(`Unknown node type: ${node.typeId}`); finite(node.canvasX, "node.canvasX"); finite(node.canvasY, "node.canvasY"); ids.add(node.id); model.nodes.push(node); continue; }
    const node = getNode(model, payload.nodeId);
    if (["REMOVE_NODE", "MOVE_NODE", "SET_PROPERTY", "RENAME_NODE", "SET_OUTPUT"].includes(command.type) && !node) throw new Error(`Unknown node: ${payload.nodeId}`);
    if (command.type === "REMOVE_NODE") { model.nodes = model.nodes.filter(item => item.id !== payload.nodeId); model.links = model.links.filter(link => link.fromNode !== payload.nodeId && link.toNode !== payload.nodeId); ids.delete(payload.nodeId); continue; }
    if (command.type === "MOVE_NODE") { finite(payload.x, "x"); finite(payload.y, "y"); node.canvasX = Number(payload.x); node.canvasY = Number(payload.y); continue; }
    if (command.type === "SET_PROPERTY") { if (typeof payload.key !== "string" || !payload.key) throw new Error("SET_PROPERTY requires a property key."); continue; }
    if (command.type === "RENAME_NODE") { if (typeof payload.title !== "string") throw new Error("RENAME_NODE requires a title string."); continue; }
    if (command.type === "SET_OUTPUT") { if (node.typeId !== (latestState.stage === "vertex" ? "vertex.output" : "io.output")) throw new Error("SET_OUTPUT must target the current stage output."); continue; }
    const link = payload.link;
    if (!link || !getNode(model, link.fromNode) || !getNode(model, link.toNode)) throw new Error("Link references an unknown node.");
    const from = socketPort(nodeDefinition(getNode(model, link.fromNode).typeId), "output", link.fromSocket), to = socketPort(nodeDefinition(getNode(model, link.toNode).typeId), "input", link.toSocket);
    if (!from || !to) throw new Error("Link references an unknown output or input socket.");
    if (!compatible(from.type, to.type)) throw new Error(`Incompatible link: ${from.type} cannot connect to ${to.type}.`);
    if (command.type === "CONNECT") { model.links = model.links.filter(item => !(item.toNode === link.toNode && item.toSocket === link.toSocket)); model.links.push(link); }
    if (command.type === "DISCONNECT" && !model.links.some(item => item.fromNode === link.fromNode && item.fromSocket === link.fromSocket && item.toNode === link.toNode && item.toSocket === link.toSocket)) throw new Error("The requested link does not exist.");
  }
}
function validateActions(actions) { if (!pageIsConnected()) throw new Error("The editor page is not connected. Open the workflow page and click Detect Bridge first."); for (const action of actions) if (!action || !actionTypes.has(action.type) || !action.payload || typeof action.payload !== "object") throw new Error("Unsupported page action or payload."); }
function enqueue(kind, type, payload, requestId) { queue.push({ id: nextId++, requestId, kind, type, payload }); }
function awaitPage(requestId) { return new Promise(resolve => { const timer = setTimeout(() => { pending.delete(requestId); resolve({ ok: false, error: "The editor did not acknowledge this operation within 8 seconds. Keep the workflow page open and connected, then retry." }); }, 8_000); pending.set(requestId, { resolve, timer }); }); }

http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return json(response, 204, {});
  if (request.method === "GET" && request.url === "/health") return json(response, 200, { ok: true, mode: "page_bridge", editorConnected: pageIsConnected(), activeEditorId: activeEditorId || null });
  if (request.method === "GET" && request.url.startsWith("/v1/state")) return json(response, 200, { ...latestState, editorConnected: pageIsConnected(), activeEditorId: activeEditorId || null });
  if (request.method === "POST" && request.url === "/v1/state") { try { const input = await body(request), { editorId } = rememberEditor(input); if (editorId === activeEditorId) activateEditor(editorId); return json(response, 200, { ok: true, active: editorOwnsLease(editorId), activeEditorId }); } catch (error) { return json(response, 400, { error: error.message }); } }
  if (request.method === "POST" && request.url === "/v1/activate") { try { const input = await body(request), editorId = requireEditorId(input); if (!editorStates.has(editorId)) rememberEditor(input); activateEditor(editorId); return json(response, 200, { ok: true, active: true, activeEditorId }); } catch (error) { return json(response, 400, { error: error.message }); } }
  if (request.method === "POST" && request.url === "/v1/ack") { try { const input = await body(request), editorId = requireEditorId(input); if (!editorOwnsLease(editorId)) throw new Error("Only the active editor can acknowledge MCP operations."); const entry = pending.get(input.requestId); if (entry) { clearTimeout(entry.timer); pending.delete(input.requestId); entry.resolve(input.ok === false ? { ok: false, error: input.error || "The editor rejected the operation." } : { ok: true, revision: input.revision, result: input.result || null }); } return json(response, 200, { ok: true }); } catch (error) { return json(response, 400, { error: error.message }); } }
  if (request.method === "GET" && request.url.startsWith("/v1/commands")) { const url = new URL(request.url, `http://127.0.0.1:${port}`), cursor = Number(url.searchParams.get("cursor") || 0), editorId = String(url.searchParams.get("editorId") || ""); if (!editorOwnsLease(editorId)) return json(response, 200, { cursor: nextId - 1, items: [] }); return json(response, 200, { cursor: nextId - 1, items: queue.filter(item => item.id > cursor && pending.has(item.requestId)) }); }
  if (request.method === "POST" && request.url === "/v1/commands") {
    try {
      const input = await body(request), commands = Array.isArray(input.commands) ? input.commands : (input.type && input.payload ? [input] : []), actions = Array.isArray(input.actions) ? input.actions : [];
      if (!commands.length && !actions.length) throw new Error("Submit at least one graph command or page action.");
      if (commands.length) validateCommands(commands, input.expectedRevision);
      if (actions.length) validateActions(actions);
      const requestId = `workflow_${Date.now()}_${nextId}`;
      commands.forEach(command => enqueue("command", command.type, command.payload, requestId));
      actions.forEach(action => enqueue("action", action.type, action.payload, requestId));
      const result = await awaitPage(requestId);
      return json(response, result.ok ? 200 : 409, { ...result, requestId, cursor: nextId - 1, count: commands.length + actions.length });
    } catch (error) { return json(response, 400, { ok: false, error: error.message }); }
  }
  if (request.method === "GET") return serveFrontend(request, response);
  return json(response, 404, { error: "Not found" });
}).listen(port, "127.0.0.1", () => console.log(`Workflow page bridge listening on http://127.0.0.1:${port}`));

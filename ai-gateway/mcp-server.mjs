import readline from "node:readline";

const bridge = process.env.WORKFLOW_BRIDGE_URL || "http://127.0.0.1:4174";
const commandTypes = new Set(["ADD_NODE", "REMOVE_NODE", "MOVE_NODE", "CONNECT", "DISCONNECT", "SET_PROPERTY", "RENAME_NODE", "SET_OUTPUT"]);
const actionTypes = new Set(["SAVE_WORKFLOW", "EXPORT_RUNTIME", "NEW_WORKFLOW", "RESET_CURRENT_DRAFT", "LOAD_MING_GOD_EXAMPLE", "OPEN_WORKFLOW", "DELETE_WORKFLOW", "IMPORT_WORKFLOW_DATA", "SET_PROJECT_CONFIG", "SET_VERTEX_TRANSFORM", "SET_VIEW", "SET_SELECTION", "DELETE_SELECTED", "DISCONNECT_SELECTED", "TOGGLE_SELECTED_PREVIEW", "SAVE_SELECTION_AS_WORKFLOW_NODE", "EXPAND_WORKFLOW_NODE", "DELETE_WORKFLOW_NODE", "UPSERT_CUSTOM_NODE", "DELETE_CUSTOM_NODE", "ADD_DEMO"]);
const object = { type: "object", additionalProperties: false };
const projectProperties = { id: { type: "string" }, title: { type: "string" }, className: { type: "string" }, shaderDir: { type: "string" }, previewWidth: { type: "number", minimum: 64, maximum: 4096 }, previewHeight: { type: "number", minimum: 64, maximum: 4096 } };
const tools = [
  { name: "workflow_get_current", description: "Read the active, unsaved browser-editor draft. Includes graph, project, vertex transform, selection, view, libraries, node catalog, and last generated sources.", inputSchema: object },
  { name: "workflow_list_node_types", description: "Read all built-in and custom node contracts before adding or connecting nodes. Use exact typeId and socket names returned here.", inputSchema: object },
  { name: "workflow_list_resources", description: "Read saved workflow metadata, custom node definitions, reusable workflow nodes, current selection, canvas view, and vertex transform.", inputSchema: object },
  { name: "workflow_get_generated_sources", description: "Read Java, vertex GLSL and fragment GLSL from the most recent successful export.", inputSchema: object },
  { name: "workflow_submit_commands", description: "Apply basic graph edits to the active draft: ADD_NODE, REMOVE_NODE, MOVE_NODE, CONNECT, DISCONNECT, SET_PROPERTY, RENAME_NODE, SET_OUTPUT. The bridge validates and waits for the page to apply the batch.", inputSchema: { type: "object", properties: { expectedRevision: { type: "number" }, commands: { type: "array", minItems: 1, items: { type: "object", properties: { type: { type: "string", enum: [...commandTypes] }, payload: { type: "object" } }, required: ["type", "payload"] } } }, required: ["commands"], additionalProperties: false } },
  { name: "workflow_auto_layout", description: "Arrange all current nodes in readable LR or TB columns without changing shader semantics or links.", inputSchema: { type: "object", properties: { direction: { type: "string", enum: ["LR", "TB"] }, gapX: { type: "number" }, gapY: { type: "number" }, startX: { type: "number" }, startY: { type: "number" }, expectedRevision: { type: "number" } }, additionalProperties: false } },
  { name: "workflow_create", description: "Create and open a new saved workflow with the normal starter graph.", inputSchema: { type: "object", properties: projectProperties, additionalProperties: false } },
  { name: "workflow_save", description: "Save the active graph, project configuration and vertex transform into the editor workflow library.", inputSchema: object },
  { name: "workflow_open", description: "Open one workflow from the saved workflow library.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
  { name: "workflow_delete", description: "Delete one saved workflow by id, equivalent to the page library delete button.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
  { name: "workflow_import", description: "Validate, open and save a complete workflow JSON object. It is the agent equivalent of importing a workflow file; filesystem paths are deliberately not accepted.", inputSchema: { type: "object", properties: { workflow: { type: "object" } }, required: ["workflow"], additionalProperties: false } },
  { name: "workflow_load_example", description: "Open the built-in Meng_MingGodSignPlugin example as a normal editable current workflow.", inputSchema: object },
  { name: "workflow_reset", description: "Reset the active draft to the normal starter graph.", inputSchema: object },
  { name: "workflow_add_demo", description: "Add the same UV -> centered UV -> length demonstration chain as the page Add Demo button.", inputSchema: object },
  { name: "workflow_set_project", description: "Update active workflow title, Java plugin class name, shader directory, preview canvas resolution and optional id. previewWidth/previewHeight are GPU preview dimensions in the range 64-4096.", inputSchema: { type: "object", properties: projectProperties, additionalProperties: false } },
  { name: "workflow_set_vertex_transform", description: "Set four vertex coordinates plus translation, scale and rotation used by the vertex page and export.", inputSchema: { type: "object", properties: { vertices: { type: "array", minItems: 4, maxItems: 4, items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } } }, tx: { type: "number" }, ty: { type: "number" }, sx: { type: "number" }, sy: { type: "number" }, rotation: { type: "number" } }, additionalProperties: false } },
  { name: "workflow_set_canvas", description: "Set canvas pan and zoom, equivalent to dragging and zooming the page.", inputSchema: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, zoom: { type: "number" } }, additionalProperties: false } },
  { name: "workflow_select", description: "Select graph nodes by id, equivalent to selecting/box-selecting nodes on the canvas.", inputSchema: { type: "object", properties: { nodeIds: { type: "array", items: { type: "string" } } }, required: ["nodeIds"], additionalProperties: false } },
  { name: "workflow_modify_selection", description: "Run a context-menu operation on the current selection: DELETE, DISCONNECT, SET_PREVIEW, or SAVE_AS_WORKFLOW_NODE.", inputSchema: { type: "object", properties: { operation: { type: "string", enum: ["DELETE", "DISCONNECT", "SET_PREVIEW", "SAVE_AS_WORKFLOW_NODE"] }, enabled: { type: "boolean" }, title: { type: "string" } }, required: ["operation"], additionalProperties: false } },
  { name: "workflow_upsert_custom_node", description: "Create or edit a user custom GLSL node. definition requires custom.* typeId, title, inputs, one output and properties.expression; helperSource is optional.", inputSchema: { type: "object", properties: { definition: { type: "object" } }, required: ["definition"], additionalProperties: false } },
  { name: "workflow_delete_custom_node", description: "Delete a user-defined custom.* node definition. Built-in definitions cannot be deleted.", inputSchema: { type: "object", properties: { typeId: { type: "string" } }, required: ["typeId"], additionalProperties: false } },
  { name: "workflow_expand_workflow_node", description: "Drag-equivalent expansion of a reusable workflow node into the current canvas at canvasX/canvasY.", inputSchema: { type: "object", properties: { workflowNodeId: { type: "string" }, canvasX: { type: "number" }, canvasY: { type: "number" } }, required: ["workflowNodeId"], additionalProperties: false } },
  { name: "workflow_delete_workflow_node", description: "Delete a user-created reusable workflow node by id. Preset workflow nodes cannot be deleted.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
  { name: "workflow_export_runtime", description: "Run the same export as the page. A VEC4 must connect to io.output.color. Returns generated Java, vertex GLSL and fragment GLSL after validation succeeds.", inputSchema: object },
  { name: "workflow_apply_action", description: "Compatibility escape hatch for page actions. Prefer named tools. Supported actions: " + [...actionTypes].join(", ") + ".", inputSchema: { type: "object", properties: { type: { type: "string", enum: [...actionTypes] }, payload: { type: "object" } }, required: ["type"], additionalProperties: false } }
];

function reply(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`); }
function fail(id, message) { process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32602, message } })}\n`); }
async function state() { const response = await fetch(`${bridge}/v1/state`); if (!response.ok) throw new Error(`Bridge state request failed: HTTP ${response.status}`); return response.json(); }
async function post(input) { const response = await fetch(`${bridge}/v1/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); const result = await response.json(); if (!response.ok || result.ok === false) throw new Error(result.error || `Bridge command failed: HTTP ${response.status}`); return result; }
const action = (type, payload = {}) => post({ actions: [{ type, payload }] });
function selectionAction(operation, args) { const types = { DELETE: "DELETE_SELECTED", DISCONNECT: "DISCONNECT_SELECTED", SET_PREVIEW: "TOGGLE_SELECTED_PREVIEW", SAVE_AS_WORKFLOW_NODE: "SAVE_SELECTION_AS_WORKFLOW_NODE" }, type = types[operation]; if (!type) throw new Error("Unknown selection operation"); return action(type, operation === "SET_PREVIEW" ? { enabled: args.enabled } : operation === "SAVE_AS_WORKFLOW_NODE" ? { title: args.title } : {}); }

async function call(name, args = {}) {
  if (name === "workflow_get_current") return state();
  if (name === "workflow_list_node_types") return { catalog: (await state()).catalog || [] };
  if (name === "workflow_list_resources") { const current = await state(); return { project: current.project || null, selection: current.selection || [], view: current.view || null, savedWorkflows: current.savedWorkflows || [], customNodes: current.customNodes || [], workflowNodes: current.workflowNodes || [], vertexTransform: current.vertexTransform || null }; }
  if (name === "workflow_get_generated_sources") return (await state()).generatedSources || { available: false, message: "No successful export has been made yet." };
  if (name === "workflow_submit_commands") { if (!Array.isArray(args.commands) || !args.commands.length || args.commands.some(command => !commandTypes.has(command?.type) || !command.payload || typeof command.payload !== "object")) throw new Error("commands must be a non-empty array of supported commands with object payloads"); return post({ commands: args.commands, expectedRevision: args.expectedRevision }); }
  if (name === "workflow_auto_layout") { const current = await state(), nodes = current.graph?.nodes || [], direction = args.direction === "TB" ? "TB" : "LR", gapX = Number(args.gapX ?? 260), gapY = Number(args.gapY ?? 120), startX = Number(args.startX ?? 80), startY = Number(args.startY ?? 80); const commands = nodes.map((node, index) => ({ type: "MOVE_NODE", payload: { nodeId: node.id, x: direction === "LR" ? startX + Math.floor(index / 6) * gapX : startX + (index % 6) * gapX, y: direction === "LR" ? startY + (index % 6) * gapY : startY + Math.floor(index / 6) * gapY } })); return post({ commands, expectedRevision: args.expectedRevision }); }
  if (name === "workflow_create") return action("NEW_WORKFLOW", args);
  if (name === "workflow_save") return action("SAVE_WORKFLOW");
  if (name === "workflow_open") return action("OPEN_WORKFLOW", args);
  if (name === "workflow_delete") return action("DELETE_WORKFLOW", args);
  if (name === "workflow_import") return action("IMPORT_WORKFLOW_DATA", args);
  if (name === "workflow_load_example") return action("LOAD_MING_GOD_EXAMPLE");
  if (name === "workflow_reset") return action("RESET_CURRENT_DRAFT");
  if (name === "workflow_add_demo") return action("ADD_DEMO");
  if (name === "workflow_set_project") return action("SET_PROJECT_CONFIG", args);
  if (name === "workflow_set_vertex_transform") return action("SET_VERTEX_TRANSFORM", args);
  if (name === "workflow_set_canvas") return action("SET_VIEW", args);
  if (name === "workflow_select") return action("SET_SELECTION", args);
  if (name === "workflow_modify_selection") return selectionAction(args.operation, args);
  if (name === "workflow_upsert_custom_node") return action("UPSERT_CUSTOM_NODE", args);
  if (name === "workflow_delete_custom_node") return action("DELETE_CUSTOM_NODE", args);
  if (name === "workflow_expand_workflow_node") return action("EXPAND_WORKFLOW_NODE", args);
  if (name === "workflow_delete_workflow_node") return action("DELETE_WORKFLOW_NODE", args);
  if (name === "workflow_export_runtime") { await action("EXPORT_RUNTIME"); return (await state()).generatedSources || { available: false, message: "Export was queued but sources were not published." }; }
  if (name === "workflow_apply_action") { if (!actionTypes.has(args.type)) throw new Error("Unsupported page action"); return action(args.type, args.payload || {}); }
  throw new Error("Unknown tool");
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", async raw => {
  let id;
  try {
    const message = JSON.parse(raw), { method, params = {} } = message;
    id = message.id;
    if (method === "notifications/initialized") return;
    if (method === "initialize") return reply(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "workflow-page-bridge", version: "0.3.0" } });
    if (method === "tools/list") return reply(id, { tools });
    if (method === "tools/call") return reply(id, { content: [{ type: "text", text: JSON.stringify(await call(params.name, params.arguments || {}), null, 2) }] });
    if (id !== undefined) return fail(id, "Unsupported method");
  } catch (error) { if (id !== undefined) fail(id, error.message || String(error)); }
});

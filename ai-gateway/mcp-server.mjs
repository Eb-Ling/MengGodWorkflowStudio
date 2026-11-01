import readline from "node:readline";

const bridge = process.env.WORKFLOW_BRIDGE_URL || "http://127.0.0.1:4174";
const commandTypes = new Set(["ADD_NODE", "REMOVE_NODE", "MOVE_NODE", "CONNECT", "DISCONNECT", "SET_PROPERTY", "RENAME_NODE", "SET_OUTPUT"]);
const actionTypes = new Set(["SAVE_WORKFLOW", "EXPORT_RUNTIME", "NEW_WORKFLOW", "RESET_CURRENT_DRAFT", "LOAD_MING_GOD_EXAMPLE", "OPEN_WORKFLOW", "DELETE_WORKFLOW", "IMPORT_WORKFLOW_DATA", "SET_PROJECT_CONFIG", "SET_VERTEX_TRANSFORM", "SET_VIEW", "SET_SELECTION", "DELETE_SELECTED", "DISCONNECT_SELECTED", "TOGGLE_SELECTED_PREVIEW", "SAVE_SELECTION_AS_WORKFLOW_NODE", "EXPAND_WORKFLOW_NODE", "DELETE_WORKFLOW_NODE", "UPSERT_CUSTOM_NODE", "DELETE_CUSTOM_NODE", "ADD_DEMO"]);
const object = { type: "object", additionalProperties: false };
const currentSchema = { type: "object", properties: { includePreviewAssets: { type: "boolean", description: "Debug only. False by default so texture Base64 never consumes normal agent context." }, includeGeneratedSources: { type: "boolean", description: "False by default. Use workflow_get_generated_sources instead." } }, additionalProperties: false };
const projectProperties = { blendMode: {type:"string",enum:["alpha","additive"]}, id: { type: "string" }, title: { type: "string" }, className: { type: "string" }, shaderDir: { type: "string" }, previewWidth: { type: "number", minimum: 64, maximum: 4096 }, previewHeight: { type: "number", minimum: 64, maximum: 4096 } };
const tools = [
  { name: "workflow_get_status", description: "Always call first. Reports bridge reachability, active-editor connection, editor lease and draft revision without returning graph data. If editorConnected is false, ask the user to activate the intended EXE page; do not use shell or open another editor page.", inputSchema: object },
  { name: "workflow_get_summary", description: "Normal agent read path. Returns the active unsaved draft's project, revision, nodes, links, selection and output status. Texture preview Base64, generated sources, saved workflow bodies and libraries are omitted.", inputSchema: object },
  { name: "workflow_get_current", description: "Diagnostic full draft read for the active editor only. It never opens or selects a saved workflow. Preview image Base64 and generated source are omitted unless explicitly requested; prefer workflow_get_summary during normal work.", inputSchema: currentSchema },
  { name: "workflow_agent_instructions", description: "Read the mandatory safe workflow-agent procedure before editing: status, summary, node contracts, revision-guarded commands and verification.", inputSchema: object },
  { name: "workflow_list_node_types", description: "Read all built-in and custom node contracts before adding or connecting nodes. Use exact typeId and socket names returned here.", inputSchema: object },
  { name: "workflow_list_resources", description: "Read metadata for saved workflows and current-page libraries. This is read-only and never opens or switches to a saved workflow.", inputSchema: object },
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
  { name: "workflow_set_vertex_transform", description: "Update vertex geometry, local transform and typed vertex graph. Omitted fields retain the current draft.", inputSchema: { type: "object", properties: { vertices: { type: "array", minItems: 4, maxItems: 4, items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } } }, tx: { type: "number" }, ty: { type: "number" }, sx: { type: "number" }, sy: { type: "number" }, rotation: { type: "number" }, graph: { type:"object", properties:{nodes:{type:"array",items:{type:"object"}},output:{type:"string"}},required:["nodes","output"] } }, additionalProperties: false } },
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
function connectionStatus(current) { return { bridgeUrl: bridge, bridgeReachable: true, editorConnected: current.editorConnected === true, activeEditorId: current.activeEditorId || null, draft: current.graph ? { projectId: current.project?.id || null, title: current.project?.title || null, revision: current.graph.revision ?? null, nodeCount: current.graph.nodes?.length || 0, linkCount: current.graph.links?.length || 0 } : null }; }
async function activeState() { const current=await state(); if (!current.editorConnected) throw new Error("No active editor draft is connected. In the intended EXE window, click the canvas or Workflow > Detect Bridge, then retry. Do not open another editor page or use shell as a substitute."); return current; }
function sanitizeNode(node, includePreviewAssets=false) { const copy=JSON.parse(JSON.stringify(node)); const dataUrl=copy.properties?.previewDataUrl; if(typeof dataUrl === "string" && dataUrl) { if(!includePreviewAssets) { delete copy.properties.previewDataUrl; copy.previewAsset={ available:true, bytes:dataUrl.length }; } } return copy; }
function sanitizedGraph(graph, includePreviewAssets=false) { return { schemaVersion:graph?.schemaVersion ?? 1, revision:graph?.revision ?? 0, outputNodeId:graph?.outputNodeId ?? null, nodes:(graph?.nodes || []).map(node=>sanitizeNode(node,includePreviewAssets)), links:graph?.links || [] }; }
function summary(current) { const graph=sanitizedGraph(current.graph); return { connection:connectionStatus(current), project:current.project || null, graph, selection:current.selection || [], view:current.view || null, vertexTransform:current.vertexTransform || null, outputConnected:!!graph.links.find(link=>link.toNode===graph.outputNodeId && link.toSocket==="color") }; }
const agentInstructions = `You are operating the user's currently active, unsaved Workflow Shader draft through MCP tools. Required sequence: (1) call workflow_get_status; stop and ask the user to activate the intended EXE page if editorConnected is false. (2) call workflow_get_summary. (3) call workflow_list_node_types only when node contracts are needed. (4) submit the smallest possible workflow_submit_commands batch with expectedRevision from the summary. (5) call workflow_get_summary again and verify the intended change. Never open another editor page, scan disk for workflows, manually send JSON-RPC through shell, or call workflow_open/workflow_create/workflow_import/workflow_reset unless the user explicitly requests that action. Do not request preview image data unless the user specifically asks for texture debugging.`;
async function post(input) { const response = await fetch(`${bridge}/v1/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); const result = await response.json(); if (!response.ok || result.ok === false) throw new Error(result.error || `Bridge command failed: HTTP ${response.status}`); return result; }
const action = (type, payload = {}) => post({ actions: [{ type, payload }] });
function selectionAction(operation, args) { const types = { DELETE: "DELETE_SELECTED", DISCONNECT: "DISCONNECT_SELECTED", SET_PREVIEW: "TOGGLE_SELECTED_PREVIEW", SAVE_AS_WORKFLOW_NODE: "SAVE_SELECTION_AS_WORKFLOW_NODE" }, type = types[operation]; if (!type) throw new Error("Unknown selection operation"); return action(type, operation === "SET_PREVIEW" ? { enabled: args.enabled } : operation === "SAVE_AS_WORKFLOW_NODE" ? { title: args.title } : {}); }

async function call(name, args = {}) {
  if (name === "workflow_get_status") { try { return connectionStatus(await state()); } catch (error) { return { bridgeUrl:bridge, bridgeReachable:false, editorConnected:false, error:error.message || String(error) }; } }
  if (name === "workflow_get_summary") return summary(await activeState());
  if (name === "workflow_get_current") { const current=await activeState(), includePreviewAssets=args.includePreviewAssets===true; return { connection:connectionStatus(current), project:current.project || null, graph:sanitizedGraph(current.graph,includePreviewAssets), selection:current.selection || [], view:current.view || null, vertexTransform:current.vertexTransform || null, savedWorkflows:current.savedWorkflows || [], customNodes:current.customNodes || [], workflowNodes:current.workflowNodes || [], catalog:current.catalog || [], generatedSources:args.includeGeneratedSources===true ? (current.generatedSources || null) : undefined, previewAssetsIncluded:includePreviewAssets }; }
  if (name === "workflow_agent_instructions") return { instructions:agentInstructions };
  if (name === "workflow_list_node_types") return { catalog: (await activeState()).catalog || [] };
  if (name === "workflow_list_resources") { const current = await activeState(); return { project: current.project || null, selection: current.selection || [], view: current.view || null, savedWorkflows: current.savedWorkflows || [], customNodes: current.customNodes || [], workflowNodes: current.workflowNodes || [], vertexTransform: current.vertexTransform || null }; }
  if (name === "workflow_get_generated_sources") return (await activeState()).generatedSources || { available: false, message: "No successful export has been made yet." };
  if (name === "workflow_submit_commands") { if (!Array.isArray(args.commands) || !args.commands.length || args.commands.some(command => !commandTypes.has(command?.type) || !command.payload || typeof command.payload !== "object")) throw new Error("commands must be a non-empty array of supported commands with object payloads"); return post({ commands: args.commands, expectedRevision: args.expectedRevision }); }
  if (name === "workflow_auto_layout") { const current = await activeState(), nodes = current.graph?.nodes || [], direction = args.direction === "TB" ? "TB" : "LR", gapX = Number(args.gapX ?? 260), gapY = Number(args.gapY ?? 120), startX = Number(args.startX ?? 80), startY = Number(args.startY ?? 80); const commands = nodes.map((node, index) => ({ type: "MOVE_NODE", payload: { nodeId: node.id, x: direction === "LR" ? startX + Math.floor(index / 6) * gapX : startX + (index % 6) * gapX, y: direction === "LR" ? startY + (index % 6) * gapY : startY + Math.floor(index / 6) * gapY } })); return post({ commands, expectedRevision: args.expectedRevision }); }
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
  if (name === "workflow_export_runtime") { await action("EXPORT_RUNTIME"); return (await activeState()).generatedSources || { available: false, message: "Export was queued but sources were not published." }; }
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
    if (method === "initialize") return reply(id, { protocolVersion: "2024-11-05", capabilities: { tools: {}, resources: {} }, serverInfo: { name: "workflow-page-bridge", version: "0.4.0" } });
    if (method === "tools/list") return reply(id, { tools });
    if (method === "resources/list") return reply(id, { resources: [{ uri:"workflow://active/summary", name:"Active workflow summary", description:"The active editor's sanitized current draft summary. No preview image bytes.", mimeType:"application/json" }] });
    if (method === "resources/read") { if(params.uri!=="workflow://active/summary") throw new Error("Unknown resource URI"); return reply(id,{ contents:[{ uri:params.uri, mimeType:"application/json", text:JSON.stringify(summary(await activeState()),null,2) }] }); }
    if (method === "tools/call") return reply(id, { content: [{ type: "text", text: JSON.stringify(await call(params.name, params.arguments || {}), null, 2) }] });
    if (id !== undefined) return fail(id, "Unsupported method");
  } catch (error) { if (id !== undefined) fail(id, error.message || String(error)); }
});

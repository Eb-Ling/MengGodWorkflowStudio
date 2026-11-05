import {documentPolicy} from '../plugins/workflow-service/document-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import {GraphStore} from '../packages/kernel/index.mjs';
import {createNodeCatalog} from '../plugins/node-model/node-catalog.mjs';
import {starterGraph} from '../packages/workflow-tools/defaults.mjs';
import {WorkflowRepository} from '../frontend/project/workflow-repository.js';
import {WorkflowService} from '../plugins/workflow-service/document-session.mjs';
import {createDocumentController} from '../frontend/application/document-controller.js';

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value))};
}

function project() {
  const session = memoryStorage(), local = memoryStorage();
  const repository = new WorkflowRepository({session, local});
  const service=new WorkflowService(repository);
  createDocumentController({service,...documentPolicy(()=>createNodeCatalog()),getStage:()=>"fragment",onError:()=>{}});
  return {session,local,repository,service};
}

function graphStore(graph = starterGraph(), overrides = {}) {
  return new GraphStore(graph, {
    starterGraph, nodeTitle: node => node.typeId,
    outputType: () => 'io.output', connectionError: () => null,
    resolveTypes: () => {}, pruneInvalidLinks: () => {}, ...overrides
  });
}

test('graph commands isolate caller data; moving does not invalidate shader previews', () => {
  const initial = starterGraph(), store = graphStore(initial);
  const preview = store.snapshot().previewRevision;
  store.moveNodes([{id: 'uv_start', x: 5, y: 9}, {id: 'center_start', x: 20, y: 30}]);
  assert.equal(store.snapshot().previewRevision, preview);
  assert.equal(initial.nodes[0].canvasX, 120);
  store.undo();
  assert.equal(store.node('center_start').canvasX, 410);
  assert.ok(store.snapshot().previewRevision > preview);
  store.redo();
  assert.equal(store.node('uv_start').canvasX, 5);
  const node = {id: 'new', typeId: 'io.output', canvasX: 0, canvasY: 0, properties: {}};
  store.command('ADD_NODE', {node});
  node.properties.changedOutside = true;
  const snapshot = store.snapshot();
  snapshot.nodes.length = 0;
  assert.equal(store.node('new').properties.changedOutside, undefined);
  assert.equal(store.snapshot().outputNodeId, 'new');
});

test('rejected links preserve graph, redo and undo history; unknown commands fail', () => {
  const store = graphStore(undefined, {connectionError: () => '跨分支连线'});
  store.command('SET_PROPERTY', {nodeId: 'uv_start', key: 'previewEnabled', value: false});
  store.undo();
  const before = store.snapshot(), undo = store.undoStack.length, redo = store.redoStack.length;
  assert.deepEqual(store.command('CONNECT', {link: {fromNode:'uv_start',fromSocket:'value',toNode:'center_start',toSocket:'a'}}), {ok: false, error: '跨分支连线'});
  assert.deepEqual(store.snapshot(), before);
  assert.equal(store.undoStack.length, undo);
  assert.equal(store.redoStack.length, redo);
  assert.throws(() => store.command('TYPO', {}), /未知节点命令/);
  assert.equal(store.undoStack.length, undo);
  assert.equal(store.redo(), true);
  assert.equal(store.node('uv_start').properties.previewEnabled, false);
});

test('bulk removal is one undo step and restores links and output', () => {
  const graph = starterGraph(); graph.outputNodeId = 'center_start';
  const store = graphStore(graph);
  store.removeNodes(['center_start', 'length_start']);
  assert.equal(store.snapshot().nodes.length, 1);
  assert.equal(store.snapshot().links.length, 0);
  assert.equal(store.snapshot().outputNodeId, null);
  assert.equal(store.undoStack.length, 1);
  store.undo();
  assert.deepEqual(store.snapshot().nodes, graph.nodes);
  assert.deepEqual(store.snapshot().links, graph.links);
  assert.equal(store.snapshot().outputNodeId, 'center_start');
});

test('save gathers the current stage and the other draft, without mutating the saved entry on open', () => {
  const {service, local} = project();
  service.open({...service.newConfig(), id: 'one'}, starterGraph());
  const fragment = service.fragment(); fragment.nodes[0].title = 'saved fragment';
  service.persistGraph('fragment', fragment);
  const vertex = service.graph('vertex'); vertex.nodes[0].title = 'saved vertex';
  const saved = service.save('vertex', vertex);
  assert.equal(saved.document.graphs.fragment.nodes[0].title, 'saved fragment');
  assert.equal(saved.document.graphs.vertex.nodes[0].title, 'saved vertex');
  const bytes = local.getItem('workflow.documents');
  fragment.nodes[0].title = 'unsaved fragment'; service.persistGraph('fragment', fragment);
  vertex.nodes[0].title = 'unsaved vertex'; service.persistGraph('vertex', vertex);
  service.open(saved.config, saved.document.graphs.fragment, {...saved.document.geometry,graph:saved.document.graphs.vertex});
  assert.equal(local.getItem('workflow.documents'), bytes);
  assert.equal(service.fragment().nodes[0].title, 'saved fragment');
  assert.equal(service.graph('vertex').nodes[0].title, 'saved vertex');
  saved.document.graphs.fragment.nodes[0].title = 'external change';
  assert.equal(service.fragment().nodes[0].title, 'saved fragment');
});

test('runtime paths persist per project, default for new projects, and remain separate from unsaved drafts', () => {
  const {service} = project();
  service.open({...service.newConfig(), id: 'first'}, starterGraph());
  const first = service.save('fragment', service.fragment());
  service.open({...service.newConfig(), id: 'second'}, starterGraph());
  service.setRuntimePath('data/method/changed');
  assert.equal(service.save('fragment', service.fragment(), {existingOnly: true}), null);
  assert.equal(service.library().length, 1);
  assert.equal(service.newConfig().runtimePath, 'data/method/changed');
  service.open(first.config, first.document.graphs.fragment, {...first.document.geometry,graph:first.document.graphs.vertex});
  assert.equal(service.config().runtimePath, 'data/method');
  service.delete(first.id);
  assert.equal(service.library().length, 0);
  assert.throws(() => service.delete(first.id), /未找到工作流/);
});

test('old storage keys are not read and the library contains only canonical documents',()=>{
 const {service,local,session,repository}=project();
 const oldConfig=JSON.stringify({id:'old'});local.setItem('workflow.projectConfig',oldConfig);local.setItem('workflow.graph',JSON.stringify(starterGraph()));
 local.setItem('workflow.library',JSON.stringify([{id:'old',config:{id:'old'}}]));
 assert.equal(service.config().id,'default');assert.deepEqual(service.library(),[]);assert.equal(session.getItem('workflow.projectConfig'),null);
 service.save('fragment',service.fragment());const saved=JSON.parse(local.getItem('workflow.documents'));
 assert.equal(saved[0].kind,'studio.document');assert.equal(saved[0].config,undefined);assert.equal(saved[0].graph,undefined);
 assert.equal(local.getItem('workflow.projectConfig'),oldConfig);
 local.setItem('workflow.documents','{}');assert.throws(()=>repository.getLibrary(),/文档数组/);
});

test('library IO failure propagates while the edited draft remains available', () => {
  const {service, local} = project();
  service.open(service.newConfig(), starterGraph());
  const graph = service.fragment(); graph.nodes[0].title = 'recoverable';
  const setItem = local.setItem;
  local.setItem = (key, value) => { if (key === 'workflow.documents') throw Error('quota'); setItem(key, value); };
  assert.throws(() => service.save('fragment', graph), /quota/);
  assert.equal(service.fragment().nodes[0].title, 'recoverable');
});

test('catalog and example factories do not share mutable node definitions', () => {
  const first = createNodeCatalog(), second = createNodeCatalog();
  first[0].title = 'changed'; first[0].properties.external = true;
  assert.notEqual(second[0].title, 'changed');
  assert.equal(second[0].properties.external, undefined);
  const definition = {typeId: 'custom.test', title: 'test', properties: {}, inputs: [], outputs: []};
  const custom = createNodeCatalog({customNodes: [definition]}).at(-1);
  custom.properties.changed = true;
  assert.deepEqual(definition.properties, {});
});

test('domain/service modules do not reach into DOM/storage globals or UI entry points', async () => {
  for (const file of ['../plugins/node-model/node-catalog.mjs', '../packages/workflow-tools/defaults.mjs', '../plugins/workflow-service/document-session.mjs', 'project/workflow-repository.js']) {
    const source = await fs.readFile(new URL('../frontend/' + file, import.meta.url), 'utf8');
    const forbidden=new Set(['document','window','localStorage','sessionStorage']);
    const check=node=>{if(ts.isPropertyAccessExpression(node)&&ts.isIdentifier(node.expression))assert.ok(!forbidden.has(node.expression.text),file);ts.forEachChild(node,check);};
    check(ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS));
    assert.doesNotMatch(source, /(?:import|from)\s*['"][^'"]*(?:app\.js|geometry-settings|runtime-dependency)/, file);
  }
  for (const file of ['../plugins/workflow-service/application.mjs']) {
    const source = await fs.readFile(new URL('../frontend/' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:getItem|setItem)\(\s*['"]workflow\.(?:projectConfig|graph|vertexTransform|library|runtimePath)['"]/, file);
  }
});

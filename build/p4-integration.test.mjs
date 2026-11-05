import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {noiseHarness} from './noise-test-support.mjs';
import {p4Nodes,p4Graph} from './p4-test-support.mjs';
import {exportFixture} from './module-export-fixture.mjs';
import {emitModule} from '../plugins/glsl-backend/emitter.mjs';
import { defaultVertexGraph } from '../packages/workflow-tools/defaults.mjs';
import {buildRuntimeSources} from '../plugins/starsector/runtime-exporter.mjs';
import {mathContribution} from '../plugins/math/contribution.mjs';

test('all 51 migrated nodes compile in the actual graph pipeline for both targets',()=>{
  for(const target of ['glsl-es-300','glsl-430']){
    const {compiler,semantics}=noiseHarness(target);
    for(const def of p4Nodes){const graph=p4Graph(def);semantics.validateStageGraph(graph,'fragment');const shader=compiler.fragmentSource(graph);assert.ok(shader.startsWith(target==='glsl-430'?'#version 430\n':'#version 300 es\n'));assert.doesNotMatch(shader,/\b(?:sdBox|sdLance|lanceTaper|segDist|rot2|bezier4)\(/);}
  }
  assert.equal(emitModule({module:{},target:'unknown'}).ok,false);
});
test('game export accepts only structured stage IR and preserves three-file ABI',async()=>{
 assert.deepEqual(Object.keys(await buildRuntimeSources(exportFixture)),['java','vertex','fragment']);
 await assert.rejects(()=>buildRuntimeSources({...exportFixture,fragment:'#version 300 es'}),/结构化 IR/);
});
test('shared compiler/catalog contain no migrated algorithm dispatch or helper libraries',async()=>{
  for(const file of ['plugins/compiler/lower.mjs','plugins/node-model/node-catalog.mjs']){
    const text=await fs.readFile(file,'utf8');assert.doesNotMatch(text,/studio\.(?:math|sdf)\.|shaderLibrary|sdBox|segDist|lanceTaper|bezier4/);
  }
});

test('disabled Math preserves resolved vec4 port snapshots and valid links through reopen',()=>{
  const h=noiseHarness(),graph={revision:0,outputNodeId:'out',nodes:[{id:'combine',typeId:'studio.math.vector.combine',canvasX:0,canvasY:0,properties:{valueType:'VEC4'}},{id:'out',typeId:'io.output',canvasX:400,canvasY:0,properties:{}}],links:[{fromNode:'combine',fromSocket:'value',toNode:'out',toSocket:'color'}]};
  h.semantics.validateStageGraph(graph,'fragment');assert.equal(graph.nodes[0].portSnapshot.outputs[0].type,'VEC4');
  const saved=structuredClone(graph);h.mathHandle.dispose();
  h.semantics.validateStageGraph(saved,'fragment');assert.deepEqual(saved,graph);assert.throws(()=>h.compiler.fragmentSource(saved),/缺少节点插件/);
  h.registry.register('studio.math','1.0.0',mathContribution());assert.doesNotThrow(()=>h.compiler.fragmentSource(saved));
});

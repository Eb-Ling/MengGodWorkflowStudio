import {documentPolicy} from '../plugins/workflow-service/document-policy.mjs';
import {emitModule} from '../plugins/glsl-backend/emitter.mjs';
function harnessEmit(module,target){const r=emitModule({module,target});assert.equal(r.ok,true,JSON.stringify(r.diagnostics));return r.source;}
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { noiseContribution } from "../plugins/noise/contribution.mjs";
import { noiseHarness, noiseGraph } from "./noise-test-support.mjs";
import { createDocumentController } from "../frontend/application/document-controller.js";
import { WorkflowService } from "../plugins/workflow-service/document-session.mjs";
import { WorkflowRepository } from "../frontend/project/workflow-repository.js";
import { createDocument } from "../packages/plugin-sdk/document.mjs";
import { defaultVertexGraph } from "../packages/workflow-tools/defaults.mjs";
import {mingGodSignGraph} from '../plugins/templates/examples.mjs';

test("all ten Noise nodes use registered IR in both shader stages and targets", () => {
  for (const target of ["glsl-es-300", "glsl-430"])
    for (const stage of ["fragment", "vertex"]) {
      const { semantics, compiler } = noiseHarness(target, stage);
      for (const node of noiseContribution().nodes) {
        const graph = noiseGraph(node.typeId, stage);
        semantics.validateStageGraph(graph, stage);
        const source =
          stage === "vertex"
            ? harnessEmit(compiler.vertexModule(graph), target)
            : compiler.fragmentSource(graph);
        assert.match(source, /wf_ir_/);
        assert.doesNotMatch(
          source,
          /valueNoise\(|previewSimplex3\(|fbmValue\(/,
        );
        assert.ok(source.length < 200000, "Emitted source is bounded");
      }
    }
});
test("current Noise data opens while disabled, preserves links and properties, and resolves again on re-enable", () => {
  const harness = noiseHarness();
  const memory = () => {
    const data = new Map();
    return {
      getItem: (k) => data.get(k) || null,
      setItem: (k, v) => data.set(k, v),
    };
  };
  const repository = new WorkflowRepository({
    local: memory(),
    session: memory(),
  });
  const old = noiseGraph("studio.noise.fbm");
  old.nodes.find((n) => n.id === "noise").properties = {
    scale: "4.0",
    previewEnabled: true,
    customProperty: "retained",
  };
  harness.semantics.validateStageGraph(old, "fragment");
  repository.setDocument(
    createDocument({
      project: { id: "noise" },
      graphs: { fragment: old, vertex: defaultVertexGraph() },
    }),
  );
  harness.handle.dispose();
  const { document } = createDocumentController({
    service: new WorkflowService(repository),
    ...documentPolicy(()=>harness.catalog),
    getStage: () => "fragment",
  });
  const restored = document.graph("fragment"),
    node = restored.nodes.find((n) => n.id === "noise");
  assert.deepEqual(restored.links, old.links);
  assert.deepEqual(
    node.properties,
    old.nodes.find((n) => n.id === "noise").properties,
  );
  assert.deepEqual(node.plugin, { id: "studio.noise", version: "1.0.0" });
  assert.equal(node.portSnapshot.inputs[1].name, "octaves");
  assert.equal(document.snapshot().requiredPlugins["studio.noise"], "1.0.0");
  assert.throws(
    () => harness.compiler.fragmentSource(restored),
    /缺少节点插件/,
  );
  harness.registry.register("studio.noise", "1.0.0", noiseContribution());
  assert.match(harness.compiler.fragmentSource(restored), /wf_ir_/);
  assert.deepEqual(document.graph("fragment"), restored);
});
test("shared production compiler and node catalog no longer contain Noise implementations", () => {
  for (const file of [
    "plugins/compiler/lower.mjs",
    "plugins/node-model/node-catalog.mjs",
  ]) {
    const source = fs.readFileSync(
      new URL("../" + file, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /noise\.|valueNoise\(|previewSimplex3\(|fbmValue\(/,
      file,
    );
  }
});

test("built-in example uses current namespaced nodes and retired IDs are rejected", () => {
  const { semantics, compiler } = noiseHarness();
  const graph = mingGodSignGraph();
  semantics.validateStageGraph(graph, "fragment");
  assert.equal(
    graph.nodes.find((n) => n.id === "sign_turbulence").typeId,
    "studio.noise.turbulence3",
  );
  assert.ok(
    compiler.graphInputs(graph).every((input) => input.type === "FLOAT"),
  );
  assert.throws(
    () => semantics.validateStageGraph(noiseGraph("noise.fbm"), "fragment"),
    /未知节点类型/,
  );
});

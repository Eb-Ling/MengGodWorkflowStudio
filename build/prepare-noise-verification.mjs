import {emitModule} from '../plugins/glsl-backend/emitter.mjs';
// 开发算法回归夹具，和真实用户导出路径分别记录；不用于替用户建图。
import fs from "node:fs/promises";
import path from "node:path";
import { noiseContribution } from "../plugins/noise/contribution.mjs";
import { noiseHarness, noiseGraph } from "./noise-test-support.mjs";
const out = path.resolve("build/verification/noise-algorithms-" + Date.now());
await fs.mkdir(out, { recursive: true });
const baseline = await fs.readFile(
  "build/fixtures/noise-p2-baseline.glsl",
  "utf8",
);
const functions = {
  value: "valueNoise(v_uv)",
  fbm: "fbmValue(v_uv)",
  simplex: "simplexNoise(v_uv)",
  perlin: "perlinNoise(v_uv)",
  fbmSimplex: "fbmSimplex(v_uv)",
  worley: "worleyNoise(v_uv)",
  fbmWorley: "fbmWorley(v_uv)",
  turbulence: "turbulence(v_uv)",
  turbulize: "abs(v_uv.x)",
  turbulence3: "turbulence3(vec3(v_uv,0.37))",
};
for (const node of noiseContribution().nodes) {
  // 这三个算法已明确修正语义，旧画面不再是正确性基准；由 noise-mcp-acceptance 的独立参考覆盖。
  if (['studio.noise.fbm','studio.noise.simplex','studio.noise.fbmSimplex'].includes(node.typeId)) continue;
  const id = node.typeId.split(".").at(-1),
    { compiler } = noiseHarness();
  await fs.writeFile(
    path.join(out, id + ".frag"),
    compiler
      .fragmentSource(noiseGraph(node.typeId))
      .replace("#version 420", "#version 430"),
  );
  await fs.writeFile(
    path.join(out, id + ".reference.frag"),
    `#version 430\nin vec2 v_uv;out vec4 fragColor;\n${baseline}\nvoid main(){fragColor=vec4(vec3(${functions[id]}),1.0);}`,
  );
  const vertex=noiseHarness('glsl-430','vertex').compiler.vertexModule(noiseGraph(node.typeId,'vertex'));
  const result=emitModule({module:vertex,target:'glsl-430'});if(!result.ok)throw Error(JSON.stringify(result.diagnostics));
  await fs.writeFile(path.join(out,id+'.vert'),result.source);
}
await fs.writeFile("build/verification/latest-noise-algorithms.txt", out);
console.log(out);

// Read-only comparison of the local release against the source checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {uiSourceHashes} from './build-ui.mjs';
const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(path.join(root,'desktop/package.json'));
const {extractFile}=require('@electron/asar');
const {version}=JSON.parse(await fs.readFile(path.join(root,'desktop/package.json'),'utf8'));
const releaseFolder=process.env.WORKFLOW_RELEASE_FOLDER||`MengGod-Workflow-Studio-${version}-win-x64`;
if(path.basename(releaseFolder)!==releaseFolder||!releaseFolder.startsWith('MengGod-Workflow-Studio-'))throw Error('Invalid release folder');
const release=path.join(root,'release',releaseFolder);
const hashes={};
for (const retired of ['frontend/vertex.html','frontend/custom-node.html','frontend/runtime/WorkflowRuntime.java','frontend/runtime/WorkflowBatch.java','frontend/runtime/WorkflowGlState.java','ai-gateway/mcp-server.mjs','packages/kernel/plugin-host.mjs','frontend/compiler/workflow-compiler.js','frontend/compiler/ir-emitter.js','frontend/compiler/shader-targets.js','frontend/compiler/backends/glsl-430.js','frontend/compiler/backends/glsl-es-300.js','frontend/application/compilation-api.mjs']) {
  assert.equal(await fs.stat(path.join(release,'resources',retired)).then(()=>true,()=>false),false,'Retired compatibility file leaked: '+retired);
}
async function compare(relative,sourceRelative=relative){
  const source=await fs.readFile(path.join(root,sourceRelative));
  assert.deepEqual(await fs.readFile(path.join(release,'resources',relative)),source,relative+' differs in release');
  hashes[relative]=createHash('sha256').update(source).digest('hex');
}
async function walk(relative,sourceRelative=relative){
  for(const entry of await fs.readdir(path.join(root,sourceRelative),{withFileTypes:true})){
    if(entry.name==="node_modules")continue;
    const next=path.join(relative,entry.name);
    const sourceNext=path.join(sourceRelative,entry.name);
    if(entry.isDirectory())await walk(next,sourceNext);else if(entry.isFile())await compare(next,sourceNext);
  }
}
assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'build/ui/build-info.json'),'utf8')).sources,await uiSourceHashes(),'UI build is stale');
await walk('frontend','build/ui');
for(const folder of ['ai-gateway','assets','packages','plugins'])await walk(folder);
await compare('AI_WORKFLOW_FORMAT.md');
const archive=path.join(release,'resources/app.asar');
for(const file of ['main.cjs','preload.cjs','bridge-port.cjs','profile-storage.cjs','plugin-controller.cjs','project-controller.cjs','access-controller.cjs','mcp-credentials.cjs'])assert.deepEqual(extractFile(archive,file),await fs.readFile(path.join(root,'desktop',file)),file+' differs in app.asar');
assert.equal(JSON.parse(extractFile(archive,'package.json').toString()).version,version);
assert.ok((await fs.stat(path.join(release,'MengGod Workflow Studio.exe'))).size>1000000);
await fs.mkdir(path.join(root,'build/verification'),{recursive:true});
await fs.writeFile(path.join(root,'build/verification/release-package-check.json'),JSON.stringify({version,release,hashes},null,2));
console.log(`PASS: release ${version}; ${Object.keys(hashes).length} resource files and all eight Electron source files match source`);

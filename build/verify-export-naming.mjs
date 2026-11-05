// 只比较实际下载：本轮 GLSL 局部名字有意变化，Java ABI/依赖源码必须逐字保持。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [current,baseline]=process.argv.slice(2), hash=v=>createHash('sha256').update(v).digest('hex');
const read=async root=>JSON.parse(await fs.readFile(path.join(root,'report.json'),'utf8'));
const now=await read(current), before=await read(baseline), results=[];
for(const d of now.downloads){
  const prior=before.downloads.find(b=>b.name===d.name);assert.ok(prior);
  const java='src/data/scripts/'+d.name+'.java';
  assert.deepEqual(await fs.readFile(path.join(d.directory,java)),await fs.readFile(path.join(prior.directory,java)));
  const shaders=[];
  const files=await fs.readdir(d.directory,{recursive:true});
  for(const ext of ['vert','frag']){
    const file=files.find(f=>f.endsWith('.'+ext));assert.ok(file);
    const a=hash(await fs.readFile(path.join(d.directory,file))),b=hash(await fs.readFile(path.join(prior.directory,file)));
    shaders.push({file,sha256:a,baselineSha256:b,changed:a!==b});
  }
  results.push({name:d.name,javaIdentical:true,shaders});
}
for(const entry of now.dependencies){
  const source=typeof entry==='string'?entry:entry.source;
  const prior=path.join(baseline,path.relative(current,source));
  assert.deepEqual(await fs.readFile(source),await fs.readFile(prior));
}
await fs.writeFile(path.join(current,'naming-contract.json'),JSON.stringify({ok:true,baseline,results,dependencyCount:now.dependencies.length},null,2));
console.log(`PASS: ${results.length} actual Java exports and ${now.dependencies.length} dependencies are byte-identical; shader name differences recorded`);

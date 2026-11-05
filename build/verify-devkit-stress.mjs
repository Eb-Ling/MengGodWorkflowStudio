// 仅对实际下载并在源码外解压的 SDK 执行，这些是开发者夹具，真实 UI 事件另行验收。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const [kit,electron,out]=process.argv.slice(2).map(p=>path.resolve(p));
await fs.mkdir(out,{recursive:true});
const cli=path.join(kit,'packages/plugin-testkit/cli.mjs'), results=[];
async function run(name,mode,dirs,fixture){
  const output=path.join(out,name+'.json'),args=[cli,mode,...dirs,'--output',output];
  if(mode==='smoke')args.push('--electron',electron);
  if(fixture){const file=path.join(out,name+'-fixtures.json');await fs.writeFile(file,JSON.stringify(fixture));args.push('--fixtures',file);}
  await promisify(execFile)(process.execPath,args,{cwd:kit,windowsHide:true,timeout:120000,maxBuffer:4*1024*1024});
  const report=JSON.parse(await fs.readFile(output,'utf8'));assert.equal(report.ok,true);
  if(mode==='smoke'){
    assert.equal(report.remainingWindows,0);
    for(const r of report.rounds){assert.deepEqual(r.remaining,{runners:0,nodes:0,panels:0});assert.equal(r.measurementAfterDispose.windows,0);}
  }
  results.push({name,output});return report;
}
const dirs=['examples/consumer','examples/provider','examples/node'];
const fixture=JSON.parse(await fs.readFile(path.join(kit,'examples/fixtures.json'),'utf8'));
const matrix=await run('matrix','matrix',dirs);
assert.equal(matrix.cases.find(c=>c.name==='only:local.kit-consumer').accepted,false);
assert.equal(matrix.cases.find(c=>c.name==='without-provider:local.kit-provider').accepted,false);
const first=await run('seed-20261103','smoke',dirs,fixture);
const replay=await run('replay-20261103','smoke',[...dirs].reverse(),fixture);
assert.deepEqual(first.schedule,replay.schedule);
assert.deepEqual(first.rounds.map(r=>({trace:r.trace,activations:r.activations})),replay.rounds.map(r=>({trace:r.trace,activations:r.activations})));
const another=await run('seed-20261104','smoke',dirs,{...fixture,seed:20261104});
assert.notDeepEqual(first.schedule.rounds,another.schedule.rounds);
// 独立可选消费者：真实沙箱必须能单装，并在提供者出现/缺席时重新获取能力。
const folder=path.join(kit,'stress-fixtures/optional');await fs.mkdir(folder,{recursive:true});
const base=JSON.parse(await fs.readFile(path.join(kit,'examples/consumer/studio-plugin.json'),'utf8'));
await fs.writeFile(path.join(folder,'studio-plugin.json'),JSON.stringify({...base,id:'local.optional',requiredApis:{'studio.extension-ui':'^1.0.0'},optionalApis:{'local.kit-provider.value':'^1.0.0'}}));
await fs.writeFile(path.join(folder,'index.mjs'),`export const plugin={async activate(c){
const available=c.hasApi('local.kit-provider.value');
const value=available?await c.api('local.kit-provider.value').read():-1;
if(value!==(available?42:-1))throw Error('可选 API 返回异常');
if(!available){let denied=false;try{c.api('local.kit-provider.value')}catch{denied=true}if(!denied)throw Error('缺席 API 没有撤销');}
await c.api('studio.extension-ui').create({id:c.pluginId+'.panel',title:'可选提供者检查',tree:{id:'value',type:'text',text:String(value)}});
}};`);
await run('optional-alone','smoke',[folder],{seed:20261103,cycles:3,settleMs:100});
const combined=await run('optional-transitions','smoke',[...dirs,folder],fixture);
for(const r of combined.rounds){
  const c=r.checkpoints.find(c=>c.phase==='disabled'&&c.pluginId==='local.kit-provider');
  assert.ok(c.enabled.includes('local.optional'));assert.ok(!c.enabled.includes('local.kit-consumer'));
  assert.equal(c.resources.panels,1);
}
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({ok:true,kit,results,replayIdentical:true,
  rounds:first.rounds.length+replay.rounds.length+another.rounds.length+combined.rounds.length+3,
  scope:'真实 Electron 沙箱与内存 UI，不包含实际输入/点击，不证明长期内存上限'},null,2));
console.log('PASS: seeded replay, dependency matrix, optional provider transitions, lifecycle/resource checkpoints');

// 对实际下载并在仓库外解压的测试包做开发者故障验收，不冒充桌面安装。
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const [kit,electron,output]=process.argv.slice(2).map(x=>path.resolve(x)),results=[];
const base=JSON.parse(await fs.readFile(path.join(kit,'examples/provider/studio-plugin.json'),'utf8'));
const argsRoot=path.join(kit,'negative-fixtures');await fs.mkdir(argsRoot,{recursive:true});
async function check(name,args,pattern){
  const destination=path.join(argsRoot,name+'.json');let exit;
  try{await promisify(execFile)(process.execPath,[path.join(kit,'packages/plugin-testkit/cli.mjs'),...args,'--output',destination],{cwd:kit,windowsHide:true,timeout:30000});exit=0;}catch(e){exit=e.code;}
  const report=JSON.parse(await fs.readFile(destination,'utf8'));assert.equal(exit,1);assert.equal(report.ok,false);assert.match(report.error,pattern);results.push({name,rejected:true,error:report.error.split('\n')[0]});
}
await check('missing-provider',['check','examples/consumer'],/缺少兼容/);
await check('declarative-smoke',['smoke','examples/visual','--electron',electron],/无脚本插件请用 check/);
for(const [name,source,pattern] of [
  ['activate-error',"export const plugin={activate(){throw Error('intentional activate')}};",/intentional activate/],
  ['cleanup-error',"export const plugin={activate(c){c.onDispose(()=>{throw Error('intentional cleanup')});}};",/intentional cleanup/],
  ['hang',"export const plugin={activate(){while(true){}}};",/超时/],
]){
  const folder=path.join(argsRoot,name);await fs.mkdir(folder,{recursive:true});
  await fs.writeFile(path.join(folder,'studio-plugin.json'),JSON.stringify({...base,id:'local.'+name,providesApis:{},activationEvents:[]}));
  await fs.writeFile(path.join(folder,'index.mjs'),source);
  await check(name,['smoke',folder,'--electron',electron],pattern);
}
const bad=path.join(argsRoot,'invalid-ir');await fs.cp(path.join(kit,'examples/node'),bad,{recursive:true});
await fs.writeFile(path.join(bad,'index.mjs'),(await fs.readFile(path.join(bad,'index.mjs'),'utf8')).replace("ir.literal('FLOAT',2)","ir.literal('BOOL',true)"));
await check('invalid-ir',['smoke',bad,'--electron',electron,'--fixtures','examples/fixtures.json'],/IR 输出类型不匹配/);
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify({ok:true,kit,results},null,2));
console.log('PASS: standalone downloaded devkit rejects '+results.length+' dependency, lifecycle and IR faults');

// 开发者 Electron 夹具启动器。保持标准流到进程退出，避免 Windows GUI 提前脱离管道。
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),script=path.resolve(root,process.argv[2]),out=path.resolve(root,process.argv[3]);
if(!script.startsWith(path.join(root,'build')+path.sep)||!out.startsWith(path.join(root,'build','verification')+path.sep))throw Error('Verification paths must stay in build');
await fs.mkdir(path.dirname(out),{recursive:true});
try{const result=await promisify(execFile)(path.join(root,'desktop/node_modules/electron/dist/electron.exe'),[script,'--result='+out],{cwd:root,windowsHide:true,timeout:45000,maxBuffer:8*1024*1024});await fs.writeFile(out+'.log',result.stdout+'\n'+result.stderr);const report=JSON.parse(await fs.readFile(out,'utf8'));if(!report.ok)throw Error(JSON.stringify(report));console.log(JSON.stringify(report,null,2));}
catch(error){await fs.writeFile(out+'.log',String(error.stdout||'')+'\n'+String(error.stderr||''));console.error(await fs.readFile(out,'utf8').catch(()=>String(error)));process.exitCode=1;}

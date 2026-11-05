import {execFile} from 'node:child_process';import {promisify} from 'node:util';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),duration=Number(process.argv[2]||600000),out=path.join(root,'build/verification/p69-isolation-'+duration+'.json');
try {
  const r=await promisify(execFile)(path.join(root,'desktop/node_modules/electron/dist/electron.exe'),['build/p69-isolation-check.cjs','--result='+out,'--duration='+duration],{cwd:root,windowsHide:true,timeout:duration+60000,maxBuffer:4*1024*1024});
  await fs.writeFile(out+'.log',r.stdout+'\n'+r.stderr);
  const report=JSON.parse(await fs.readFile(out,'utf8'));console.log(JSON.stringify({...report,samples:report.samples?.length}));if(!report.ok)process.exitCode=1;
} catch(e) {await fs.writeFile(out+'.log',(e.stdout||'')+'\n'+(e.stderr||'')+'\n'+String(e));console.error(await fs.readFile(out,'utf8').catch(()=>String(e)));process.exitCode=1;}

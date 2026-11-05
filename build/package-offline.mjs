// Reuse an installed Electron distribution. The desktop application has no production npm dependencies.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildUi} from './build-ui.mjs';
import {createHash} from 'node:crypto';
import {buildResourceGuard} from './build-resource-guard.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),desktop=path.join(root,'desktop'),require=createRequire(path.join(desktop,'package.json'));
const {createPackage}=require('@electron/asar'),pkg=JSON.parse(await fs.readFile(path.join(desktop,'package.json'),'utf8'));
const releaseFolder=process.env.WORKFLOW_RELEASE_FOLDER||`MengGod-Workflow-Studio-${pkg.version}-win-x64`;
if(path.basename(releaseFolder)!==releaseFolder||!releaseFolder.startsWith('MengGod-Workflow-Studio-'))throw Error('Invalid release folder');
const output=path.join(root,'release',releaseFolder),staging=path.join(root,'build/verification/desktop-app');
buildResourceGuard();
await buildUi();
await fs.mkdir(staging,{recursive:true});
for(const file of ['main.cjs','preload.cjs','bridge-port.cjs','profile-storage.cjs','plugin-controller.cjs','project-controller.cjs','access-controller.cjs','mcp-credentials.cjs'])await fs.copyFile(path.join(desktop,file),path.join(staging,file));
await fs.writeFile(path.join(staging,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,main:pkg.main,productName:pkg.build.productName},null,2));
// 已运行的 Windows DLL/EXE 会被锁定，内容相同无需重写。不同内容仍正常报错，不强制关闭用户程序。
async function sameFile(source,target){
  try{const [a,b]=await Promise.all([fs.stat(source),fs.stat(target)]);if(a.size!==b.size)return false;
    const hash=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');return await hash(source)===await hash(target);
  }catch(error){if(error.code==='ENOENT')return false;throw error;}
}
const electronRoot=path.join(desktop,'node_modules/electron/dist');
await fs.cp(electronRoot,output,{recursive:true,filter:async source=>{
  if(source===path.join(electronRoot,'electron.exe'))return false;
  if(!(await fs.stat(source)).isFile())return true;
  return !(await sameFile(source,path.join(output,path.relative(electronRoot,source))));
}});
const stagedArchive=path.join(root,'build/verification/desktop-app.asar'),archive=path.join(output,'resources/app.asar');
await createPackage(staging,stagedArchive);
if(!await sameFile(stagedArchive,archive))await fs.copyFile(stagedArchive,archive);
// 同步生成资源而不移除被运行进程作为 cwd 的目录，仅删除已退出源码清单的生成文件。
async function syncDirectory(source,target){
  if(!target.startsWith(path.resolve(output,'resources')+path.sep))throw Error('Invalid generated release target');
  await fs.cp(source,target,{recursive:true,filter:p=>!p.split(path.sep).includes('node_modules')});
  async function prune(current){
    for(const entry of await fs.readdir(current,{withFileTypes:true})){
      const file=path.join(current,entry.name);
      if(entry.isDirectory())await prune(file);
      else {
        const original=path.join(source,path.relative(target,file));
        if(!file.startsWith(target+path.sep))throw Error('Invalid stale resource path');
        const exists=await fs.stat(original).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});
        if(!exists)await fs.unlink(file);
      }
    }
  }
  await prune(target);
}
const frontendTarget=path.resolve(output,'resources/frontend');
if(!frontendTarget.startsWith(path.resolve(root,'release')+path.sep))throw new Error('Invalid frontend output path');
await syncDirectory(path.join(root,'build/ui'),frontendTarget);
for(const folder of ['ai-gateway','assets','packages','plugins']){
  const target=path.resolve(output,'resources',folder);
  if(!target.startsWith(path.resolve(root,'release')+path.sep)||!target.startsWith(path.resolve(output,'resources')+path.sep))throw new Error('Invalid generated release target');
  await syncDirectory(path.join(root,folder),target);
}
await fs.copyFile(path.join(root,'AI_WORKFLOW_FORMAT.md'),path.join(output,'resources/AI_WORKFLOW_FORMAT.md'));
const electronSource=path.join(electronRoot,'electron.exe'),executable=path.join(output,'MengGod Workflow Studio.exe');
if(!await sameFile(electronSource,executable))await fs.copyFile(electronSource,executable);
console.log(output);

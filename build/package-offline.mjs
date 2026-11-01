// Reuse an installed Electron distribution. The desktop application has no production npm dependencies.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),desktop=path.join(root,'desktop'),require=createRequire(path.join(desktop,'package.json'));
const {createPackage}=require('@electron/asar'),pkg=JSON.parse(await fs.readFile(path.join(desktop,'package.json'),'utf8'));
const output=path.join(root,'release',`MengGod-Workflow-Studio-${pkg.version}-win-x64`),staging=path.join(root,'build/verification/desktop-app');
await fs.mkdir(staging,{recursive:true});
for(const file of ['main.cjs','preload.cjs'])await fs.copyFile(path.join(desktop,file),path.join(staging,file));
await fs.writeFile(path.join(staging,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,main:pkg.main,productName:pkg.build.productName},null,2));
await fs.cp(path.join(desktop,'node_modules/electron/dist'),output,{recursive:true});
await createPackage(staging,path.join(output,'resources/app.asar'));
for(const folder of ['frontend','ai-gateway','assets'])await fs.cp(path.join(root,folder),path.join(output,'resources',folder),{recursive:true});
await fs.copyFile(path.join(root,'AI_WORKFLOW_FORMAT.md'),path.join(output,'resources/AI_WORKFLOW_FORMAT.md'));
await fs.rename(path.join(output,'electron.exe'),path.join(output,'MengGod Workflow Studio.exe'));
console.log(output);

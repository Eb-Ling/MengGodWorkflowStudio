// 仅通过正式 EXE 的可见按钮、原生文件选择器和下载完成项目 UI 验收。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {userActions} from './plugin-user-actions.mjs';
const {_electron}=createRequire(import.meta.url)('playwright'),root=path.resolve(import.meta.dirname,'..');
export async function projectUiUserPath(){
 const out=path.join(root,'build/verification/p52-project-user-'+Date.now());await fs.mkdir(out,{recursive:true});const old=path.join(out,'old-format.json');await fs.writeFile(old,JSON.stringify({nodes:[],links:[]}));
 const app=await _electron.launch({executablePath:path.join(root,'release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe'),args:['--user-data-dir='+out+'/profile'],acceptDownloads:true}),page=await app.firstWindow(),errors=[],warnings=[],downloads=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[Vue warn]'))warnings.push(m.text())});
 const actions=userActions(page,root,out,downloads);
 async function choose(file){const waiting=page.waitForEvent('filechooser');await page.click('#choose-workflow-file');await (await waiting).setFiles(file);}
 try{
  await page.waitForSelector('body[data-ui-ready="true"]');
  await page.click('#workflow-manager');await page.fill('#workflow-title','P52 项目');await page.click('#save-current-workflow');await page.click('#close-workflow-dialog');
  for(let i=0;i<3;i++){
   await page.click('#workflow-manager');await actions.toggle('studio.project-ui',false);await page.locator('#workflow-dialog').filter({hasText:/项目界面插件已停用/}).waitFor();assert.equal(await page.locator('#workflow-title').count(),0);assert.equal(await page.locator('#export-runtime').count(),0);await page.screenshot({path:path.join(out,'project-disabled-'+i+'.png')});
   await actions.toggle('studio.project-ui',true);await page.locator('#workflow-title').waitFor();assert.equal(await page.locator('#workflow-title').inputValue(),'P52 项目');assert.equal(await page.locator('#runtime-dependency-dialog').count(),1);await page.click('#close-workflow-dialog');
  }
  await page.click('#import-workflow');await choose(old);await page.locator('#import-status').filter({hasText:/导入失败/}).waitFor();assert.equal(await page.locator('#workflow-name').innerText(),'P52 项目');assert.equal(await page.locator('.workflow-node').count(),3);
  const example=path.join(root,'plugins/templates/instanced-wave.workflow.json');await choose(example);await page.locator('#import-status').filter({hasText:/导入成功/}).waitFor();await page.click('#close-import-dialog');assert.equal(await page.locator('#workflow-name').innerText(),'实例波动四边形');
  await page.click('#workflow-manager');await page.fill('#workflow-title','临时改名');await page.click('#save-current-workflow');await page.click('#close-workflow-dialog');await page.click('#import-workflow');await choose(example);await page.locator('#import-status').filter({hasText:/导入成功/}).waitFor();await page.click('#close-import-dialog');assert.equal(await page.locator('#workflow-name').innerText(),'实例波动四边形');
  await actions.exportEffect('ProjectUiEffect',true);
  await page.click('#runtime-dependency-settings');await page.getByLabel('依赖源码包路径',{exact:true}).fill('../bad');await page.getByLabel('依赖源码包路径',{exact:true}).press('Tab');assert.equal(await page.locator('#export-runtime-source').isDisabled(),true);await page.getByRole('button',{name:'关闭运行依赖设置'}).click();
  await page.click('#workflow-manager');await page.locator('[data-open-example]').click();await page.locator('.compile-card .pill').filter({hasText:/^可导出$/}).waitFor();await actions.exportEffect('P52FadeEffect');
  const shader=await fs.readFile(downloads.at(-1).files.find(f=>f.endsWith('.frag')),'utf8');assert.match(shader,/1\.0 - smoothstep\(0\.5, 1\.0, distance\)/);assert.doesNotMatch(shader,/smoothstep\(1\.0, 0\.5/);
  await page.click('#workflow-manager');await page.screenshot({path:path.join(out,'project-manager.png')});await page.click('#close-workflow-dialog');
  assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({ok:true,route:'desktop UI only',checks:['three project UI stop/start cycles','host manager remains available','save and reopen values','invalid legacy import preserves draft','valid import and same-file reselection','first dependency then three-file effect','invalid dependency path blocked','real MingGod export contains defined radial fade'],downloads,dependencies:[path.join(out,'WorkflowRuntime.java')],errors,warnings},null,2));return {app,page,out};
 }catch(e){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:e.stack,errors,warnings},null,2));await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});await app.close();throw e;}
}

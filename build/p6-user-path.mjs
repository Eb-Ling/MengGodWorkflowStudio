// 正式 EXE 的纯桌面路线。文件夹由原生选择器选择，不注入登记、图或应用状态。
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {userActions} from './plugin-user-actions.mjs';
const {_electron}=createRequire(import.meta.url)('playwright'),root=path.resolve(import.meta.dirname,'..');
export async function startP6(){
 const out=path.join(root,'build/verification/p6-user-'+Date.now());await fs.mkdir(path.join(out,'my-tools'),{recursive:true});
 const state={out,directory:path.join(out,'my-tools'),errors:[],warnings:[],downloads:[]};await launch(state);return state;
}
async function launch(s){
 s.app=await _electron.launch({executablePath:path.join(root,'release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe'),args:['--user-data-dir='+path.join(s.out,'profile')],acceptDownloads:true});s.page=await s.app.firstWindow();s.page.setDefaultTimeout(12000);
 s.page.on('pageerror',e=>s.errors.push(e.message));s.page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[Vue warn]'))s.warnings.push(m.text());});
 await s.page.waitForSelector('body[data-ui-ready="true"]');await s.page.locator('.workflow-node').first().waitFor();
}
export async function installP6(s){
 const {page}=s;await page.locator('#plugin-manifest-form').waitFor();
 await page.selectOption('#plugin-kind','extension');await page.fill('#plugin-name','本地右移工具');await page.fill('#plugin-id','local.my-tools');await page.check('#plugin-create-template');
 await page.click('#plugin-save');await page.getByRole('alert').filter({hasText:'请审阅'}).waitFor();
 await page.check('#plugin-approve-permissions');await page.screenshot({path:path.join(s.out,'permission-review.png')});await page.click('#plugin-save');await page.locator('#plugin-manifest-form').waitFor({state:'detached'});
 await page.click('#close-workflow-dialog');await page.getByRole('button',{name:'右移节点',exact:true}).waitFor();
 const first=page.locator('.workflow-node').first(),before=await first.boundingBox();await page.getByRole('button',{name:'右移节点',exact:true}).click();await page.getByText('已移动 3 个节点，可一次撤销。',{exact:true}).waitFor();
 assert.ok(Math.abs((await first.boundingBox()).x-before.x-32)<1,'public guarded batch moves visible nodes');await first.locator('.node-header').click();await page.keyboard.press('Control+z');await page.waitForTimeout(150);assert.ok(Math.abs((await first.boundingBox()).x-before.x)<1);
 await page.getByLabel('右移步长',{exact:true}).fill('64');await page.getByLabel('右移步长',{exact:true}).press('Tab');await page.waitForTimeout(300);
 await page.getByRole('button',{name:'右移节点',exact:true}).click();await page.getByText('已移动 1 个节点，可一次撤销。',{exact:true}).waitFor();assert.ok(Math.abs((await first.boundingBox()).x-before.x-64)<1);
 await page.screenshot({path:path.join(s.out,'isolated-panel.png')});
 for(let i=0;i<3;i++){await page.click('#workflow-manager');const card=page.locator('[data-plugin-id="local.my-tools"]');await card.getByRole('button',{name:/^停用 /}).click();await page.getByRole('button',{name:'右移节点',exact:true}).waitFor({state:'detached'});await card.getByRole('button',{name:/^启用 /}).click();await page.click('#close-workflow-dialog');await page.getByRole('button',{name:'右移节点',exact:true}).waitFor();}
 await page.click('#workflow-manager');const card=page.locator('[data-plugin-id="local.my-tools"]');await card.getByRole('button',{name:'编辑声明',exact:true}).click();
 const permissions=JSON.parse(await page.locator('#plugin-permissions').inputValue());permissions.requiredApis['local.missing.api']='^1.0.0';await page.fill('#plugin-permissions',JSON.stringify(permissions,null,2));await page.check('#plugin-approve-permissions');await page.click('#plugin-save');await page.getByRole('alert').filter({hasText:'缺少兼容 API'}).last().waitFor();
 await page.getByRole('button',{name:'关闭插件声明',exact:true}).click();await page.click('#close-workflow-dialog');await page.getByRole('button',{name:'右移节点',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'右移节点',exact:true}).count(),1);
 await s.app.close();await launch(s);await s.page.getByRole('button',{name:'右移节点',exact:true}).waitFor();
 await s.page.click('#workflow-manager');await s.page.click('#open-instance-example');await userActions(s.page,root,s.out,s.downloads).exportEffect('P6Effect',true);
 assert.deepEqual(s.errors,[]);assert.deepEqual(s.warnings,[]);
 await fs.writeFile(path.join(s.out,'report.json'),JSON.stringify({ok:true,route:'desktop only, native folder selector',checks:['generated UI plugin from empty folder','visible permission review required','isolated panel edits guarded draft','one undo','remote field changes','three enable/disable cycles','failed replacement restores old panel','full EXE restart restores plugin','actual dependency and three-file effect'],errors:s.errors,warnings:s.warnings,downloads:s.downloads,dependencies:[path.join(s.out,'WorkflowRuntime.java')]},null,2));
 return s.out;
}

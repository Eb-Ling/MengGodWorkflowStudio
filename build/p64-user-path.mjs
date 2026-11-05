// 桌面验收只使用可见控件、鼠标/键盘、原生选择器和真实下载。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {userActions} from './plugin-user-actions.mjs';
const {_electron}=createRequire(import.meta.url)('playwright');
const root=path.resolve(import.meta.dirname,'..');
async function launch(s){
  s.app=await _electron.launch({executablePath:s.executablePath??path.join(root,'release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe'),args:['--user-data-dir='+path.join(s.out,'profile')],acceptDownloads:true});
  s.page=await s.app.firstWindow();s.page.setDefaultTimeout(12000);
  s.page.on('pageerror',e=>s.errors.push(e.message));
  s.page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[Vue warn]'))s.warnings.push(m.text());});
  await s.page.waitForSelector('body[data-ui-ready="true"]');
  await s.page.locator('.workflow-node').first().waitFor();
}
async function closeSize(page,locator){
  const button=await locator.boundingBox(),icon=await locator.locator('svg').boundingBox();
  assert.ok(button.width>=40&&button.height>=40,JSON.stringify(button));
  assert.ok(Math.abs(icon.width-24)<0.1);assert.ok(Math.abs(icon.height-24)<0.1);
}
export async function startP64(executablePath){
  const out=path.join(root,'build/verification/p64-user-'+Date.now());
  const s={out,executablePath,directory:path.join(out,'my-window'),downloads:[],errors:[],warnings:[]};
  await fs.mkdir(s.directory,{recursive:true});await launch(s);
  const p=s.page;
  await p.click('#workflow-manager');await closeSize(p,p.locator('#close-workflow-dialog'));
  await p.locator('#close-workflow-dialog svg').click();
  await p.click('#plugin-center-open');await closeSize(p,p.locator('#close-plugin-center'));
  await p.screenshot({path:path.join(out,'close-button.png')});
  await p.click('#plugin-add-local');return s;
}
export async function finishP64(s, installed = false){
  let p=s.page;const card=()=>p.locator('[data-plugin-id="local.window-tools"]');
  const tab=name=>p.getByRole('tab',{name,exact:true}).click();
  if (!installed) {
  await p.locator('#plugin-manifest-form').waitFor();
  await p.selectOption('#plugin-kind','declarative');
  await p.fill('#plugin-name','窗口与设置工具');await p.fill('#plugin-id','local.window-tools');
  await p.fill('#decl-title','我的工作流工具');await p.selectOption('#decl-placement','settings');
  assert.equal(await p.locator('#decl-side').count(),0);
  await p.check('#plugin-approve-permissions');await p.screenshot({path:path.join(s.out,'settings-declaration.png')});
  await p.click('#plugin-save');await p.locator('#plugin-manifest-form').waitFor({state:'detached'});
  }
  assert.equal(JSON.stringify(await fs.readdir(s.directory)),JSON.stringify(['studio-plugin.json']));
  const first=p.locator('.workflow-node').first(),before=await first.boundingBox();
  await tab('插件设置');await p.getByRole('button',{name:'展开插件配置 我的工作流工具',exact:true}).click();await p.getByRole('button',{name:'移动节点',exact:true}).click();
  await p.getByText('已移动 3 个节点，可一次撤销。',{exact:true}).waitFor();
  assert.ok(Math.abs((await first.boundingBox()).x-before.x-32)<1);
  await p.getByRole('button',{name:'撤销',exact:true}).click();await p.waitForTimeout(250);
  assert.ok(Math.abs((await first.boundingBox()).x-before.x)<1);
  await p.screenshot({path:path.join(s.out,'extension-settings.png')});
  await tab('插件管理');await card().getByRole('button',{name:'编辑声明',exact:true}).click();
  await p.selectOption('#decl-placement','dialog');await p.check('#plugin-approve-permissions');
  await p.click('#plugin-save');await p.locator('#plugin-manifest-form').waitFor({state:'detached'});
  await tab('插件设置');assert.equal(await p.getByRole('button',{name:'移动节点',exact:true}).count(),0);
  const open=async()=>{const expand=p.getByRole('button',{name:'展开插件配置 我的工作流工具',exact:true});if(await expand.count())await expand.click();await p.getByRole('button',{name:'打开插件窗口 我的工作流工具',exact:true}).click();};
  const close=()=>p.getByRole('button',{name:'关闭插件窗口 我的工作流工具',exact:true});
  await open();await closeSize(p,close());
  await p.getByLabel('水平位移',{exact:true}).fill('64');await p.getByLabel('水平位移',{exact:true}).press('Tab');await p.waitForTimeout(200);
  await p.getByRole('button',{name:'移动节点',exact:true}).click();await p.getByText('已移动 3 个节点，可一次撤销。',{exact:true}).waitFor();
  assert.ok(Math.abs((await first.boundingBox()).x-before.x-64)<1);
  await p.screenshot({path:path.join(s.out,'extension-dialog.png')});
  await close().locator('svg').click();await open();
  assert.equal(await p.getByLabel('水平位移',{exact:true}).inputValue(),'64');
  await p.getByRole('button',{name:'撤销',exact:true}).click();await p.waitForTimeout(250);
  assert.ok(Math.abs((await first.boundingBox()).x-before.x)<1);
  await close().focus();await p.keyboard.press('Enter');await open();await p.keyboard.press('Escape');
  assert.equal(await p.locator('#plugin-center[open]').count(),1);
  await tab('插件管理');assert.equal(await close().count(),0);
  for(let i=0;i<3;i++){
    await card().getByRole('button',{name:/^停用 /}).click();await tab('插件设置');assert.equal(await p.getByRole('button',{name:'打开插件窗口 我的工作流工具',exact:true}).count(),0);
    await tab('插件管理');await card().getByRole('button',{name:/^启用 /}).click();await tab('插件设置');await open();await close().click();await tab('插件管理');
  }
  await p.locator('[data-plugin-id="studio.extension-ui"]').getByRole('button',{name:/^停用 /}).click();
  await p.locator('#plugin-impact-dialog[open]').waitFor();await p.click('#plugin-impact-confirm');
  await card().getByRole('button',{name:/^启用 /}).click();
  await p.waitForTimeout(2300);
  await card().getByRole('button',{name:/^停用 /}).waitFor();
  await p.locator('[data-plugin-id="studio.extension-ui"]').getByRole('button',{name:/^停用 /}).waitFor();
  await p.click('#close-plugin-center');
  await s.app.close();await launch(s);p=s.page;
  await p.waitForTimeout(2300);
  await p.click('#plugin-center-open');await tab('插件设置');await open();
  assert.equal(await p.getByLabel('水平位移',{exact:true}).inputValue(),'32');
  await close().click();await p.click('#close-plugin-center');
  await fs.copyFile(path.join(s.directory,'studio-plugin.json'),path.join(s.out,'installed-studio-plugin.json'));
  await p.click('#workflow-manager');await p.click('#open-instance-example');
  await userActions(p,root,s.out,s.downloads).exportEffect('P64Effect',true);
  assert.deepEqual(s.errors,[]);assert.deepEqual(s.warnings,[]);
  await fs.writeFile(path.join(s.out,'report.json'),JSON.stringify({ok:true,route:'desktop only; native directory picker; visual settings/dialog placement',checks:['40px button / 24px SVG','pointer, Enter and Escape close','single JSON native installation','settings page batch action and undo','dialog edit/action, reopen keeps session values','three stop/start cycles','provider cascade and recovery','restart restores placement','actual runtime and three-file download'],downloads:s.downloads,dependencies:[path.join(s.out,'WorkflowRuntime.java')],errors:s.errors,warnings:s.warnings},null,2));
  return s.out;
}

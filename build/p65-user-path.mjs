// 只通过可见页面、原生目录选择器及真实下载验收，不注入插件登记或应用状态。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {userActions} from './plugin-user-actions.mjs';
const {_electron}=createRequire(import.meta.url)('playwright'),root=path.resolve(import.meta.dirname,'..');
async function launch(s){
  s.app=await _electron.launch({executablePath:s.executablePath,args:['--user-data-dir='+path.join(s.out,'profile')],acceptDownloads:true});
  s.page=await s.app.firstWindow();s.page.setDefaultTimeout(12000);
  s.page.on('pageerror',e=>s.errors.push(e.message));
  s.page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[Vue warn]'))s.warnings.push(m.text());});
  await s.page.waitForSelector('body[data-ui-ready="true"]');await s.page.locator('.workflow-node').first().waitFor();
}
export async function startP65(executablePath){
  const out=path.join(root,'build/verification/p65-user-'+Date.now()),s={out,executablePath,downloads:[],errors:[],warnings:[]};
  await fs.mkdir(out,{recursive:true});await launch(s);
  await s.page.click('#plugin-center-open');await s.page.getByRole('tab',{name:'开发者示例',exact:true}).click();
  const download=s.page.waitForEvent('download');await s.page.click('#plugin-download-devkit');
  s.kit=path.join(out,(await download).suggestedFilename());await (await download).saveAs(s.kit);
  await s.page.screenshot({path:path.join(out,'developer-kit.png')});
  return s;
}
export async function chooseP65(s){
  await s.page.getByRole('tab',{name:'插件管理',exact:true}).click();await s.page.click('#plugin-add-local');
}
export async function finishP65(s,installed=false){
  let p=s.page;
  if(!installed){
  await p.locator('#plugin-manifest-form').waitFor();assert.equal(await p.locator('#plugin-id').inputValue(),'local.kit-visual');
  await p.check('#plugin-approve-permissions');await p.click('#plugin-save');await p.locator('#plugin-manifest-form').waitFor({state:'detached'});
  }
  await p.click('#close-plugin-center');
  const first=p.locator('.workflow-node').first(),before=await first.boundingBox();
  await p.getByRole('button',{name:'移动节点',exact:true}).click();await p.getByText('已移动 3 个节点，可一次撤销。',{exact:true}).waitFor();
  assert.ok(Math.abs((await first.boundingBox()).x-before.x-32)<1);
  await p.getByRole('button',{name:'撤销',exact:true}).click();await p.waitForTimeout(150);
  assert.ok(Math.abs((await first.boundingBox()).x-before.x)<1);
  await p.screenshot({path:path.join(s.out,'downloaded-example.png')});
  await p.click('#plugin-center-open');
  for(let i=0;i<3;i++){
    const card=p.locator('[data-plugin-id="local.kit-visual"]');
    await card.getByRole('button',{name:/^停用 /}).click();await card.getByRole('button',{name:/^启用 /}).click();
    for(let n=0;n<100 && !await card.getByRole('button',{name:/^停用 /}).isEnabled().catch(()=>false);n++)await p.waitForTimeout(100);
    assert.ok(await card.getByRole('button',{name:/^停用 /}).isEnabled());
  }
  await s.app.close();await launch(s);p=s.page;await p.waitForTimeout(2300);
  await p.getByRole('button',{name:'移动节点',exact:true}).waitFor();
  await p.click('#workflow-manager');await p.click('#open-instance-example');
  await userActions(p,root,s.out,s.downloads).exportEffect('P65Effect',true);
  assert.equal(s.errors.length,0);assert.equal(s.warnings.length,0);
  await fs.writeFile(path.join(s.out,'report.json'),JSON.stringify({ok:true,route:'desktop only: download SDK archive, native folder installation, edit and restart',kit:s.kit,downloads:s.downloads,dependencies:[path.join(s.out,'WorkflowRuntime.java')],errors:s.errors,warnings:s.warnings},null,2));
  return s.out;
}

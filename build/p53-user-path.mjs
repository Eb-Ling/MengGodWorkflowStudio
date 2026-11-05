// 仅正式 EXE 的可见组件、键盘、指针与下载，不读取或注入私有状态。
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {userActions} from './plugin-user-actions.mjs';
const {_electron}=createRequire(import.meta.url)('playwright'),root=path.resolve(import.meta.dirname,'..');
export async function p53UserPath(){
 const out=path.join(root,'build/verification/p53-user-'+Date.now());await fs.mkdir(out,{recursive:true});
 const app=await _electron.launch({executablePath:path.join(root,'release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe'),args:['--user-data-dir='+out+'/profile'],acceptDownloads:true});const page=await app.firstWindow();page.setDefaultTimeout(10000);
 const errors=[],warnings=[],downloads=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[Vue warn]'))warnings.push(m.text())});
 const actions=userActions(page,root,out,downloads),pause=()=>page.waitForTimeout(100);
 try{
  await page.waitForSelector('body[data-ui-ready="true"]');await page.locator('.workflow-node').first().waitFor();
  const separator=page.getByRole('separator',{name:'调整节点库宽度'}),value=async()=>Number(await separator.getAttribute('aria-valuenow'));
  const initial=await value();await separator.focus();await page.keyboard.press('ArrowRight');assert.equal(await value(),initial+8);await page.keyboard.press('Home');assert.equal(await value(),170);await page.keyboard.press('End');assert.equal(await value(),400);await page.keyboard.press('Home');
  const bar=await separator.boundingBox();await page.mouse.move(bar.x+bar.width/2,bar.y+60);await page.mouse.down();await page.mouse.move(bar.x+bar.width/2+52,bar.y+60,{steps:8});await page.mouse.up();assert.equal(await value(),222);
  const before=await page.locator('#canvas-shell').boundingBox();await page.getByRole('button',{name:'收起节点库',exact:true}).click();assert.ok((await page.locator('#canvas-shell').boundingBox()).width>before.width+100);await page.getByRole('button',{name:'展开节点库',exact:true}).press('Space');assert.equal(await value(),222);
  await page.getByRole('button',{name:'收起检查器',exact:true}).click();await page.getByRole('button',{name:'展开检查器',exact:true}).press('Enter');
  await page.getByRole('button',{name:'展开画布策略',exact:true}).click();const selection=page.getByLabel('框选规则',{exact:true});
  const first=page.locator('.workflow-node').first();
  async function boxHalf(){const b=await first.boundingBox();await page.keyboard.down('Shift');await page.mouse.move(b.x-10,b.y-10);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');await pause();}
  await selection.selectOption('studio.interaction.contain');await boxHalf();assert.equal(await page.locator('.workflow-node.selected').count(),0);
  await selection.selectOption('studio.interaction.intersect');await boxHalf();assert.equal(await page.locator('.workflow-node.selected').count(),1);
  await first.locator('.node-header').click();await page.keyboard.press('Control+a');assert.equal(await page.locator('.workflow-node.selected').count(),3);
  const original=await first.boundingBox();await page.mouse.move(original.x+40,original.y+17);await page.mouse.down();await page.mouse.move(original.x+105,original.y+47,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();assert.ok(Math.abs((await first.boundingBox()).x-original.x)<1);
  await page.click('#workflow-manager');await page.click('#example-canvas-extension');await page.click('#close-workflow-dialog');
  await page.getByRole('switch',{name:'使用 32 像素步长',exact:true}).focus();await page.keyboard.press('Space');assert.equal(await page.getByRole('switch',{name:'使用 32 像素步长',exact:true}).getAttribute('aria-checked'),'true');
  await page.getByLabel('自动布局策略',{exact:true}).selectOption('example.showcase.translate');const old=await first.boundingBox();await page.click('#apply-canvas-layout');await pause();assert.ok(Math.abs((await first.boundingBox()).x-old.x-32)<1);await page.locator('.graph-editor').focus();await page.keyboard.press('Control+z');await pause();assert.ok(Math.abs((await first.boundingBox()).x-old.x)<1);
  await page.getByLabel('节点显示顺序',{exact:true}).selectOption('example.showcase.alphabetical');await selection.selectOption('example.showcase.center');
  await page.screenshot({path:path.join(out,'extension-strategies.png')});
  await page.click('#workflow-manager');await actions.toggle('example.showcase',false);await page.click('#close-workflow-dialog');assert.equal(await page.getByRole('switch',{name:'使用 32 像素步长',exact:true}).count(),0);assert.equal(await selection.inputValue(),'studio.interaction.intersect');assert.equal(await page.getByLabel('节点显示顺序',{exact:true}).inputValue(),'studio.interaction.document-order');
  await page.click('#workflow-manager');await actions.toggle('example.showcase',true);await page.click('#close-workflow-dialog');
  await page.setViewportSize({width:1024,height:700});await pause();assert.ok((await page.locator('#canvas-shell').boundingBox()).width>300);await page.screenshot({path:path.join(out,'compact-layout.png')});await page.setViewportSize({width:1440,height:900});
  for(let i=0;i<3;i++){
    await page.click('#workflow-manager');await page.locator('[data-plugin-id="studio.ui"]').getByRole('button',{name:/^停用 /}).click();await page.locator('#restore-core-ui').waitFor();assert.equal(await page.locator('.graph-editor').count(),0);await page.click('#restore-core-ui');await page.locator('.graph-editor').waitFor();await page.locator('#restore-core-ui').waitFor({state:'detached'});await pause();assert.equal(await page.locator('.workflow-node').count(),3);
  }
  await page.click('#workflow-manager');await page.locator('#open-instance-example').click();await actions.exportEffect('P53Effect',true);
  assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({ok:true,route:'desktop UI only',checks:['keyboard/pointer SplitView','Dock collapse/expand and focus','contain/intersect measured selection','Ctrl+A and Escape cancel','independent custom strategies + dock + Toggle','single undo for custom layout','provider disposal restores default strategies','1024x700 layout','three core UI stop/recovery cycles','actual dependency and three-file export'],errors,warnings,downloads,dependencies:[path.join(out,'WorkflowRuntime.java')]},null,2));return {app,page,out};
 }catch(e){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:e.stack,errors,warnings},null,2));await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});await app.close();throw Error(e.message+'; evidence: '+out);}
}

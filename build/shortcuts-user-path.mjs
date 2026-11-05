// 可见控件、按键和真实下载验收，不注入图、配置或私有桥接状态。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {userActions} from './plugin-user-actions.mjs';
const {_electron}=createRequire(import.meta.url)('playwright'), root=path.resolve(import.meta.dirname,'..');
export let lastShortcutState;
async function launch(s){
  s.app=await _electron.launch({executablePath:path.join(root,'release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe'),args:['--user-data-dir='+path.join(s.out,'profile')],acceptDownloads:true});
  s.page=await s.app.firstWindow();s.page.setDefaultTimeout(12000);
  s.page.on('pageerror',e=>s.errors.push(e.message));s.page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[Vue warn]'))s.warnings.push(m.text());});
  await s.page.waitForSelector('body[data-ui-ready="true"]');await s.page.locator('.workflow-node').first().waitFor();
}
async function settings(p){await p.click('#plugin-center-open');await p.getByRole('tab',{name:'插件设置',exact:true}).click();await p.getByRole('button',{name:'展开插件配置 快捷键',exact:true}).click();await p.locator('#shortcut-settings').waitFor();}
const selectAll=async p=>{await p.locator('.graph-editor').focus();await p.keyboard.press('Control+a');};
async function rename(p,id){await p.locator('.workflow-node').first().locator('.node-header').click();await p.keyboard.press('F2');await p.locator('#node-custom-id').fill(id);await p.click('#apply-node-id');await p.locator(`.workflow-node[data-id="${id}"]`).waitFor();}
export async function shortcutUserPath(){
  const s={out:path.join(root,'build/verification/shortcuts-user-'+Date.now()),downloads:[],errors:[],warnings:[]};lastShortcutState=s;await fs.mkdir(s.out,{recursive:true});await launch(s);let p=s.page;
  assert.equal(await p.locator('.minimap').count(),0);
  await selectAll(p);assert.equal(await p.locator('.workflow-node.selected').count(),3);
  await p.keyboard.press('Backspace');await p.waitForTimeout(100);assert.equal(await p.locator('.workflow-node').count(),0);
  await p.keyboard.press('Control+z');await p.locator('.workflow-node').first().waitFor();assert.equal(await p.locator('.workflow-node').count(),3);
  await p.locator('.workflow-node').first().locator('.node-header').click();await p.keyboard.press('F2');
  await p.locator('#node-custom-id').fill('temporary');await p.keyboard.press('Backspace');assert.equal(await p.locator('.workflow-node').count(),3);
  await p.locator('#node-custom-id').fill('userUv');await p.click('#apply-node-id');await p.locator('.workflow-node[data-id="userUv"]').waitFor();assert.equal(await p.locator('.wire:not(.pending)').count(),2);
  for(const [id,message] of [['center_start','重复'],['bad-id','节点 ID 使用']]){await p.locator('#node-custom-id').fill(id);await p.click('#apply-node-id');await p.getByRole('alert').filter({hasText:message}).waitFor();}
  await p.locator('.graph-editor').focus();await p.keyboard.press('Control+z');await p.locator('.workflow-node[data-id="uv_start"]').waitFor();await p.keyboard.press('Control+y');await p.locator('.workflow-node[data-id="userUv"]').waitFor();
  await settings(p);assert.equal(await p.locator('[data-shortcut]').count(),25);await p.getByLabel('搜索快捷键').fill('删除');
  let row=p.locator('[data-shortcut="studio.workflow-ui.delete"]');
  await row.getByRole('button',{name:'重新录制',exact:true}).click();await p.keyboard.press('Control+z');await p.getByRole('alert').filter({hasText:'快捷键冲突'}).waitFor();
  await p.keyboard.press('Control+Backspace');await row.getByRole('button',{name:'移除快捷键 Ctrl+Backspace',exact:true}).waitFor();
  await p.screenshot({path:path.join(s.out,'shortcut-settings.png')});await p.click('#close-plugin-center');
  await selectAll(p);await p.keyboard.press('Backspace');await p.waitForTimeout(100);assert.equal(await p.locator('.workflow-node').count(),3);await p.keyboard.press('Control+Backspace');await p.waitForTimeout(100);assert.equal(await p.locator('.workflow-node').count(),0);await p.keyboard.press('Control+z');await p.locator('.workflow-node').first().waitFor();
  await s.app.close();await launch(s);p=s.page;
  await settings(p);await p.getByLabel('搜索快捷键').fill('删除');row=p.locator('[data-shortcut="studio.workflow-ui.delete"]');await row.getByRole('button',{name:'移除快捷键 Ctrl+Backspace',exact:true}).waitFor();
  await row.getByRole('button',{name:'添加备选',exact:true}).click();await p.keyboard.press('Delete');await row.getByRole('button',{name:'移除快捷键 Delete',exact:true}).waitFor();
  await row.getByRole('button',{name:'清空',exact:true}).click();await row.getByText('未绑定',{exact:true}).waitFor();await p.click('#close-plugin-center');
  await selectAll(p);const count=await p.locator('.workflow-node').count();await p.keyboard.press('Delete');await p.keyboard.press('Backspace');await p.waitForTimeout(100);assert.equal(await p.locator('.workflow-node').count(),count);
  await settings(p);await p.getByLabel('搜索快捷键').fill('删除');row=p.locator('[data-shortcut="studio.workflow-ui.delete"]');await row.getByRole('button',{name:'默认',exact:true}).click();await row.getByRole('button',{name:'移除快捷键 Backspace',exact:true}).waitFor();await p.click('#close-plugin-center');
  await p.locator('.graph-editor').focus();await p.keyboard.press('F6');await p.locator('a.page-tab.active[data-stage="vertex"]').waitFor();
  await selectAll(p);const vertexCount=await p.locator('.workflow-node').count();await p.keyboard.press('Backspace');await p.waitForTimeout(100);assert.equal(await p.locator('.workflow-node').count(),0);await p.keyboard.press('Control+z');await p.locator('.workflow-node').first().waitFor();assert.equal(await p.locator('.workflow-node').count(),vertexCount);
  await p.keyboard.press('F6');await p.click('#workflow-manager');await p.click('#open-instance-example');
  await rename(p,'shaderColor');await p.locator('.graph-editor').focus();await p.keyboard.press('F6');await rename(p,'meshPosition');
  await p.locator('.graph-editor').focus();await p.keyboard.press('Home');await p.keyboard.press('=');await p.keyboard.press('0');
  await p.screenshot({path:path.join(s.out,'custom-node-id.png')});
  await p.keyboard.press('F6');
  await userActions(p,root,s.out,s.downloads).exportEffect('CustomIdEffect',true);
  const d=s.downloads[0].directory;
  const shaderFiles=['data/shaders/workflow/CustomIdEffect.vert','data/shaders/workflow/CustomIdEffect.frag'];
  const shaders=await Promise.all(shaderFiles.map(f=>fs.readFile(path.join(d,f),'utf8')));
  assert.match(shaders[0],/wf_meshPosition_/);assert.match(shaders[1],/wf_shaderColor_/);
  assert.deepEqual(s.errors,[]);assert.deepEqual(s.warnings,[]);
  await fs.writeFile(path.join(s.out,'report.json'),JSON.stringify({ok:true,route:'desktop controls only',downloads:s.downloads,dependencies:[path.join(s.out,'WorkflowRuntime.java')],checks:['Backspace bulk delete and undo in both stages','input editing protected','F2 rename, links, invalid/duplicate rejection and history','record/alternate/conflict/clear/reset and restart persistence','zoom, fit and stage shortcuts','actual exported node names'],errors:s.errors,warnings:s.warnings},null,2));
  return s;
}

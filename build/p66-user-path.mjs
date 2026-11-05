// 前置：用户通过原生选择器选定空目录并进入声明表单。后续仅操作可见控件。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {userActions} from './plugin-user-actions.mjs';
export async function configureLayout(s){
  const p=s.page;
  await p.selectOption('#plugin-kind','declarative');await p.fill('#plugin-name','嵌套布局工具');await p.fill('#plugin-id','local.layout-tools');
  await p.fill('#decl-title','嵌套布局工具');await p.selectOption('#decl-placement','settings');
  const card=id=>p.locator(`[data-control-id="${id}"]`);
  const parentOption=async(select,id)=>select.selectOption(id?await select.locator('option').filter({hasText:'（'+id+'）'}).getAttribute('value'):'');
  async function add(type,id,label,parent){
    await parentOption(p.locator('#decl-add-parent'),parent);await p.selectOption('#decl-add-type',type);await p.click('#decl-add-control');
    const fresh=p.locator('[data-control-id]').filter({has:p.locator('input[id^="decl-id-"]')});
    // 新 ID 由界面分配，在可见输入框读取，不推断或改写注册状态。
    const values=await Promise.all((await fresh.locator('input[id^="decl-id-"]').all()).map(input=>input.inputValue()));
    const generated=values.find(v=>/^field\d+$/.test(v));assert.ok(generated);
    await card(generated).locator('input[id^="decl-id-"]').fill(id);
    await card(id).locator('input[id^="decl-label-"]').fill(label);
  }
  async function move(id,parent){await parentOption(card(id).locator('select[id^="decl-parent-"]'),parent);}
  await add('disclosure','parameters','参数分组');
  await move('dx','parameters');await move('dy','parameters');
  await add('row','xy','位移参数','parameters');await move('dx','xy');await move('dy','xy');
  await card('dy').getByRole('button',{name:'上移控件 dy',exact:true}).click();
  await card('dy').getByRole('button',{name:'下移控件 dy',exact:true}).click();
  await add('textarea','notes','备注','parameters');await card('notes').locator('textarea[id^="decl-value-"]').fill('初始备注\n第二行');
  await add('button','renameAll','应用名称');
  await card('renameAll').locator('select[id^="decl-action-"]').selectOption('rename');
  await card('renameAll').locator('select[id^="decl-target-"]').selectOption('all');
  await card('renameAll').locator('select[id^="decl-name-bind-"]').selectOption('notes');
  await card('notes').locator('input[id^="decl-id-"]').fill('description');
  assert.equal(await card('renameAll').locator('select[id^="decl-name-bind-"]').inputValue(),'description');
  await card('parameters').getByRole('button',{name:'移除控件 parameters',exact:true}).click();
  await p.getByRole('alert').filter({hasText:'外部按钮引用'}).waitFor();assert.equal(await card('parameters').count(),1);
  const groupParents=await card('parameters').locator('select[id^="decl-parent-"] option').allTextContents();assert.ok(!groupParents.some(t=>t.includes('（xy）')));
  await card('parameters').locator('input[id^="decl-label-"]').fill('参数分组');
  await card('parameters').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(s.out,'layout-editor.png')});
  await p.check('#plugin-approve-permissions');await p.click('#plugin-save');await p.locator('#plugin-manifest-form').waitFor({state:'detached'});
  assert.equal(JSON.stringify(await fs.readdir(s.directory)),JSON.stringify(['studio-plugin.json']));
  const saved=JSON.parse(await fs.readFile(path.join(s.directory,'studio-plugin.json'),'utf8'));
  const group=saved.declaration.tree.children.find(n=>n.id==='parameters');assert.deepEqual(group.children[0].children.map(n=>n.id),['dx','dy']);
  assert.equal(saved.declaration.actions.find(a=>a.on==='renameAll').title.control,'description');
  await fs.writeFile(path.join(s.out,'installed-declaration.json'),JSON.stringify(saved,null,2));
}
export async function exerciseLayout(s){
  const p=s.page,tab=name=>p.getByRole('tab',{name,exact:true}).click();
  const outer=()=>p.getByRole('button',{name:'展开插件配置 嵌套布局工具',exact:true}).click();
  const group=expanded=>p.getByRole('button',{name:(expanded?'收起':'展开')+'配置 参数分组',exact:true});
  await tab('插件设置');await outer();assert.equal(await p.getByLabel('备注',{exact:true}).count(),0);
  await group(false).focus();await p.keyboard.press('Enter');await p.getByLabel('备注',{exact:true}).waitFor();
  await p.getByLabel('备注',{exact:true}).fill('用户备注\n第二行');await p.getByLabel('备注',{exact:true}).press('Tab');
  await group(true).click();await group(false).click();assert.equal(await p.getByLabel('备注',{exact:true}).inputValue(),'用户备注\n第二行');
  await p.getByRole('button',{name:'应用名称',exact:true}).click();await p.getByText('已重命名 3 个节点，可一次撤销。',{exact:true}).waitFor();
  assert.equal(await p.locator('.workflow-node .node-header > span:nth-of-type(2)').filter({hasText:'用户备注'}).count(),3);
  await p.getByRole('button',{name:'撤销',exact:true}).click();await p.getByText('操作已完成。',{exact:true}).waitFor();
  const first=p.locator('.workflow-node').first(),before=await first.boundingBox();
  await p.getByLabel('水平位移',{exact:true}).fill('48');await p.getByLabel('水平位移',{exact:true}).press('Tab');
  await p.getByRole('button',{name:'移动节点',exact:true}).click();await p.getByText('已移动 3 个节点，可一次撤销。',{exact:true}).waitFor();
  assert.ok(Math.abs((await first.boundingBox()).x-before.x-48)<1);
  await p.getByRole('button',{name:'撤销',exact:true}).click();await p.getByText('操作已完成。',{exact:true}).waitFor();
  await p.screenshot({path:path.join(s.out,'installed-layout.png')});
  await tab('插件管理');const card=()=>p.locator('[data-plugin-id="local.layout-tools"]');
  await card().getByRole('button',{name:'编辑声明',exact:true}).click();
  await p.locator('[data-control-id="description"]').waitFor();assert.equal(await p.locator('#decl-json').isVisible(),false);
  await p.selectOption('#decl-placement','dialog');await p.check('#plugin-approve-permissions');await p.click('#plugin-save');await p.locator('#plugin-manifest-form').waitFor({state:'detached'});
  await tab('插件设置');await outer();await p.getByRole('button',{name:'打开插件窗口 嵌套布局工具',exact:true}).click();await group(false).click();
  await p.getByLabel('备注',{exact:true}).fill('窗口备注');await p.getByLabel('备注',{exact:true}).press('Tab');
  await p.getByRole('button',{name:'关闭插件窗口 嵌套布局工具',exact:true}).click();await p.getByRole('button',{name:'打开插件窗口 嵌套布局工具',exact:true}).click();await group(false).click();
  assert.equal(await p.getByLabel('备注',{exact:true}).inputValue(),'窗口备注');await p.keyboard.press('Escape');
  await tab('插件管理');
  for(let i=0;i<3;i++){
    await card().getByRole('button',{name:/^停用 /}).click();await tab('插件设置');assert.equal(await p.getByRole('button',{name:'展开插件配置 嵌套布局工具',exact:true}).count(),0);
    await tab('插件管理');await card().getByRole('button',{name:/^启用 /}).click();await tab('插件设置');await outer();assert.equal(await p.getByRole('button',{name:'打开插件窗口 嵌套布局工具',exact:true}).count(),1);await tab('插件管理');
  }
  await p.click('#close-plugin-center');
}
export async function exportLayoutEffect(s,root){
  await s.page.click('#workflow-manager');await s.page.click('#open-instance-example');
  s.downloads=[];await userActions(s.page,root,s.out,s.downloads).exportEffect('P66LayoutEffect',true);
  assert.equal(s.errors.length,0);assert.equal(s.warnings.length,0);
  await fs.writeFile(path.join(s.out,'report.json'),JSON.stringify({ok:true,route:'native folder picker then visible desktop controls only',downloads:s.downloads,dependencies:[path.join(s.out,'WorkflowRuntime.java')],checks:['nested visual add/move/reorder/rename','reference-safe deletion and descendant exclusion','single JSON install','multiline input and disclosure state','batch transaction and undo','settings/dialog placement','three enable/disable cycles'],errors:s.errors,warnings:s.warnings},null,2));
}

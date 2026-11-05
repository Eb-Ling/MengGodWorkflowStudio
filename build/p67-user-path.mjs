// 沿用上一轮经原生目录选择器安装的独立测试配置，仅通过可见控件编辑、启停和下载。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createStressSchedule} from '../packages/plugin-testkit/index.mjs';

const consumer='local.layout-tools', title='嵌套布局工具';
const graph = p => p.locator('.workflow-node').evaluateAll(nodes => nodes.map(e => ({id:e.dataset.id,left:e.style.left,top:e.style.top,title:e.querySelector('.node-header > span:nth-of-type(2)')?.textContent})));
const same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
async function openTool(p){
  await p.getByRole('tab',{name:'插件设置',exact:true}).click();
  const outer=p.getByRole('button',{name:'展开插件配置 '+title,exact:true});
  if(await outer.count())await outer.click();
  await p.getByRole('button',{name:'打开插件窗口 '+title,exact:true}).click();
  await p.getByRole('button',{name:'展开配置 参数分组',exact:true}).click();
  assert.equal(await p.getByLabel('备注',{exact:true}).count(),1);
}
async function closeTool(p){await p.getByRole('button',{name:'关闭插件窗口 '+title,exact:true}).click();}
export async function startStress(s){
  const p=s.page;
  s.trace=[];s.schedule=createStressSchedule([consumer,'studio.declarations','studio.extension-ui'],{seed:20261103,cycles:4});
  s.errors=[];s.warnings=[];
  p.on('pageerror',e=>s.errors.push(e.message));p.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[Vue warn]'))s.warnings.push(m.text());});
  if(await p.getByRole('button',{name:'关闭插件窗口 '+title,exact:true}).isVisible().catch(()=>false))await closeTool(p);
  await p.getByRole('tab',{name:'开发者示例',exact:true}).click();
  const waiting=p.waitForEvent('download');await p.click('#plugin-download-devkit');
  const download=await waiting;s.kit=path.join(s.out,download.suggestedFilename());await download.saveAs(s.kit);
  await p.getByRole('tab',{name:'插件设置',exact:true}).click();
  await fs.writeFile(path.join(s.out,'desktop-schedule.json'),JSON.stringify(s.schedule,null,2));
}
export async function stressRound(s,index){
  const p=s.page, plan=s.schedule.rounds[index];
  for(const [step,restart] of plan.restarts.entries()){
    await openTool(p);const baseline=await graph(p), name=`压力检查_${index}_${step}`;
    await p.getByLabel('备注',{exact:true}).fill(name);await p.getByLabel('备注',{exact:true}).press('Tab');
    await p.getByRole('button',{name:'应用名称',exact:true}).click();
    await p.getByText(`已重命名 ${baseline.length} 个节点，可一次撤销。`,{exact:true}).waitFor();
    assert.ok((await graph(p)).every(n=>n.title===name));
    await p.getByRole('button',{name:'撤销',exact:true}).click();await p.getByText('操作已完成。',{exact:true}).waitFor();same(await graph(p),baseline);
    await p.getByLabel('水平位移',{exact:true}).fill(String(16+step));await p.getByLabel('水平位移',{exact:true}).press('Tab');
    await p.getByRole('button',{name:'移动节点',exact:true}).click();await p.getByText(`已移动 ${baseline.length} 个节点，可一次撤销。`,{exact:true}).waitFor();
    assert.ok((await graph(p)).every((n,i)=>Math.abs(parseFloat(n.left)-parseFloat(baseline[i].left)-(16+step))<0.01));
    await p.getByRole('button',{name:'撤销',exact:true}).click();await p.getByText('操作已完成。',{exact:true}).waitFor();same(await graph(p),baseline);
    await p.getByLabel('备注',{exact:true}).fill('未提交_'+name);await p.getByLabel('备注',{exact:true}).press('Tab');
    await closeTool(p);await openTool(p);assert.equal(await p.getByLabel('备注',{exact:true}).inputValue(),'未提交_'+name);
    await closeTool(p);await p.getByRole('tab',{name:'插件管理',exact:true}).click();
    const card=p.locator(`[data-plugin-id="${restart.pluginId}"]`);await card.getByRole('button',{name:/^停用 /}).click();
    if(await p.locator('#plugin-impact-dialog[open]').count()){
      assert.ok((await p.locator('#plugin-impact-dialog').innerText()).includes(title));
      // 先取消一次，确认取消不会撤销现有插件，再确认停用。
      await p.click('#plugin-impact-cancel');await card.getByRole('button',{name:/^停用 /}).waitFor();
      await card.getByRole('button',{name:/^停用 /}).click();await p.click('#plugin-impact-confirm');
    }
    await card.getByRole('button',{name:/^启用 /}).waitFor();
    await p.getByRole('tab',{name:'插件设置',exact:true}).click();assert.equal(await p.getByRole('button',{name:'展开插件配置 '+title,exact:true}).count(),0);
    await p.waitForTimeout(180);same(await graph(p),baseline);
    await p.getByRole('tab',{name:'插件管理',exact:true}).click();
    // 可见界面启用消费者，由唯一内核自动补齐必需提供者。
    await p.locator(`[data-plugin-id="${consumer}"]`).getByRole('button',{name:/^启用 /}).click();
    await p.locator(`[data-plugin-id="${consumer}"]`).getByRole('button',{name:/^停用 /}).waitFor();
    await openTool(p);assert.equal(await p.getByLabel('备注',{exact:true}).inputValue(),'初始备注\n第二行');same(await graph(p),baseline);
    await closeTool(p);
    s.trace.push({round:index,pluginId:restart.pluginId,checks:['rename/undo','move/undo','reopen retains input','dependent disable/cancel/confirm','consumer restores providers','new generation resets input','no stale graph writes']});
    await fs.writeFile(path.join(s.out,'desktop-stress.json'),JSON.stringify({ok:true,profile:s.profile,schedule:s.schedule,trace:s.trace,errors:s.errors,warnings:s.warnings},null,2));
  }
  assert.equal(s.errors.length,0);assert.equal(s.warnings.length,0);
}
export async function finishStress(s){
  await openTool(s.page);await s.page.screenshot({path:path.join(s.out,'stress-window.png')});await closeTool(s.page);
  await s.page.click('#close-plugin-center');
}

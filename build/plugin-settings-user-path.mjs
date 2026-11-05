// 独立配置下的可见桌面操作，随后只用从面板取得的配置进行只读 MCP 验证。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), {_electron}=require('playwright');
const {openStdioClient}=require('../packages/native-host/stdio-client.cjs');
const root=path.resolve(import.meta.dirname,'..');
export let lastSettingsState;
export async function pluginSettingsUserPath(){
  const s={out:path.join(root,'build/verification/plugin-settings-'+Date.now()),errors:[],warnings:[]};
  lastSettingsState=s;await fs.mkdir(s.out,{recursive:true});
  s.app=await _electron.launch({executablePath:path.join(root,'release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe'),args:['--user-data-dir='+path.join(s.out,'profile')]});
  s.page=await s.app.firstWindow();const p=s.page;p.setDefaultTimeout(10000);
  p.on('pageerror',e=>s.errors.push(e.message));p.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[Vue warn]'))s.warnings.push(m.text());});
  const toggle=(title,expanded=false)=>p.getByRole('button',{name:(expanded?'收起':'展开')+'插件配置 '+title,exact:true});
  const tab=name=>p.getByRole('tab',{name,exact:true}).click();
  await p.waitForSelector('body[data-ui-ready="true"]');await p.click('#plugin-center-open');await tab('插件设置');
  assert.equal(await p.locator('[data-settings-panel]').count(),2);
  assert.equal(await p.locator('#bridge-port').count(),0);assert.equal(await p.locator('#shortcut-settings').count(),0);
  await p.screenshot({path:path.join(s.out,'collapsed-plugins.png')});
  await toggle('快捷键').focus();await p.keyboard.press('Enter');await p.locator('#shortcut-settings').waitFor();
  assert.equal(await toggle('快捷键',true).getAttribute('aria-expanded'),'true');
  await p.getByLabel('搜索快捷键').fill('重做');
  await toggle('快捷键',true).click();assert.equal(await p.locator('#shortcut-settings').isVisible(),false);
  await toggle('快捷键').focus();await p.keyboard.press('Space');assert.equal(await p.getByLabel('搜索快捷键').inputValue(),'重做');
  const redo=p.locator('[data-shortcut="studio.workflow-ui.redo"]');
  assert.equal(await redo.locator('kbd').count(),2);
  await redo.getByRole('button',{name:'移除快捷键 Ctrl+Shift+Z',exact:true}).click();
  assert.equal(await redo.locator('kbd').count(),1);assert.equal(await redo.locator('kbd').innerText(),'Ctrl+Y');
  assert.equal(await redo.getByRole('button',{name:'移除快捷键 Ctrl+Y',exact:true}).innerText(),'移除');
  await toggle('快捷键',true).click();await toggle('快捷键').click();assert.equal(await redo.locator('kbd').count(),1);
  await redo.getByRole('button',{name:'默认',exact:true}).click();assert.equal(await redo.locator('kbd').count(),2);
  await p.screenshot({path:path.join(s.out,'shortcut-remove.png')});
  await toggle('MCP 工作流接入').click();await p.locator('#bridge-port').waitFor();assert.equal(await p.locator('#shortcut-settings').isVisible(),true);
  const port=await p.locator('#bridge-port').inputValue();
  await p.locator('#bridge-port').fill('54321');await toggle('MCP 工作流接入',true).click();await toggle('MCP 工作流接入').click();
  assert.equal(await p.locator('#bridge-port').inputValue(),'54321');await p.locator('#bridge-port').fill(port);await p.locator('#bridge-port').press('Tab');
  for(const size of [{width:1440,height:920},{width:980,height:680}]){
    await p.setViewportSize(size);
    const overflow=await p.locator('#plugin-center').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false);
    for(const b of await p.locator('[data-settings-panel] button:visible').all()){
      const box=await b.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=size.width+1,'button exceeds viewport');
    }
  }
  await p.screenshot({path:path.join(s.out,'narrow-settings.png')});
  await p.setViewportSize({width:1440,height:920});
  await tab('插件管理');
  const mcp=p.locator('[data-plugin-id="studio.mcp"]');
  await mcp.getByRole('button',{name:/^停用 /}).click();await tab('插件设置');assert.equal(await toggle('MCP 工作流接入').count(),0);
  await tab('插件管理');await mcp.getByRole('button',{name:/^启用 /}).click();await tab('插件设置');
  assert.equal(await toggle('MCP 工作流接入').count(),1);assert.equal(await p.locator('#bridge-port').count(),0);
  await toggle('MCP 工作流接入').click();await p.click('#bridge-check');await p.locator('#bridge-status').filter({hasText:'已激活'}).waitFor();
  await p.click('#bridge-copy-prompt');const prompt=await p.locator('#bridge-prompt').inputValue();
  const config=JSON.parse(prompt.match(/```json\s*([\s\S]*?)```/)[1]).mcpServers['workflow-shader'];
  await p.click('#close-plugin-center');assert.equal(await p.locator('#bridge-port').count(),0);
  // 从这里起不再使用桌面 UI 补操作，验证折叠/卸载面板不停止 MCP 插件服务。
  const client=openStdioClient({executablePath:config.command,entry:config.args[0],env:config.env});
  const calls=[];
  try{
    await client.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'Settings disclosure regression',version:'1.0.0'}});client.notify('notifications/initialized');
    const tools=await client.request('tools/list');assert.equal(tools.tools.length,35);
    for(const name of ['workflow_get_status','workflow_get_summary']){
      const result=await client.request('tools/call',{name,arguments:{}});assert.ok(!result.isError);calls.push({name,result});
      if(name==='workflow_get_status')assert.equal(JSON.parse(result.content[0].text).editorConnected,true);
    }
    assert.ok((await client.request('resources/read',{uri:'workflow://active/summary'})).contents[0]);
  }finally{client.close();}
  assert.deepEqual(s.errors,[]);assert.deepEqual(s.warnings,[]);
  await fs.writeFile(path.join(s.out,'mcp-readonly.json'),JSON.stringify(calls,null,2));
  await fs.writeFile(path.join(s.out,'report.json'),JSON.stringify({ok:true,checks:['default collapsed and lazy mount','Enter/Space toggles and input retained','remove one alternative then restore defaults','two independent panels expanded','980px/1440px layout','plugin disable/remount ownership','panel unmount and independent MCP read'],errors:s.errors,warnings:s.warnings},null,2));
  return s;
}

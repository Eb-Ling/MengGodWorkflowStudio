// Additional UI acceptance: viewport sizes, native dialog semantics and menus.
// No evaluate(), bridge commands, workflow injection or storage edits.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..');
const {reservePort}=require('../desktop/bridge-port.cjs');
const port=await reservePort(4196),base=`http://127.0.0.1:${port}`;
const out=path.join(root,'build/verification/ui-layout-'+Date.now());await fs.mkdir(out,{recursive:true});
const server=spawn(process.execPath,['ai-gateway/server.mjs'],{cwd:root,env:{...process.env,WORKFLOW_BRIDGE_PORT:String(port)},windowsHide:true,stdio:'ignore'});
let browser;
try{
  for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:920}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/?bridgePort='+port);await page.waitForSelector('body[data-ui-ready="true"]');
  for(const [width,height] of [[980,680],[1280,800],[1600,1000]]){
    await page.setViewportSize({width,height});
    for(const selector of ['.studio-frame','.studio-titlebar','.workspace','.inspector','#save-workflow','#export-runtime','.studio-statusbar']){
      const rect=await page.locator(selector).boundingBox();assert.ok(rect&&rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1,`${selector} outside ${width}x${height}`);
    }
    await page.click('#workflow-manager');
    const dialog=await page.locator('#workflow-dialog').boundingBox();assert.ok(dialog.x>=0&&dialog.y>=0&&dialog.x+dialog.width<=width&&dialog.y+dialog.height<=height);
    await page.screenshot({path:path.join(out,'workflow-'+width+'.png')});await page.keyboard.press('Escape');
    await page.screenshot({path:path.join(out,'workspace-'+width+'.png')});
  }
  await page.setViewportSize({width:1440,height:920});
  await page.locator('.workflow-node[data-id="uv_start"] header').click({button:'right'});
  await page.locator('#node-context-menu').getByRole('button',{name:'保存选中内容为工作流节点',exact:true}).click();
  await page.fill('#workflow-node-save-title','组件化表单验证');await page.click('#confirm-workflow-node-save');
  assert.equal(await page.locator('#workflow-node-save-dialog[open]').count(),0);
  assert.match(await page.locator('#node-catalog').textContent(),/组件化表单验证/);
  await page.locator('.workflow-node[data-id="uv_start"] header').click({button:'right'});
  await page.locator('#node-context-menu').getByRole('button',{name:'保存选中内容为工作流节点',exact:true}).click();
  await page.locator('#workflow-node-save-dialog').getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await page.locator('#workflow-node-save-dialog[open]').count(),0,'Form cancel must retain native dialog submission');
  await page.click('#import-workflow');assert.equal(await page.locator('#import-dialog[open]').count(),1);await page.click('#close-import-dialog');
  // Current custom GLSL is authored in the shared inspector.
  await page.getByRole('button',{name:'+ 创建自定义 GLSL 节点'}).click();
  await page.fill('#custom-editor-title','Current GLSL');
  await page.fill('#custom-editor-code','value = uv.x;');
  await page.getByRole('button',{name:'保存节点定义',exact:true}).click();
  assert.match(await page.locator('#footer-message').textContent(),/已保存自定义节点/);
  await page.fill('#node-search','Current GLSL');
  const custom=page.locator('.catalog-node[data-type="custom.glsl.current_glsl"]');await custom.waitFor();
  const source=await custom.boundingBox(),canvas=await page.locator('#canvas-shell').boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(canvas.x+250,canvas.y+300,{steps:12});await page.mouse.up();
  await page.locator('.workflow-node[data-type="custom.glsl.current_glsl"]').waitFor();
  await page.screenshot({path:path.join(out,'custom-node-current.png')});
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({sizes:[980,1280,1600],menu:true,dialogForm:true,currentCustomNode:true,errors},null,2));
  console.log('PASS: responsive workbench, workflow modal, context-menu actions and native dialog form behavior\n'+out);
}finally{await browser?.close();server.kill();}

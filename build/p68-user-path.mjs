// 真实用户路径：前置为原生选择器安装下载包的 drawing 教学目录，不注入图、登记或应用状态。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const title='教学：二维交互绘图';
export async function exerciseDrawing(s){
  const p=s.page,plot=()=>p.getByRole('button',{name:'交互绘图',exact:true});
  const pixel=()=>plot().evaluate(e=>Array.from(e.getContext('2d').getImageData(420,55,1,1).data));
  const same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
  for(const width of [1440,520]){
    await p.setViewportSize({width,height:800});await plot().waitFor();
    const box=await plot().boundingBox();assert.ok(Math.abs(box.width/box.height-2)<0.01);
    await p.mouse.click(box.x+box.width/4,box.y+box.height/4);
    const status=p.getByText(/^位置：\d+, \d+$/);await status.waitFor();
    const coordinates=(await status.innerText()).match(/\d+/g).map(Number);
    assert.ok(Math.abs(coordinates[0]-120)<=2 && Math.abs(coordinates[1]-60)<=2,'DPI 像素取整后的逻辑坐标');
    same(await pixel(),[245,158,92,255]);
    await plot().focus();await p.keyboard.press('Space');await p.getByText('位置：240, 120',{exact:true}).waitFor();
    await p.getByRole('button',{name:'清空绘图',exact:true}).click();await p.getByText('已清空绘图',{exact:true}).waitFor();same(await pixel(),[21,26,34,255]);
    await p.getByRole('button',{name:'恢复绘图',exact:true}).click();await p.getByText('已恢复绘图',{exact:true}).waitFor();same(await pixel(),[245,158,92,255]);
  }
  await p.screenshot({path:path.join(s.out,'drawing-narrow.png')});await p.setViewportSize({width:1440,height:920});
  const detached=await plot().elementHandle();await p.getByRole('button',{name:'关闭插件窗口 '+title,exact:true}).click();
  same(await detached.evaluate(e=>[e.width,e.height]),[1,1]);await detached.dispose();
  for(let i=0;i<3;i++){
    await p.getByRole('tab',{name:'插件管理',exact:true}).click();
    const id=i===1?'studio.extension-ui':'local.kit-drawing',card=p.locator(`[data-plugin-id="${id}"]`);
    await card.getByRole('button',{name:/^停用 /}).click();if(await p.locator('#plugin-impact-dialog[open]').count())await p.click('#plugin-impact-confirm');
    await p.getByRole('tab',{name:'插件设置',exact:true}).click();assert.equal(await p.getByRole('button',{name:'展开插件配置 '+title,exact:true}).count(),0);
    await p.getByRole('tab',{name:'插件管理',exact:true}).click();await p.locator('[data-plugin-id="local.kit-drawing"]').getByRole('button',{name:/^启用 /}).click();
    await p.getByRole('tab',{name:'插件设置',exact:true}).click();await p.getByRole('button',{name:'展开插件配置 '+title,exact:true}).click();await p.getByRole('button',{name:'打开插件窗口 '+title,exact:true}).click();
    await plot().focus();await p.keyboard.press('Enter');await p.getByText('位置：240, 120',{exact:true}).waitFor();same(await pixel(),[245,158,92,255]);
    await p.getByRole('button',{name:'关闭插件窗口 '+title,exact:true}).click();
  }
  await fs.writeFile(path.join(s.out,'drawing-ui.json'),JSON.stringify({ok:true,checks:['native directory installation','real sandbox SDK import','logical coordinates at 1440/520px','Enter and Space','clear/reset actual canvas pixels','unmount reduces buffer to 1x1','three lifecycle cycles including provider cascade']},null,2));
}
export async function editDrawing(s){
  const p=s.page;await p.getByRole('tab',{name:'插件管理',exact:true}).click();
  const card=p.locator('[data-plugin-id="local.layout-tools"]');
  const enable=card.getByRole('button',{name:/^启用 /});if(await enable.count())await enable.click();
  await card.getByRole('button',{name:'编辑声明',exact:true}).click();
  await p.selectOption('#decl-add-type','drawing');await p.click('#decl-add-control');
  const field=p.locator('[data-control-id="field1"]');await field.locator('input[id^="decl-id-"]').fill('diagram');
  const n=p.locator('[data-control-id="diagram"]'),json=n.locator('textarea[id^="decl-drawing-"]');
  await n.locator('input[id^="decl-label-"]').fill('用户绘图');
  const scene=JSON.parse(await json.inputValue());scene.commands[2].fill='#ff0000';
  await json.fill(JSON.stringify({...scene,width:0}));await n.getByRole('button',{name:'应用绘图内容 diagram',exact:true}).click();
  await p.getByRole('alert').filter({hasText:'画布宽高'}).waitFor();
  assert.equal(await n.locator('canvas').evaluate(e=>e.width),480);
  await json.fill(JSON.stringify(scene));await n.getByRole('button',{name:'应用绘图内容 diagram',exact:true}).click();
  await n.scrollIntoViewIfNeeded();await p.screenshot({path:path.join(s.out,'drawing-editor.png')});
  await p.check('#plugin-approve-permissions');await p.click('#plugin-save');await p.locator('#plugin-manifest-form').waitFor({state:'detached'});
  await p.getByRole('tab',{name:'插件设置',exact:true}).click();await p.getByRole('button',{name:'展开插件配置 嵌套布局工具',exact:true}).click();await p.getByRole('button',{name:'打开插件窗口 嵌套布局工具',exact:true}).click();
  const image=p.getByRole('img',{name:'用户绘图',exact:true});await image.waitFor();
  assert.equal(JSON.stringify(await image.evaluate(e=>Array.from(e.getContext('2d').getImageData(420,55,1,1).data))),JSON.stringify([255,0,0,255]));
  await p.screenshot({path:path.join(s.out,'declarative-drawing.png')});await p.getByRole('button',{name:'关闭插件窗口 嵌套布局工具',exact:true}).click();
  await fs.writeFile(path.join(s.out,'declarative-drawing.json'),JSON.stringify({ok:true,checks:['visible add/edit/apply/save','invalid scene leaves previous preview','actual installed JSON renders changed pixels']},null,2));
}

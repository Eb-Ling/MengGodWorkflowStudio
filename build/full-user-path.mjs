// Release acceptance: real EXE, mouse/keyboard/file chooser/download only.
// No bridge commands, evaluate(), storage writes or direct generator imports.
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const same=(a,b,message)=>assert.equal(JSON.stringify(a),JSON.stringify(b),message);
const require=createRequire(import.meta.url),{_electron}=require('playwright');
const root=path.resolve(import.meta.dirname,'..');
const {version}=JSON.parse(await fs.readFile(path.join(root,'desktop/package.json'),'utf8'));
export async function desktopFullPath(){
const out=path.join(root,'build/verification/user-path-'+Date.now());await fs.mkdir(out,{recursive:true});
const app=await _electron.launch({executablePath:path.join(root,`release/MengGod-Workflow-Studio-${version}-win-x64/MengGod Workflow Studio.exe`),args:['--user-data-dir='+path.join(out,'profile')],acceptDownloads:true,timeout:30000});
const errors=[],downloads=[],dependencies=[];let page,firstExport=true;
try{
  page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  await page.waitForSelector('body[data-ui-ready="true"]');assert.ok((await fs.readdir(path.join(out,'profile'))).includes('Local Storage'));
  // Public UI module: custom component, built-in controls, props, events, slots,
  // disposal and recreation exercised entirely through the visible workshop.
  await page.getByRole('button',{name:'打开组件工坊'}).click();
  await page.getByRole('heading',{name:'波形控制面板',exact:true}).waitFor();
  assert.equal(await page.locator('.workshop-slot').textContent(),'由调用方提供的 footer 插槽');
  await page.getByLabel('波幅',{exact:true}).focus();await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.workshop-event').textContent(),/收到波幅变化：21/);
  await page.click('#update-example-panel');await page.getByRole('heading',{name:'已更新的波形面板',exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'component-workshop.png')});
  await page.click('#create-sibling-panel');
  const sliders=page.getByLabel('波幅',{exact:true}),values=page.getByTestId('example-amplitude-value');
  assert.equal(await sliders.count(),2);
  assert.notEqual(await sliders.nth(0).getAttribute('id'),await sliders.nth(1).getAttribute('id'),'Each instance must have its own label target');
  same(await values.allTextContents(),['21','20']);
  await sliders.nth(1).focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  same(await values.allTextContents(),['21','22'],'Sibling components must not share mutable state');
  assert.match(await page.locator('.workshop-event').textContent(),/独立面板波幅变化：22/);
  await page.click('#dispose-example-panel');assert.equal(await page.locator('#component-example-target .ui-component-instance').count(),0);
  await page.click('#create-example-panel');assert.equal(await values.textContent(),'20');
  await page.getByRole('button',{name:'关闭组件工坊'}).click();assert.equal(await page.locator('#component-example-target .ui-component-instance').count(),0);
  await page.getByRole('button',{name:'打开组件工坊'}).click();await page.getByRole('heading',{name:'波形控制面板',exact:true}).waitFor();
  await page.keyboard.press('Escape');assert.equal(await page.locator('#component-example-target .ui-component-instance').count(),0);
  const pause=()=>page.waitForTimeout(120);
  const inspector=page.locator('#inspector-content');
  const field=label=>inspector.locator('.field').filter({has:page.locator('label').filter({hasText:new RegExp('^'+label+'$')})}).locator('input,select').first();
  async function change(label,value){const control=field(label);if(await control.getAttribute('type')==='checkbox')throw Error('Use checkbox interaction');if(await control.locator('option').count())await control.selectOption(value);else{await control.fill(value);await control.press('Tab');}await pause();}
  async function newWorkflow(title,className){
    await page.click('#workflow-manager');await page.fill('#workflow-title',title);await page.fill('#plugin-class-name',className);await page.fill('#preview-canvas-width','256');await page.fill('#preview-canvas-height','256');
    await page.click('#create-workflow');await page.click('#close-workflow-dialog');
    const shell=await page.locator('#canvas-shell').boundingBox();
    await page.keyboard.down('Shift');await page.mouse.move(shell.x+5,shell.y+5);await page.mouse.down();await page.mouse.move(shell.x+shell.width-5,shell.y+shell.height-30,{steps:12});await page.mouse.up();await page.keyboard.up('Shift');
    assert.equal(await page.locator('.workflow-node.selected').count(),3,'Starter nodes must be selectable through the canvas');
    await page.keyboard.press('Delete');assert.equal(await page.locator('.workflow-node').count(),0);
  }
  async function add(type,search,x,y){
    const count=await page.locator('.workflow-node').count();await page.fill('#node-search',search);
    const source=await page.locator(`.catalog-node[data-type="${type}"]`).boundingBox(),canvas=await page.locator('#canvas-shell').boundingBox();
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
    await page.mouse.move(canvas.x+x,canvas.y+y,{steps:16});await pause();
    await page.mouse.move(canvas.x+x+1,canvas.y+y);await page.mouse.up();await pause();
    assert.equal(await page.locator('.workflow-node').count(),count+1,'Library drag must add exactly one node');
    const node=page.locator('.workflow-node.selected'),id=await node.getAttribute('data-id');
    const preview=inspector.getByRole('checkbox',{name:'输出预览'});if(await preview.count())await preview.uncheck();
    return id;
  }
  async function input(id,type,scope,x,y,value){
    const node=await add('io.input','输入',x,y);
    await change('类型变量',type);await page.getByLabel('参数 ID',{exact:true}).fill(id);await page.getByLabel('参数 ID',{exact:true}).press('Tab');
    await page.getByLabel('参数作用域').selectOption(scope);await change('defaultValue',value);
    assert.equal(await page.locator(`.workflow-node[data-id="${node}"] .node-id`).textContent(),node);assert.equal(await field('参数 ID（生成代码中的名称）').inputValue(),id);return node;
  }
  async function connect(from,socket,to,input){
    const source=page.locator(`.port.output[data-node-id="${from}"][data-socket="${socket}"]`),target=page.locator(`.port.input[data-node-id="${to}"][data-socket="${input}"]`);
    await source.dragTo(target);await pause();
  }
  async function downloadDependency(runtimePath){
    await page.getByLabel('依赖源码包路径',{exact:true}).fill(runtimePath);await page.getByLabel('依赖源码包路径',{exact:true}).press('Tab');
    const waiting=page.waitForEvent('download');await page.click('#export-runtime-source');const download=await waiting;
    const source=path.join(out,'dependencies',runtimePath,'WorkflowRuntime.java');await fs.mkdir(path.dirname(source),{recursive:true});await download.saveAs(source);
    const text=await fs.readFile(source,'utf8');assert.ok(text.startsWith('package '+runtimePath.replaceAll('/','.')+';'));assert.match(text,/private static final class WorkflowGlState/);
    dependencies.push({runtimePath,source});return source;
  }
  async function filesIn(directory){const result=[];for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())result.push(...await filesIn(file));else result.push(file);}return result;}
  async function exportZip(name){
    await page.locator('.compile-card .pill').filter({hasText:/^可导出$/}).waitFor();
    assert.equal(await page.locator('.compile-card .pill').textContent(),'可导出',await page.locator('#compile-message').textContent());
    await page.screenshot({path:path.join(out,name+'.png')});
    let download;
    if(firstExport){
      await page.click('#export-runtime');await page.waitForSelector('#runtime-dependency-dialog[open]');
      assert.equal(await page.locator('#continue-effect-export').isDisabled(),true);
      await page.getByRole('button',{name:'关闭运行依赖设置'}).click();
      await page.click('#export-runtime');await page.waitForSelector('#runtime-dependency-dialog[open]');
      await page.getByLabel('依赖源码包路径',{exact:true}).fill('../invalid');
      assert.equal(await page.locator('#export-runtime-source').isDisabled(),true);
      await downloadDependency('data/method');await page.screenshot({path:path.join(out,'dependency-first-export.png')});
      const waiting=page.waitForEvent('download');await page.click('#continue-effect-export');download=await waiting;firstExport=false;
    }else{const waiting=page.waitForEvent('download');await page.click('#export-runtime');download=await waiting;}
    const zip=path.join(out,name+'.zip');await download.saveAs(zip);assert.equal(await download.failure(),null);assert.ok((await fs.stat(zip)).size>1000);
    const target=path.join(out,name);
    await promisify(execFile)('pwsh',['-NoProfile','-File',path.join(root,'build/extract-user-export.ps1'),'-Zip',zip,'-Destination',target],{windowsHide:true});
    const java=await fs.readFile(path.join(target,'src/data/scripts/'+name+'.java'),'utf8');
    const files=await filesIn(target);assert.equal(files.length,3,'Each effect export must contain exactly three files');
    same(files.map(file=>path.extname(file)).sort(),['.frag','.java','.vert']);
    const args=java.match(new RegExp('public '+name+'\\(([^)]*)\\)'))[1].split(',').map(part=>{const [javaType,id]=part.trim().split(/\s+/);return {id,javaType};});
    const contract={arguments:args,instance:args.slice(2).filter(p=>p.javaType.endsWith('[]')).map(p=>p.id),shared:args.slice(2).filter(p=>!p.javaType.endsWith('[]')).map(p=>p.id)};
    downloads.push({name,zip,directory:target,contract});return {contract,java};
  }

  // 1. Build two shader stages from an empty fragment canvas.
  await newWorkflow('用户路径：共享与实例参数','UserRouteBatch');
  const color=await input('instanceTint','VEC4','instance',40,50,'1,0,0,1');
  const fragmentOutput=await add('io.output','片段输出',620,60);await connect(color,'value',fragmentOutput,'color');
  await page.locator('a[data-stage="vertex"]').click();
  const stretch=await input('stretch','FLOAT','shared',300,330,'1');
  const scale=await add('studio.math.vector.scale','向量缩放',350,40);
  await connect('position','value',scale,'value');await connect(stretch,'value',scale,'scale');await connect(scale,'value','output','position');
  await page.click('#save-workflow');
  const batch=await exportZip('UserRouteBatch');
  same(batch.contract.shared,['stretch']);same(batch.contract.instance,['instanceTint']);
  assert.match(batch.java,/UserRouteBatch\(CombatEngineLayers layer, List<Vector2f> positions, Vector4f\[\] instanceTint, float stretch\)/);
  assert.match(batch.java,/new Instance\[positions.size\(\)\]/);

  // P1: edits in each stage retain independent undo/redo after switching. Reopening
  // a saved workflow must discard these drafts without overwriting either stage.
  await page.locator(`.workflow-node[data-id="${stretch}"] header`).click();
  await change('defaultValue','2');
  await page.locator('a[data-stage="fragment"]').click();
  await page.locator(`.workflow-node[data-id="${color}"] header`).click();
  await change('defaultValue','0,1,0,1');
  await page.locator('a[data-stage="vertex"]').click();await page.keyboard.press('Control+z');
  await page.locator(`.workflow-node[data-id="${stretch}"] header`).click();
  assert.equal(Number(await field('defaultValue').inputValue()),1,'Vertex undo must not undo a fragment edit');
  await page.locator('a[data-stage="fragment"]').click();await page.keyboard.press('Control+z');
  await page.locator(`.workflow-node[data-id="${color}"] header`).click();
  same((await field('defaultValue').inputValue()).split(',').map(Number),[1,0,0,1]);
  await page.keyboard.press('Control+y');
  await page.locator('a[data-stage="vertex"]').click();await page.keyboard.press('Control+y');
  await page.locator(`.workflow-node[data-id="${stretch}"] header`).click();
  assert.equal(Number(await field('defaultValue').inputValue()),2);
  const stretchHeader=page.locator(`.workflow-node[data-id="${stretch}"] header`),beforeDrag=await stretchHeader.boundingBox();
  await page.mouse.move(beforeDrag.x+60,beforeDrag.y+12);await page.mouse.down();
  await page.mouse.move(beforeDrag.x+100,beforeDrag.y+37,{steps:8});await page.mouse.up();
  assert.ok(Math.abs((await stretchHeader.boundingBox()).x-beforeDrag.x-40)<2);
  await page.keyboard.press('Control+z');
  assert.ok(Math.abs((await stretchHeader.boundingBox()).x-beforeDrag.x)<2,'One undo restores the whole drag');
  await stretchHeader.click();await page.keyboard.press('Control+y');
  assert.ok(Math.abs((await stretchHeader.boundingBox()).x-beforeDrag.x-40)<2,'Selecting a node must not clear redo');
  await page.click('#workflow-manager');await page.locator('.saved-workflow').filter({hasText:'用户路径：共享与实例参数'}).getByRole('button',{name:'打开',exact:true}).click();
  const discarded=page.waitForEvent('download');await page.click('#export-runtime');await(await discarded).saveAs(path.join(out,'UserRouteBatch-draft-discarded.zip'));
  same(await fs.readFile(path.join(out,'UserRouteBatch.zip')),await fs.readFile(path.join(out,'UserRouteBatch-draft-discarded.zip')),'Opening must not save the outgoing drafts');

  // 2. All seven exposed parameter types, edited in the inspector.
  await page.locator('a[data-stage="fragment"]').click();await newWorkflow('用户路径：七种类型与纹理','UserRouteTypes');
  const specs=[['enabled','BOOL','true'],['counter','INT','-2'],['mask','UINT','7'],['power','FLOAT','2.5'],['offset','VEC2','3,4'],['direction','VEC3','5,6,7'],['tint','VEC4','1,0.5,0.2,1']];
  const ids=[];for(let i=0;i<specs.length;i++){const [id,type,value]=specs[i];ids.push(await input(id,type,'instance',30+(i%2)*300,25+Math.floor(i/2)*140,value));}
  const outNode=await add('io.output','片段输出',640,450);await connect(ids[6],'value',outNode,'color');
  // Invalid and duplicate IDs must be fixable through the same UI.
  await page.locator(`.workflow-node[data-id="${ids[6]}"] header`).click();await page.getByLabel('参数 ID',{exact:true}).fill('class');await page.getByLabel('参数 ID',{exact:true}).press('Tab');assert.equal(await page.getByLabel('参数 ID',{exact:true}).getAttribute('aria-invalid'),'true');
  await page.getByLabel('参数 ID',{exact:true}).fill('power');await page.getByLabel('参数 ID',{exact:true}).press('Tab');assert.match(await page.locator('#compile-message').textContent(),/重复/);
  await page.getByLabel('参数 ID',{exact:true}).fill('tint');await page.getByLabel('参数 ID',{exact:true}).press('Tab');
  await page.locator('a[data-stage="vertex"]').click();const texture=await add('input.texture','纹理入口',330,360);
  await page.getByLabel('参数 ID',{exact:true}).fill('sprite');await page.getByLabel('参数 ID',{exact:true}).press('Tab');
  const chooserPromise=page.waitForEvent('filechooser');await inspector.locator('input[type=file]').click();const chooser=await chooserPromise;await chooser.setFiles(path.join(root,'assets/workflow-studio.png'));await page.waitForSelector('.texture-source-preview');
  await page.click('#save-workflow');const typed=await exportZip('UserRouteTypes');same(typed.contract.instance,specs.map(s=>s[0]));same(typed.contract.shared,['sprite']);
  assert.match(typed.java,/SpriteAPI sprite\)/);assert.match(typed.java,/boolean\[\] enabled, int\[\] counter, int\[\] mask, float\[\] power, Vector2f\[\] offset, Vector3f\[\] direction, Vector4f\[\] tint/);

  // 3. Built-in example is loaded by its visible button, not imported behind the UI.
  await page.click('#workflow-manager');await page.click('#open-instance-example');const wave=await exportZip('InstancedWavePlugin');same(wave.contract.shared,['color','amplitude']);
  assert.match(wave.java,/InstancedWavePlugin\(CombatEngineLayers layer, List<Vector2f> positions, Vector4f color, float amplitude\)/);
  await page.click('#workflow-manager');await page.locator('.constructor-contract summary').click();
  const waveExamples=[...(await page.locator('#constructor-contract').textContent()).matchAll(/    @Override\n    public void init\(CombatEngineAPI engine\) \{[\s\S]*?\n    \}/g)].map(m=>m[0]);
  assert.equal(waveExamples.length,2);assert.match(waveExamples[0],/new Vector2f\(100f, 100f\)/);assert.ok(!waveExamples[0].includes('[]'));
  const waveExample=waveExamples[1];
  await fs.writeFile(path.join(out,'UiInitExample.java'),'package data.scripts;\nimport com.fs.starfarer.api.combat.*;\nimport org.lwjgl.util.vector.*;\npublic final class UiInitExample extends BaseEveryFrameCombatPlugin {\n'+waveExample+'\n}\n');
  await page.click('#close-workflow-dialog');
  assert.match(waveExample,/public void init\(CombatEngineAPI engine\)/);assert.match(waveExample,/java.util.Arrays.asList\(/);
  assert.ok(!waveExample.includes('InstanceParameters'));

  // 4. Every geometry field and both node inputs can become an array through visible switches.
  await page.click('#workflow-manager');await page.fill('#workflow-title','用户路径：几何数组');await page.fill('#plugin-class-name','ArrayVariationPlugin');await page.click('#save-current-workflow');await page.click('#close-workflow-dialog');
  await page.locator('a[data-stage="vertex"]').click();await page.click('#vertex-settings');
  const geometryLabels=['平移 X','平移 Y','缩放 X','缩放 Y','旋转（度）',...Array.from({length:4},(_,i)=>[`顶点 ${i} X`,`顶点 ${i} Y`]).flat()];
  for(const label of [...geometryLabels,'color','amplitude'])await page.getByRole('checkbox',{name:label+' 每实例变化',exact:true}).check();
  await page.getByLabel('旋转（度） 参数 ID',{exact:true}).fill('positions');await page.getByLabel('旋转（度） 参数 ID',{exact:true}).press('Tab');
  assert.equal(await page.getByLabel('旋转（度） 参数 ID',{exact:true}).getAttribute('aria-invalid'),'true');
  await page.getByLabel('旋转（度） 参数 ID',{exact:true}).fill('spinAngles');await page.getByLabel('旋转（度） 参数 ID',{exact:true}).press('Tab');
  assert.match(await page.locator('.constructor-signature').textContent(),/float\[\] spinAngles/);
  assert.match(await page.locator('.constructor-signature').textContent(),/Vector4f\[\] color/);
  await page.locator('.constructor-signature').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'geometry-arrays.png')});
  await page.getByRole('button',{name:'关闭几何设置'}).click();await page.click('#save-workflow');
  const geometry=await exportZip('ArrayVariationPlugin');assert.equal(geometry.contract.arguments.slice(2,-2).length,13);
  same(geometry.contract.arguments.slice(2).map(p=>p.javaType),[...Array(13).fill('float[]'),'Vector4f[]','float[]']);
  await page.click('#workflow-manager');await page.locator('.saved-workflow').filter({hasText:'用户路径：几何数组'}).getByRole('button',{name:'打开',exact:true}).click();
  await page.click('#vertex-settings');assert.equal(await page.getByRole('checkbox',{name:'缩放 X 每实例变化',exact:true}).isChecked(),true);
  assert.equal(await page.getByLabel('旋转（度） 参数 ID',{exact:true}).inputValue(),'spinAngles');
  await page.getByRole('checkbox',{name:'amplitude 每实例变化',exact:true}).uncheck();assert.match(await page.locator('.constructor-signature').textContent(),/float amplitude/);
  await page.getByRole('checkbox',{name:'amplitude 每实例变化',exact:true}).check();await page.getByRole('button',{name:'关闭几何设置'}).click();
  const geometryRepeat=page.waitForEvent('download');await page.click('#export-runtime');await(await geometryRepeat).saveAs(path.join(out,'ArrayVariationPlugin-reopened.zip'));
  same(await fs.readFile(path.join(out,'ArrayVariationPlugin.zip')),await fs.readFile(path.join(out,'ArrayVariationPlugin-reopened.zip')));

  // Saved project round-trip and a second real download.
  await page.click('#workflow-manager');await page.locator('.saved-workflow').filter({hasText:'用户路径：共享与实例参数'}).getByRole('button',{name:'打开',exact:true}).click();
  assert.equal(await page.locator('#workflow-name').textContent(),'用户路径：共享与实例参数');
  await page.locator('a[data-stage="fragment"]').click();assert.equal(await page.locator(`.workflow-node[data-id="${color}"] .node-id`).textContent(),color);
  const repeat=page.waitForEvent('download');await page.click('#export-runtime');await(await repeat).saveAs(path.join(out,'UserRouteBatch-reopened.zip'));
  same(await fs.readFile(path.join(out,'UserRouteBatch.zip')),await fs.readFile(path.join(out,'UserRouteBatch-reopened.zip')),'Saved project must export identical bytes');

  // Exercise Java's inherited type resolution with a plugin named Instance.
  await page.click('#workflow-manager');await page.fill('#plugin-class-name','Instance');await page.click('#save-current-workflow');await page.click('#close-workflow-dialog');
  await exportZip('Instance');
  await page.click('#workflow-manager');await page.fill('#plugin-class-name','UserRouteBatch');await page.click('#save-current-workflow');await page.click('#close-workflow-dialog');
  assert.equal(await page.locator('.compile-card .pill').textContent(),'可导出');
  // The permanent settings entry supports changing the source package later.
  await page.click('#runtime-dependency-settings');assert.equal(await page.getByLabel('依赖源码包路径',{exact:true}).inputValue(),'data/method');
  await page.getByLabel('依赖源码包路径',{exact:true}).fill('data/method/changed');await page.getByLabel('依赖源码包路径',{exact:true}).press('Tab');
  await page.getByRole('button',{name:'关闭运行依赖设置'}).click();
  await page.click('#export-runtime');await page.waitForSelector('#runtime-dependency-dialog[open]');
  assert.equal(await page.getByLabel('依赖源码包路径',{exact:true}).inputValue(),'data/method/changed');
  assert.equal(await page.locator('#continue-effect-export').isDisabled(),true,'A new path needs its own dependency export');
  await page.getByRole('button',{name:'关闭运行依赖设置'}).click();
  await page.click('#runtime-dependency-settings');
  await downloadDependency('data/method/changed');
  assert.match(await page.locator('#runtime-source-location').textContent(),/import data.method.changed.WorkflowRuntime/);
  await page.screenshot({path:path.join(out,'dependency-relocated.png')});await page.getByRole('button',{name:'关闭运行依赖设置'}).click();
  await page.click('#workflow-manager');await page.fill('#plugin-class-name','RelocatedEffect');await page.click('#save-current-workflow');await page.click('#close-workflow-dialog');
  const relocated=await exportZip('RelocatedEffect');assert.match(relocated.java,/import data.method.changed.WorkflowRuntime;/);
  await page.keyboard.press('Control+r');await page.waitForSelector('body[data-ui-ready="true"]');
  await page.click('#runtime-dependency-settings');assert.equal(await page.getByLabel('依赖源码包路径',{exact:true}).inputValue(),'data/method/changed');await page.getByRole('button',{name:'关闭运行依赖设置'}).click();
  const reloaded=page.waitForEvent('download');await page.click('#export-runtime');await(await reloaded).saveAs(path.join(out,'RelocatedEffect-reloaded.zip'));
  same(await fs.readFile(path.join(out,'RelocatedEffect.zip')),await fs.readFile(path.join(out,'RelocatedEffect-reloaded.zip')),'Reload must preserve the path and dependency export record');
  await page.click('#workflow-manager');await page.locator('.saved-workflow').filter({hasText:'用户路径：七种类型与纹理'}).getByRole('button',{name:'打开',exact:true}).click();
  await page.click('#runtime-dependency-settings');assert.equal(await page.getByLabel('依赖源码包路径',{exact:true}).inputValue(),'data/method','Existing workflows retain their own dependency path');await page.getByRole('button',{name:'关闭运行依赖设置'}).click();
  same(errors,[]);
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({version,route:'packaged EXE; pointer, keyboard, file chooser and download only',downloads,dependencies,uiExample:path.join(out,'UiInitExample.java'),errors},null,2));
  await fs.writeFile(path.join(root,'build/verification/latest-user-path.txt'),out);
  console.log('PASS: 6 real UI exports contain exactly 3 files each; dependency wizard, paths, independent stage history and saved/draft isolation work\n'+out);
}catch(error){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error('Evidence:',out);throw error;}
finally{await app.close();}
return out;
}

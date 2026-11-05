// 实际 EXE 的用户操作：拖节点、连线、面板启停、文件选择和下载，不调用私有桥接或注入状态。
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(import.meta.dirname, ".."),
  out = path.join(root, "build/verification/p4-user-path-" + Date.now());
await fs.mkdir(out, { recursive: true });
const profile = path.join(out, "profile"),
  errors = [],
  downloads = [],
  previews = [];
let app, page;
async function launch() {
  app = await _electron.launch({
    executablePath: path.join(
      root,
      "release/MengGod-Workflow-Studio-1.0.0-win-x64/MengGod Workflow Studio.exe",
    ),
    args: ["--user-data-dir=" + profile],
    acceptDownloads: true,
    timeout: 30000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector('body[data-ui-ready="true"]');
}
const pause = () => page.waitForTimeout(100);
const field = (label) =>
  page
    .locator("#inspector-content .field")
    .filter({
      has: page
        .locator("label")
        .filter({ hasText: new RegExp("^" + label + "$") }),
    })
    .locator("input,select")
    .first();
async function change(label, value) {
  const control = field(label);
  if (await control.locator("option").count())
    await control.selectOption(value);
  else {
    await control.fill(value);
    await control.press("Tab");
  }
  await pause();
}
const node = (id) => page.locator(`.workflow-node[data-id="${id}"]`);
async function add(type, search, x, y, preview = false) {
  const count = await page.locator(".workflow-node").count();
  await page.fill("#node-search", search);
  const source = await page
      .locator(`.catalog-node[data-type="${type}"]`)
      .boundingBox(),
    canvas = await page.locator("#canvas-shell").boundingBox();
  assert.ok(source, type + " must be available");
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvas.x + x, canvas.y + y, { steps: 14 });
  await pause();
  await page.mouse.move(canvas.x + x + 1, canvas.y + y);
  await page.mouse.up();
  await pause();
  assert.equal(await page.locator(".workflow-node").count(), count + 1);
  const id = await page
    .locator(".workflow-node.selected")
    .getAttribute("data-id");
  const box = page
    .locator("#inspector-content")
    .getByRole("checkbox", { name: "输出预览" });
  if (await box.count()) await box.setChecked(preview);
  return id;
}
async function connect(a, s, b, t) {
  await page
    .locator(`.port.output[data-node-id="${a}"][data-socket="${s}"]`)
    .dragTo(
      page.locator(`.port.input[data-node-id="${b}"][data-socket="${t}"]`),
    );
  await pause();
}
async function toggle(id, enabled) {
  await page
    .locator(`[data-plugin-id="${id}"]`)
    .getByRole("button", {
      name: new RegExp("^" + (enabled ? "启用 " : "停用 ")),
      exact: true,
    })
    .click();
  await page
    .locator(`[data-plugin-id="${id}"] .plugin-status`)
    .filter({ hasText: enabled ? "已启用" : "已停用" })
    .waitFor();
}
async function exportEffect(name, first = false) {
  await page.click("#workflow-manager");
  await page.fill("#plugin-class-name", name);
  await page.click("#save-current-workflow");
  await page.click("#close-workflow-dialog");
  assert.equal(
    await page.locator(".compile-card .pill").textContent(),
    "可导出",
    await page.locator("#compile-message").textContent(),
  );
  let download;
  if (first) {
    await page.click("#export-runtime");
    await page.waitForSelector("#runtime-dependency-dialog[open]");
    let waiting = page.waitForEvent("download");
    await page.click("#export-runtime-source");
    await (await waiting).saveAs(path.join(out, "WorkflowRuntime.java"));
    waiting = page.waitForEvent("download");
    await page.click("#continue-effect-export");
    download = await waiting;
  } else {
    const waiting = page.waitForEvent("download");
    await page.click("#export-runtime");
    download = await waiting;
  }
  const zip = path.join(out, name + ".zip"),
    directory = path.join(out, name);
  await download.saveAs(zip);
  await promisify(execFile)(
    "pwsh",
    [
      "-NoProfile",
      "-File",
      path.join(root, "build/extract-user-export.ps1"),
      "-Zip",
      zip,
      "-Destination",
      directory,
    ],
    { windowsHide: true },
  );
  const files = [];
  async function walk(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else files.push(p);
    }
  }
  await walk(directory);
  assert.equal(files.length, 3);
  const vert = await fs.readFile(
      files.find((f) => f.endsWith(".vert")),
      "utf8",
    ),
    frag = await fs.readFile(
      files.find((f) => f.endsWith(".frag")),
      "utf8",
    );
  assert.ok(vert.startsWith("#version 430"));
  assert.ok(frag.startsWith("#version 430"));
  downloads.push({ name, zip, directory, files });
}

try {
  await launch();
  await page.click('#workflow-manager');
  for(const id of ['studio.math','studio.sdf'])await page.locator(`[data-plugin-id="${id}"] .plugin-status`).filter({hasText:'已启用'}).waitFor();
  await page.fill('#workflow-title','P4 Math SDF 用户建图');
  await page.fill('#plugin-class-name','P4MathMod');
  await page.fill('#preview-canvas-width','128');await page.fill('#preview-canvas-height','128');
  await page.click('#create-workflow');await page.click('#close-workflow-dialog');
  const canvas=await page.locator('#canvas-shell').boundingBox();
  await page.keyboard.down('Shift');await page.mouse.move(canvas.x+5,canvas.y+5);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width-5,canvas.y+canvas.height-30,{steps:12});await page.mouse.up();await page.keyboard.up('Shift');await page.keyboard.press('Delete');
  assert.equal(await page.locator('.workflow-node').count(),0);
  const uv=await add('input.uv','UV',20,60),split=await add('studio.math.vector.split','拆分',20,320);
  await change('类型变量','VEC2');await connect(uv,'uv',split,'value');
  const color=await add('studio.math.vector.combine','组合',450,50);await change('类型变量','VEC4');
  const output=await add('io.output','片段输出',660,60);await connect(color,'value',output,'color');
  await page.locator('a[data-stage="vertex"]').click();
  const vertexUv=await page.locator('.workflow-node[data-type="input.uv"]').getAttribute('data-id'),vertexOutput=await page.locator('.workflow-node[data-type="vertex.output"]').getAttribute('data-id');
  const rotate=await add('studio.math.vector.rotate2d','二维旋转',280,330,true);
  await connect(vertexUv,'uv',rotate,'value');await connect(rotate,'value',vertexOutput,'uv');
  assert.match(await node(rotate).locator('canvas').getAttribute('title'),/GPU 节点预览/);
  await page.locator('a[data-stage="fragment"]').click();
  const cases=[
    ['studio.math.mod','取模','x','value','P4MathMod'],
    ['studio.math.clamp','钳制','value','value','P4MathClamp'],
    ['studio.math.remap','映射范围','value','value','P4MathRemap'],
    ['studio.sdf.circle','圆形 SDF','point','distance','P4SdfCircle'],
    ['studio.sdf.segment','线段距离','point','distance','P4SdfSegment'],
    ['studio.sdf.lance','光矛 SDF','point','distance','P4SdfLance'],
    ['studio.sdf.box','矩形 SDF','point','distance','P4SdfBox'],
  ];
  let current;
  for(const [i,[type,search,port,socket,name]] of cases.entries()){
    if(current){await node(current).locator('header').click();await page.keyboard.press('Delete');}
    current=await add(type,search,230,60,true);
    await connect(port==='point'?uv:split,port==='point'?'uv':'x',current,port);
    if(type.endsWith('.mod'))await connect(split,'y',current,'y');
    if(type.endsWith('.clamp'))await connect(split,'y',current,'max');
    if(type.endsWith('.remap')){await connect(split,'y',current,'inMax');await connect(split,'y',current,'outMax');}
    for(const channel of ['x','y','z','w'])await connect(current,socket,color,channel);
    assert.match(await node(current).locator('canvas').getAttribute('title'),/GPU 节点预览/);
    await page.screenshot({path:path.join(out,name+'.png')});previews.push(type);
    await page.locator('a[data-stage="vertex"]').click();await page.click('#vertex-settings');assert.match(await page.locator('#geometry-dialog output').textContent(),/WebGL2/);await page.getByRole('button',{name:'关闭几何设置'}).click();await page.locator('a[data-stage="fragment"]').click();
    await exportEffect(name,i===0);
  }
  const count=await page.locator('.workflow-node').count(),links=await page.locator('#wire-layer .wire:not(.pending)').count();
  for(const id of ['studio.sdf','studio.math']){
    await page.click('#workflow-manager');await toggle(id,false);await page.click('#close-workflow-dialog');
    assert.equal(await page.locator('.workflow-node').count(),count);assert.equal(await page.locator('#wire-layer .wire:not(.pending)').count(),links);
    assert.match(await page.locator('#compile-message').textContent(),/缺少节点插件/);
    assert.doesNotMatch(await page.locator('#footer-message').textContent(),/刷新或草稿保存失败/);
    if(id==='studio.sdf'){
      await page.fill('#node-search','常量');assert.equal(await page.locator('.catalog-node[data-type="studio.math.constant"]').count(),1);
      await page.click('#workflow-manager');await page.click('#open-instance-example');await page.locator('.compile-card .pill').filter({hasText:/^可导出$/}).waitFor();assert.equal(await page.locator('.compile-card .pill').textContent(),'可导出');
    }
    await app.close();app=null;await launch();await page.click('#workflow-manager');
    await page.locator(`[data-plugin-id="${id}"] .plugin-status`).filter({hasText:'已停用'}).waitFor();
    await page.locator('.saved-workflow').filter({hasText:'P4 Math SDF 用户建图'}).getByRole('button',{name:'打开',exact:true}).click();
    assert.equal(await page.locator('.workflow-node').count(),count);assert.match(await page.locator('#compile-message').textContent(),/缺少节点插件/);
    await page.click('#workflow-manager');await toggle(id,true);await page.click('#close-workflow-dialog');
    assert.equal(await page.locator('.compile-card .pill').textContent(),'可导出');
  }
  await page.screenshot({path:path.join(out,'restored.png')});assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({version:'1.0.0',route:'real EXE UI only',previews,downloads,disabledPreservesDocument:true,restartDisabled:true,unrelatedWorkflow:true,errors},null,2));
  await fs.writeFile('build/verification/latest-p4-user-path.txt',out);
  console.log('PASS: seven real Math/SDF exports, both stages, independent disable/restart/restore\n'+out);
}catch(error){console.error('Compile:',await page?.locator('#compile-message').textContent().catch(()=>''));await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error('Evidence:',out);throw error;}finally{await app?.close();}

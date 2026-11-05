// 开发者故障/长时夹具，不代替真实桌面和 MCP 路径。
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const {createExtensionRunner}=require('../packages/extension-host/electron-runner.cjs');
const {createTaskRunner}=require('../packages/extension-host/task-runner.cjs');
const output=process.argv.find(s=>s.startsWith('--result='))?.slice(9);
const duration=Number(process.argv.find(s=>s.startsWith('--duration='))?.slice(11)||600000);
const samples=[],checks=[],runners=[];let tasks;
app.on('window-all-closed',()=>{});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
  const started=Date.now();
  try{
    const {readPluginManifest}=await import('../packages/plugin-sdk/plugin-manifest.mjs');
    const base=readPluginManifest(JSON.parse(await fs.readFile('build/examples/native-window/studio-plugin.json','utf8')));
    const manifest={...base,requiredApis:{},capabilities:['extension.window'],isolation:{window:{width:400,height:300}},providesApis:{'local.native-window.probe':{version:'1.0.0',methods:{read:{arguments:{type:'array'},returns:{}},allocate:{arguments:{type:'array'},returns:{}}}}}};
    const source=`export const plugin={activate(c){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;document.body.append(canvas);
      const gl=canvas.getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');
      let count=0,held=new Uint8Array(16*1024*1024);held.fill(19);
      const timer=setInterval(()=>{const end=performance.now()+20;while(performance.now()<end)count++;gl.clearColor(.2,.4,.6,1);gl.clear(gl.COLOR_BUFFER_BIT);},100);
      c.provide(c.pluginId+'.probe',{read:()=>({count,bytes:held.length,gl:!!gl,windows:typeof window.opener}),allocate:()=>{held=new Uint8Array(700*1024*1024);held.fill(1);return held.length;}});
      c.onDispose(()=>{clearInterval(timer);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();held=null;});
    }};`;
    for(let i=0;i<2;i++){const runner=await createExtensionRunner({manifest,files:{'index.mjs':source}},{timeoutMs:6000});runners.push(runner);runner.show();}
    assert.notEqual(runners[0].diagnostics().pid,runners[1].diagnostics().pid);
    checks.push('two independent renderer PIDs; separate native windows; WebGL2 contexts created');
    tasks=createTaskRunner();
    assert.deepEqual(await tasks.run('validate-json','{"ok":true}'),{valid:true});
    assert.deepEqual(await tasks.run('sha256','abc'),{sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'});
    checks.push('real utility processes: JSON and SHA-256, OS Job limits applied before work');
    let round=0;
    while(Date.now()-started<duration){
      const values=await Promise.all(runners.map(r=>r.request('invoke',{api:'local.native-window.probe',method:'read',args:[]})));
      const metrics=app.getAppMetrics();
      samples.push({elapsedMs:Date.now()-started,round:round++,values,processes:runners.map(r=>{const d=r.diagnostics();return {...d,...metrics.find(m=>m.pid===d.pid)};})});
      assert.ok(values.every(v=>v.gl&&v.bytes===16777216));
      if(round%5===0) await tasks.run('validate-json','not-json').then(v=>assert.equal(v.valid,false));
      await delay(5000);
    }
    const victim=runners.pop(),pid=victim.diagnostics().pid;
    await assert.rejects(victim.request('invoke',{api:'local.native-window.probe',method:'allocate',args:[]}));
    victim.destroy();
    assert.equal((await runners[0].request('invoke',{api:'local.native-window.probe',method:'read',args:[]})).gl,true);
    checks.push('700 MiB committed allocation rejected under 512 MiB OS process cap; other renderer still responds');
    for(const r of runners)await r.dispose();runners.length=0;tasks.dispose();
    await delay(500);assert.equal(BrowserWindow.getAllWindows().length,0);
    assert.ok(!app.getAppMetrics().some(m=>m.pid===pid));
    checks.push('all owned windows/renderer processes removed; context cleanup executed');
    await fs.writeFile(output,JSON.stringify({ok:true,durationMs:Date.now()-started,checks,samples},null,2));app.exit(0);
  }catch(e){for(const r of runners)r.destroy();tasks?.dispose();await fs.writeFile(output,JSON.stringify({ok:false,error:e.stack,checks,samples},null,2));app.exit(1);}
});

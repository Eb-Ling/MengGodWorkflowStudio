import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {reservePort} from '../desktop/bridge-port.cjs';
import {createProfileStorage} from '../desktop/profile-storage.cjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {feedbackUrl,supportMenuItems} from '../desktop/support-menu.cjs';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
import {installWindowLifecycle} from '../desktop/window-lifecycle.cjs';
import {observeWindowVisibility} from '../frontend/application/window-visibility.mjs';

test('后台通信不受窗口限速，真实可见状态经过预加载桥接，关闭后清理全部监听',()=>{
  const window=new EventEmitter(), ipcMain=new EventEmitter(), ipcRenderer=new EventEmitter();
  const contents=new EventEmitter();
  let shown=true,minimized=false,destroyed=false,throttling=true,api;
  Object.assign(window,{webContents:contents,isVisible:()=>shown,isMinimized:()=>minimized,isDestroyed:()=>destroyed});
  Object.assign(contents,{isDestroyed:()=>destroyed,setBackgroundThrottling:value=>{throttling=value;},
    send:(channel,value)=>ipcRenderer.emit(channel,{},value)});
  ipcRenderer.sendSync=channel=>{const event={trusted:true};ipcMain.emit(channel,event);return event.returnValue;};
  const dispose=installWindowLifecycle({window,ipcMain,isAllowed:event=>event.trusted===true});
  assert.equal(throttling,false);
  vm.runInNewContext(fs.readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),{
    require:name=>{assert.equal(name,'electron');return {ipcRenderer,webUtils:{},contextBridge:{exposeInMainWorld:(_name,value)=>{api=value;}}};},
  });
  const states=[],stop=api.onWindowVisibility(value=>states.push(value));
  assert.deepEqual(states,[true]);
  minimized=true;window.emit('minimize');
  assert.equal(throttling,false,'最小化不能停止后台请求');
  const afterReload=[],stopReload=api.onWindowVisibility(value=>afterReload.push(value));
  const stops=Array.from({length:32},()=>api.onWindowVisibility(()=>{}));
  assert.equal(ipcRenderer.listenerCount('workflowDesktop:windowVisibility'),1,'多个预览只保留一个原生监听');
  for(const stopExtra of stops)stopExtra();
  assert.deepEqual(afterReload,[false],'最小化期间新订阅也必须读到真实状态');
  contents.emit('did-finish-load');
  minimized=false;window.emit('restore');
  shown=false;window.emit('hide');
  shown=true;window.emit('show');
  assert.deepEqual(states,[true,false,false,true,false,true]);
  const denied={trusted:false};ipcMain.emit('workflowDesktop:windowVisibility',denied);
  assert.equal(denied.returnValue,false);
  stop();stop();stopReload();
  assert.equal(ipcRenderer.listenerCount('workflowDesktop:windowVisibility'),0);
  assert.throws(()=>api.onWindowVisibility(()=>{throw Error('consumer');}),/consumer/);
  assert.equal(ipcRenderer.listenerCount('workflowDesktop:windowVisibility'),0);
  destroyed=true;window.emit('closed');dispose();
  assert.equal(ipcMain.listenerCount('workflowDesktop:windowVisibility'),0);
  assert.equal(contents.listenerCount('did-finish-load'),0);
  for(const event of ['minimize','restore','hide','show','closed'])assert.equal(window.listenerCount(event),0);
});

test('窗口可见性在桌面依赖原生事件，在网页依赖标签页事件，取消后不再回调',()=>{
  const document=new EventTarget();document.hidden=false;
  const browserStates=[],stop=observeWindowVisibility(document,null,value=>browserStates.push(value));
  document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));
  stop();document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual(browserStates,[true,false]);
  let nativeCallback,off=0;
  const desktop={onWindowVisibility(callback){nativeCallback=callback;callback(false);return ()=>{off++;nativeCallback=null;};}};
  const desktopStates=[],stopDesktop=observeWindowVisibility(document,desktop,value=>desktopStates.push(value));
  document.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual(desktopStates,[false],'Electron 页面报告 visible 也不能覆盖真实最小化状态');
  nativeCallback(true);stopDesktop();
  assert.deepEqual(desktopStates,[false,true]);assert.equal(off,1);
});

test('反馈菜单仅打开固定仓库的填好模板页面，失败后可复制链接',async()=>{
  const opened=[],copied=[],dialogs=[];
  let unavailable=false,response=0;
  const items=supportMenuItems({
    app:{getVersion:()=> '1.0.0'},
    shell:{openExternal:async url=>{if(unavailable)throw Error('No browser');opened.push(url);}},
    dialog:{showMessageBox:async options=>{dialogs.push(options);return {response};}},
    clipboard:{writeText:text=>copied.push(text)},
  });
  for(const item of items)await item.click();
  assert.equal(opened.length,3);
  for(const value of opened){
    const url=new URL(value);
    assert.equal(url.origin,'https://github.com');
    assert.ok(url.pathname.startsWith('/Eb-Ling/MengGodWorkflowStudio/issues'));
  }
  const bug=new URL(opened[0]),feature=new URL(opened[1]);
  assert.match(bug.searchParams.get('body'),/软件版本：1\.0\.0/);
  assert.match(bug.searchParams.get('body'),/重现步骤/);
  assert.match(feature.searchParams.get('body'),/希望怎样改进/);
  assert.equal(opened[2],'https://github.com/Eb-Ling/MengGodWorkflowStudio/issues');
  const encoded=new URL(feedbackUrl('bug','1.0.0 & #test','Windows 11 中文'));
  assert.match(encoded.searchParams.get('body'),/1\.0\.0 & #test/);
  assert.match(encoded.searchParams.get('body'),/Windows 11 中文/);
  assert.deepEqual([...encoded.searchParams.keys()],['title','body']);
  unavailable=true;
  await items[0].click();
  assert.equal(copied[0],opened[0]);
  response=1;
  await items[1].click();
  assert.equal(copied.length,1,'关闭提示不得改写剪贴板');
  assert.equal(dialogs.length,2);
});

test('标准安装包包含桌面入口使用的全部本地控制器',()=>{
  const desktop = path.resolve(import.meta.dirname,'../desktop');
  const config = JSON.parse(fs.readFileSync(path.join(desktop,'package.json'),'utf8'));
  for (const name of fs.readdirSync(desktop).filter(name=>name.endsWith('.cjs'))) {
    assert.ok(config.build.files.includes(name),`标准安装包遗漏 ${name}`);
  }
});

test('occupied bridge port falls back once without disturbing the existing listener',async()=>{
  const existing=net.createServer();
  await new Promise(resolve=>existing.listen(0,'127.0.0.1',resolve));
  const occupied=existing.address().port;
  try{
    const fallback=await reservePort(occupied);
    assert.ok(fallback>0);assert.notEqual(fallback,occupied);
    assert.equal(existing.address().port,occupied);
    assert.equal(await reservePort(fallback),fallback);
  }finally{await new Promise((resolve,reject)=>existing.close(error=>error?reject(error):resolve()));}
});

test('desktop projects survive changed HTTP origins without a browser migration interface',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-storage-'));
  try {
    const file=path.join(directory,'workflow-storage.json');
    const first=createProfileStorage(file);
    const transient = "workflow.example.setting", keys = [transient];
    const absent = first.getVersion(keys);
    first.setItem(transient, "one");
    const old = first.getVersion(keys);
    const reopened = createProfileStorage(file), fromDisk = reopened.getVersion(keys);
    reopened.removeItem(transient);
    assert.notEqual(reopened.getVersion(keys), fromDisk);
    first.removeItem(transient);
    assert.equal(first.getVersion(keys), absent);
    first.setItem(transient, "two");
    assert.notEqual(first.getVersion(keys), old);
    first.setItem('workflow.library','saved project');
    assert.throws(()=>first.setItems({'workflow.documents':'new','invalid':'no'}));
    assert.equal(first.getItem('workflow.documents'),null,'失败批次不得部分写入');
    first.setItems({'workflow.documents':'[]','workflow.fileBindings':'{}'});
    const restarted=createProfileStorage(file);
    assert.equal(restarted.importMissing, undefined);
    restarted.setItem('workflow.runtimePath','data/method');
    assert.equal(restarted.getItem('workflow.library'),'saved project');
    assert.equal(restarted.getItem('workflow.runtimePath'),'data/method');
    assert.throws(()=>restarted.setItem('other','invalid key'));
    assert.equal(createProfileStorage(file).getItem('workflow.library'),'saved project');
    restarted.removeItem('workflow.runtimePath');
    assert.equal(createProfileStorage(file).getItem('workflow.runtimePath'),null);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {reservePort} from '../desktop/bridge-port.cjs';
import {createProfileStorage} from '../desktop/profile-storage.cjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createExtensionCapabilities, publicAddress } from '../packages/native-host/extension-capabilities.mjs';
import { readPluginManifest, pluginPermissionKey } from '../packages/plugin-sdk/plugin-manifest.mjs';
const example = JSON.parse(await fs.readFile(new URL('./examples/native-window/studio-plugin.json', import.meta.url)));
test('隔离范围进入授权指纹，来源/窗口越界及未授权范围拒绝', () => {
  const manifest = readPluginManifest(example);
  assert.notEqual(pluginPermissionKey(manifest),pluginPermissionKey({...manifest,isolation:{...manifest.isolation,networkOrigins:['https://www.example.com']}}));
  for (const origin of ['http://example.com','https://example.com/path','https://user@example.com','https://example.com:444'])
    assert.throws(()=>readPluginManifest({...example,isolation:{networkOrigins:[origin]}}));
  assert.throws(()=>readPluginManifest({...example,capabilities:[],isolation:{window:{width:760,height:680}}}));
  assert.throws(()=>readPluginManifest({...example,isolation:{window:{width:9000,height:600}}}));
});
test('持久文本所有者隔离、文件/总量预算、路径越界、停用撤销',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'workflow-cap-test-'));
  const a=createExtensionCapabilities({manifest:example,dataRoot:root}),b=createExtensionCapabilities({manifest:{...example,id:'other.plugin'},dataRoot:root});
  try{
    await a.call('writeText',['notes.json','{"ok":true}']);assert.equal(await b.call('readText',['notes.json']),null);
    assert.equal(await a.call('readText',['notes.json']),'{"ok":true}');
    for(const name of ['../notes.json','C:/x.txt','CON.txt','bad/path.txt']) {
      await assert.rejects(a.call('writeText',[name,'bad']));
    }
    await assert.rejects(a.call('writeText',['big.txt','x'.repeat(65537)]));
    for(let i=0;i<15;i++)await a.call('writeText',['f'+i+'.txt','x'.repeat(65536)]);
    await assert.rejects(a.call('writeText',['overflow.txt','x'.repeat(65536)]));
    await assert.rejects(a.call('fetchText',['https://unapproved.example/']));
    await assert.rejects(a.call('runTask',['cmd.exe','']));
    a.dispose();await assert.rejects(a.call('readText',['notes.json']),/撤销/);
  }finally{a.dispose();b.dispose();await fs.rm(root,{recursive:true,force:true});}
});
test('DNS 仅公开 IPv4 单播，内网、保留段与 IPv6 默认拒绝',()=>{
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.2.3','169.254.169.254','100.64.0.1','::1','192.0.2.4','198.51.100.1','203.0.113.2','224.0.0.1'])assert.equal(publicAddress(ip),false,ip);
  assert.equal(publicAddress('93.184.215.14'),true);
});
test('同一数据命名空间的多个编辑窗口写入串行，撤销不复用另一作用域',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'workflow-cap-test-'));
  const a=createExtensionCapabilities({manifest:example,dataRoot:root}),b=createExtensionCapabilities({manifest:example,dataRoot:root});
  try {
    await Promise.all([a.call('writeText',['shared.json','a']),b.call('writeText',['shared.json','b'])]);
    assert.equal(await a.call('readText',['shared.json']),'b');
    a.dispose();await assert.rejects(a.call('writeText',['shared.json','stale']));
    assert.equal(await b.call('readText',['shared.json']),'b');
  }finally{a.dispose();b.dispose();await fs.rm(root,{recursive:true,force:true});}
});
test('原生 IPC 按主窗口和插件身份隔离，停用取消迟到请求，旧窗口无法借用重启作用域',async()=>{
  let handler;const source=await fs.readFile(new URL('../desktop/plugin-controller.cjs',import.meta.url),'utf8');
  const module={exports:{}};
  vm.runInNewContext(source,{module,setTimeout,clearTimeout,Buffer,require:()=>({ipcMain:{handle:(_n,h)=>handler=h,removeHandler(){}},dialog:{},BrowserWindow:{},shell:{}})});
  const faults=new Map(),scopes=[];
  const dispose=module.exports.installPluginController({
    repository:{bundle:(owner,generation)=>({manifest:{id:'same.plugin',requiredApis:{},capabilities:[]},owner,generation}),releaseOwner(){}},
    createRunner:async(bundle,options)=>{faults.set(bundle.owner,options.onFault);return{contribution:{},show(){},dispose(){},destroy(){}};},
    createTaskRunner:()=>({run(){},dispose(){}}),
    createCapabilities:()=>{let live=true;const s={call:async()=>{await new Promise(r=>setTimeout(r,5));if(!live)throw Error('revoked');return scopes.indexOf(s);},dispose:()=>{live=false;}};scopes.push(s);return s;},
    isAllowed:()=>true,dataRoot:'unused',
  });
  const event=id=>{const frame={};return {senderFrame:frame,sender:{id,mainFrame:frame,once(){},isDestroyed:()=>false,send(){}}};};
  const a=event(1),b=event(2);
  try {
    await handler(a,'start',{generation:'a'});await handler(b,'start',{generation:'b'});
    assert.equal(await handler(a,'capability',{id:'same.plugin',method:'readText',args:[]}),0);
    assert.equal(await handler(b,'capability',{id:'same.plugin',method:'readText',args:[]}),1);
    await assert.rejects(handler(a,'capability',{id:'victim.plugin',method:'readText',args:[]}));
    const pending=handler(a,'capability',{id:'same.plugin',method:'readText',args:[]});
    const rejected=assert.rejects(pending,/revoked/);await handler(a,'stop',{generation:'a'});await rejected;
    await assert.rejects(handler(a,'openWindow',{id:'same.plugin'}));
    assert.equal(await handler(b,'capability',{id:'same.plugin',method:'readText',args:[]}),1);
    await handler(a,'start',{generation:'new'});faults.get(1)('fault');
    await assert.rejects(handler(a,'capability',{id:'same.plugin',method:'readText',args:[]}));
    await assert.rejects(handler({...a,senderFrame:{}},'start',{generation:'frame'}));
  } finally {dispose();}
});

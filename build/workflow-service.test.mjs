import {workspacePorts,installNodeModel} from './layer-test-support.mjs';
// 开发者生命周期测试，最终用户路径另由 workflow-service-mcp 通过真实发布版验收。
import test from 'node:test';
import assert from 'node:assert/strict';
import { PluginRuntime } from '../packages/plugin-runtime/index.mjs';
import {workflowServicePlugin} from '../plugins/workflow-service/index.mjs';
test('L2 提供者自动激活、读写授权分离、消费者订阅回收及旧句柄撤销',async()=>{
  const host=new PluginRuntime(),listeners=new Set();
  const port=workspacePorts();host.provide('platform.workspace-state','1.0.0',port);
  installNodeModel(host,port);
  host.register(workflowServicePlugin,{allowLocalApis:true});
  let api;
  host.register({manifest:{id:'test.reader',name:'reader',version:'1.0.0',apiVersion:'1.0.0',requiredApis:{'workflow.editor':'^1.0.0'},capabilities:['workflow.read']},activate(context){api=context.api('workflow.editor');const off=api.subscribe(()=>{});listeners.add(off);context.onDispose(()=>{off();listeners.delete(off);});}});
  for(let round=0;round<3;round++){
    await host.setEnabled('test.reader',true);
    assert.equal(listeners.size,1);assert.ok(Array.isArray(api.inspect().nodes));
    assert.throws(()=>api.edit({add:[]}),/缺少能力/);
    const old=api;await host.setEnabled('studio.workflow-service',false);
    assert.equal(listeners.size,0);assert.equal(host.list().find(p=>p.id==='test.reader').enabled,false);
    assert.throws(()=>old.inspect(),/撤销/);
  }
  await host.dispose();
});

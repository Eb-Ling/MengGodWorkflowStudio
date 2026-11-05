import {shader as s,constant} from '../packages/shader-ir/index.mjs';
import {stageModule} from '../packages/shader-ir/stages.mjs';
import {emitModule} from '../plugins/glsl-backend/emitter.mjs';
import {resolveNodePorts} from "../packages/plugin-sdk/ports.mjs";
// 数值夹具使用冻结源码与当前真实编译管线；用户导出另由 EXE 路径验收。
import fs from 'node:fs/promises';
import path from 'node:path';
import {p4Nodes,p4Graph} from './p4-test-support.mjs';
import {noiseHarness} from './noise-test-support.mjs';
const root=path.resolve('build/verification/p4-algorithms-'+Date.now());await fs.mkdir(root,{recursive:true});
const {compiler}=noiseHarness();
const names=[];
for(const def of p4Nodes){
  const name=def.typeId.replaceAll('.','_'),graph=p4Graph(def);
  const reference=await fs.readFile('build/fixtures/p4-baseline/'+name+'.reference.frag','utf8');
  await fs.writeFile(path.join(root,name+'.frag'),compiler.fragmentSource(graph));await fs.writeFile(path.join(root,name+'.reference.frag'),reference);names.push(name);
  const lowered=compiler.lower(graph,'vertex'),m=stageModule(lowered,'vertex');
  m.resources.push({storage:'in',location:0,name:'a_position',type:'VEC2'},{storage:'out',name:'v_uv',type:'VEC2'});
  m.body.unshift(s.assign(s.symbol('VEC2','v_uv'),s.symbol('VEC2','a_position')));
  m.body.push(s.assign(s.symbol('VEC4','gl_Position'),s.call('VEC4','vec4',s.symbol('VEC2','a_position'),constant('FLOAT',0),constant('FLOAT',1))));
  const result=emitModule({module:m,target:'glsl-430'});if(!result.ok)throw Error(JSON.stringify(result.diagnostics));
  await fs.writeFile(path.join(root,name+'.vert'),result.source);
}
await fs.writeFile(path.join(root,'names.json'),JSON.stringify(names));await fs.writeFile('build/verification/latest-p4-algorithms.txt',root);console.log(root);

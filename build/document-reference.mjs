// 读取清单和静态导入，不激活插件。手册中的入门说明由作者维护。
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {createMcpTools} from '../plugins/mcp/tool-service.mjs';
import {remoteMethods} from '../packages/plugin-sdk/extension-protocol.mjs';
const root=path.resolve(import.meta.dirname,'..'), marker='<!-- manifest-reference -->';
const dir=(...p)=>path.join(root,...p), data=[];
for(const folder of (await fs.readdir(dir('plugins'))).sort()){
  const entry=dir('plugins',folder,'manifest.mjs');
  if(!await fs.stat(entry).then(s=>s.isFile(),e=>{if(e.code==='ENOENT')return false;throw e;}))continue;
  const module=await import(pathToFileURL(entry));
  const m=folder==='mcp'?module.manifest:Object.values(module).find(m=>m?.id&&m.requiredApis);
  if(!m)throw Error('缺少清单 '+folder);
  data.push({folder,m});
}
const providers=new Map(data.flatMap(({m})=>Object.keys(m.providesApis||{}).map(id=>[id,m.id])));
const tick=String.fromCharCode(96), code=s=>tick+s+tick, list=a=>a.map(code).join('、')||'无';
const graph=a=>[tick.repeat(3)+'mermaid',...a,tick.repeat(3),''].join('\n');
const sourceLink=f=>'['+f+'](../plugins/'+f+')';
const guides={
 'workflow.compilation':['pipeline-types.ts','从文档生成着色模块和预览描述，查询编译身份或缓存状态。'],
 'studio.declarations':['declarative-types.ts','将无脚本插件的面板与有限编辑动作绑定到所属插件。'],
 'example.layout.grid':[null,'传入 count、columns、spacing，返回示例网格的位置数组。'],
 'studio.extension-ui':['extension-types.ts','用面板 ID、位置和 JSON 控件树创建界面。用游标和修订区分当前交互与过期事件。'],
 'shader.backend.glsl':['pipeline-types.ts','将结构化模块发射为目标 GLSL，返回资源反射、行号映射和诊断。'],
 'workflow.interaction':['types.ts','登记选择、显示顺序或布局策略，返回意图，由编辑器验证并提交。'],
 'workflow.layout':['types.ts','用节点与连线计算布局，也可通过工作区应用排列。'],
 'studio.mcp-connection':['workspace-types.ts','为受信任界面创建接入会话，暴露模型、操作和释放函数。'],
 'workflow.graph-snapshot':['pipeline-types.ts','接收文档副本，解析动态端口和插件规则，不查询当前草稿。'],
 'workflow.node-catalog':['types.ts','读取定义副本并订阅目录变化，自定义定义写入由编辑能力负责。'],
 'workflow.nodes':['types.ts','按类型 ID 查找定义，原子登记同一插件的节点与目标编译规则。'],
 'platform.extension':['extension-platform-types.ts','使用经批准的插件范围文本、网络来源和任务。'],
 'studio.plugins':['plugin-management-types.ts','查看登记状态、批准的目录和停用影响，并按当前授权管理插件。'],
 'workflow.preview':['types.ts','按节点、时间和尺寸获取图片，或在受信任界面挂载画布。'],
 'workflow.file-selection':['workspace-types.ts','从文件选择得到的 File 打开工作流，重新核对目标草稿。'],
 'workflow.project-files':['project-file-types.ts','保存库或已绑定源文件，用 fileId、备份记录和冲突版本管理读取与恢复。'],
 'studio.shortcuts':['shortcut-types.ts','登记命令的默认键位，读取用户配置并按作用域解析按键。'],
 'workflow.export':['workspace-types.ts','检查导出条件、试算参数、生成公共依赖或三文件特效。'],
 'workflow.templates':['types.ts','保存和展开可复用子图，查询内置示例。'],
 'studio.ui':['types.ts','创建组件作用域，将视图、渲染器或面板挂载到指定插槽。'],
 'workflow.editor':['types.ts','读取双阶段快照、检查器和修订，按事务提交编辑并订阅变化。'],
 'workflow.library':['types.ts','为受信任的存储能力提供工作流库读取、保存与备份。'],
 'workflow.presentation':['types.ts','取得检查器与参数的展示数据，将界面输入转为待提交的编辑意图。'],
 'workflow.workspace':['workspace-types.ts','从一个入口执行编辑、保存、模板、布局与导出，并读取就绪状态。']
};
const arch=['## 按插件阅读','',
'每张图只展开一个插件。框内文件间的实线指向静态导入的同插件实现。标记“必需”和“可选”的边指向它消费的能力，可选依赖使用虚线。标记“提供”的边列出其对外 API。清单、类型导入、动态回调和资源不画成文件导入边。没有对外 API 的插件通过登记视图、命令或节点产生效果。',''];
const api=['## 能力和方法索引','','下表按实际提供者列出方法。能力名是清单中的权限，插件还须在 requiredApis 或 optionalApis 声明 API 及版本。目录脚本只能调用下文标明的远程方法和专用节点登记入口，其他方法供相应的受信任插件使用。',''];
for(const {folder,m} of data){
 const base=dir('plugins',folder);
 const files=(await fs.readdir(base)).filter(f=>/\.(ts|vue|mjs|cjs)$/.test(f)&&f!=='manifest.mjs').sort();
 const g=['flowchart LR','  subgraph P["'+m.name+' · L'+m.layer+'"]'];
 files.forEach((f,i)=>g.push('    F'+i+'["'+f+'"]'));
 for(const [i,f] of files.entries()){
   let s=await fs.readFile(path.join(base,f),'utf8');
   if(f.endsWith('.vue'))s=[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
   const ast=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
   const seen=new Set();
   for(const st of ast.statements){
     if(!(ts.isImportDeclaration(st)||ts.isExportDeclaration(st))||st.isTypeOnly||st.importClause?.isTypeOnly)continue;
     const key=st.moduleSpecifier?.text;if(!key?.startsWith('./'))continue;
     const t=key.slice(2);const j=files.findIndex(v=>v===t||v.replace(/\.(ts|mjs|cjs)$/,'')===t);
     if(j>=0&&j!==i&&!seen.has(j)){g.push('    F'+i+' --> F'+j);seen.add(j);}
   }
 }
 g.push('  end');
 for(const [k,apis,label] of [['R',m.requiredApis,'必需'],['O',m.optionalApis,'可选']]){
  if(!Object.keys(apis||{}).length)continue;
  g.push('  '+k+'["'+Object.keys(apis).sort().map(id=>id+' · '+(providers.get(id)||'L1 平台')).join('<br/>')+'"]');
  g.push('  P '+(k==='R'?'-->':'-.->')+'|'+label+'| '+k);
 }
 const outputs=Object.keys(m.providesApis||{}).sort();
 if(outputs.length)g.push('  P -->|提供| A["'+outputs.join('<br/>')+'"]');
 arch.push('### '+m.name+' · '+m.id,'','目录：'+sourceLink(folder+'/manifest.mjs')+'。实现：'+files.map(f=>'['+f+'](../plugins/'+folder+'/'+f+')').join('、')+'。','',graph(g));
 if(folder==='mcp')arch.push('依赖框对应桌面视图的声明。服务端入口使用同一插件 ID 的独立 L2 声明，消费 L1 的 platform.http。stdio.mjs 在 AI 客户端进程中接收工具调用。','');
 if(folder==='starsector')arch.push('导出的游戏特效共用 [WorkflowRuntime.java](../plugins/starsector/runtime/WorkflowRuntime.java)，该文件不在编辑器进程中执行。','');
 for(const id of outputs){
   const d=m.providesApis[id]; const caps=new Map();
   const [typeFile,note]=guides[id];
   for(const [name,spec] of Object.entries(d.methods||{})){const c=spec.capability||'无额外方法权限';if(!caps.has(c))caps.set(c,[]);caps.get(c).push(name);}
   api.push('### '+id,'',note,'','提供者：'+sourceLink(folder+'/manifest.mjs')+'，版本 '+code(d.version)+'，契约类型 '+code(d.transport||'json')+'。'+(typeFile?' [SDK 类型](../packages/plugin-sdk/'+typeFile+')':''),'','| 能力 | 方法 |','| --- | --- |',...[...caps].map(([c,names])=>'| '+code(c)+' | '+list(names)+' |'),'');
   if(d.values?.length)api.push('公开值：'+list(d.values)+'。','');
 }
}
api.push('## 目录脚本可调用的方法','','| API | 方法与所需权限 |','| --- | --- |');
for(const [id,methods] of Object.entries(remoteMethods))api.push('| '+code(id)+' | '+Object.entries(methods).map(([k,c])=>code(k)+' → '+code(c)).join('，')+' |');
api.push('','专用的 '+code('workflow.nodes.register')+' 批量登记节点和规则，需要 '+code('nodes.register')+'。第三方 JSON API 按提供者的声明、参数契约和授权调用。','',
'## MCP 工具索引','','通过客户端的 tools/list 可获取完整 JSON Schema。下表的 ? 表示可选业务参数。标有“需要”的工具还须提供同一份摘要的 documentId、documentToken、stage、expectedRevision 四项守卫。跨阶段事务另需 expectedDocumentRevision。','',
'| 工具 | 业务参数 | 草稿守卫 |','| --- | --- | --- |');
const guards=['documentId','documentToken','stage','expectedRevision'];
const tools=createMcpTools({}).tools;
for(const t of tools){const schema=t.inputSchema,req=new Set(schema.required||[]);const need=guards.every(k=>req.has(k));api.push('| '+code(t.name)+' | '+list(Object.keys(schema.properties||{}).filter(k=>!need||!guards.includes(k)).map(k=>k+(req.has(k)?'':'?')))+' | '+(need?'需要':'不需要')+' |');}
async function sync(file,lines){
 const original=(await fs.readFile(dir('docs',file),'utf8')).replaceAll('\r\n','\n');
 if(!original.includes(marker))throw Error('缺少参考区标记 '+file);
 const next=original.split(marker)[0]+marker+'\n\n'+lines.join('\n').trim()+'\n';
 if(process.argv.includes('--check')){if(next!==original)throw Error('手册与实际清单不一致：'+file);}
 else await fs.writeFile(dir('docs',file),next);
}
await sync('ARCHITECTURE_V1.md',arch);
await sync('PLUGIN_API_V1.md',api);
console.log('已核对 '+data.length+' 张插件分图、'+providers.size+' 个插件提供的 API、'+tools.length+' 个 MCP 工具');

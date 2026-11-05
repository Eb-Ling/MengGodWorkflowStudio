import {mathContribution} from '../plugins/math/contribution.mjs';
import {sdfContribution} from '../plugins/sdf/contribution.mjs';
import {resolveNodePorts} from '../packages/plugin-sdk/ports.mjs';
export const p4Nodes=[...mathContribution().nodes,...sdfContribution().nodes];
/** 独立开发夹具，不用于真实用户路径或导出物验收。 */
export function p4Graph(definition){
  const properties={...definition.properties};
  if(properties.valueType==='AUTO')properties.valueType=definition.typeId.includes('.vector.')?'VEC2':'FLOAT';
  if(definition.typeId.endsWith('.constant'))properties.value='0.625';
  const resolved=resolveNodePorts(definition,properties),make=(id,typeId,properties={})=>({id,typeId,properties,canvasX:0,canvasY:0});
  const graph={nodes:[make('uv','input.uv'),make('split','studio.math.vector.split',{valueType:'VEC2'}),make('tested',definition.typeId,properties)],links:[{fromNode:'uv',fromSocket:'uv',toNode:'split',toSocket:'value'}],outputNodeId:'tested',revision:0};
  const link=(id,socket,to)=>graph.links.push({fromNode:id,fromSocket:socket,toNode:'tested',toSocket:to});
  for(const p of resolved.inputs){
    if(p.type==='VEC2' && ['point','uv','value','a','p0','incident'].includes(p.name))link('uv','uv',p.name);
    else if(p.type==='FLOAT' && ['value','x','a','t','degrees','radians','distance'].includes(p.name))link('split','x',p.name);
    else {
      const values={min:'.25',max:'.75',inMin:'.1',inMax:'.9',outMin:'.2',outMax:'.8',edge0:'.25',edge1:'.75',baseX:'.1',tipX:'.9',maxR:'.35',radius:'.5'};
      graph.nodes.push(make('p_'+p.name,'studio.math.constant',{valueType:p.type,value:p.type==='VEC2'?'.5,.3':p.type==='VEC3'?'.2,.5,.7':p.type==='VEC4'?'.2,.5,.7,1':values[p.name]||'.37'}));link('p_'+p.name,'value',p.name);
    }
  }
  return graph;
}

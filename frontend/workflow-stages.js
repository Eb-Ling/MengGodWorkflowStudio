// Stage configuration is the only difference between the two workflow canvases.
export const stages = {
  fragment: {title:'片段工作流', output:'io.output', sockets:['color']},
  vertex: {title:'顶点工作流', output:'vertex.output', sockets:['position','uv']}
};
export const stageNodes = [
  {typeId:'input.position',title:'局部顶点坐标',category:'输入输出',inputs:[],outputs:[{name:'value',type:'VEC2'}],properties:{},stage:'vertex'},
  {typeId:'vertex.output',title:'顶点输出',category:'输入输出',inputs:[{name:'position',type:'VEC2'},{name:'uv',type:'VEC2'}],outputs:[],properties:{},stage:'vertex'}
];
export function supportsStage(typeId, stage) {
  return typeId==='io.output'?stage==='fragment':['input.position','vertex.output'].includes(typeId)?stage==='vertex':true;
}
// Upgrade 1.1 vertex DAGs once at the document boundary. Editors and compilers then
// use the same nodes/links representation, including shared/custom node types.
export function migrateVertexGraph(graph, fragmentGraph={nodes:[]}) {
  if(Array.isArray(graph.links))return structuredClone(graph);
  const map={position:'input.position',uv:'input.uv',time:'input.time',parameter:'io.input',constant:'math.constant',vec2:'vector.combine',x:'vector.split',y:'vector.split',add:'math.add',scale:'vector.scale',multiply:'math.multiply',sum:'math.add',sin:'math.sin',rotate:'vector.rotate2d',output:'vertex.output'};
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  const nodes=graph.nodes.map(n=>{
    if(!map[n.op])throw new Error(`未知旧顶点节点：${n.op}`);
    const declaration=fragmentGraph.nodes.find(p=>p.typeId==='io.input'&&p.properties.uniform===n.parameter);
    if(n.op==='parameter'&&!declaration)throw new Error(`顶点参数未声明：${n.parameter}`);
    const vector=['position','uv','vec2','x','y','add','scale','rotate'].includes(n.op);
    const properties=n.op==='parameter'?{...declaration.properties}:{valueType:vector?'VEC2':'FLOAT'};
    if(n.op==='constant')properties.value=String(n.value??0);
    if(n.op==='rotate')properties.legacyRotation=true;
    return {id:n.id,typeId:map[n.op],title:n.title||({position:"局部顶点坐标",uv:"UV 坐标",output:"顶点输出"}[n.op])||n.op,canvasX:Number(n.x??50),canvasY:Number(n.y??50),properties:{...properties,previewEnabled:false}};
  });
  const links=graph.nodes.flatMap(n=>Object.entries(n.inputs||{}).filter(([,id])=>id).map(([port,id])=>{
    const source=byId.get(id);if(!source)throw new Error(`顶点连接缺少节点：${id}`);
    return {fromNode:id,fromSocket:source.op==='uv'?'uv':source.op==='time'?'time':['x','y'].includes(source.op)?source.op:'value',toNode:n.id,toSocket:n.op==='scale'&&port==='factor'?'scale':n.op==='sin'&&port==='value'?'x':port};
  }));
  return {nodes,links,outputNodeId:graph.output,revision:0};
}

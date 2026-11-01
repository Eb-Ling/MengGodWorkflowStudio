import {parameterId,validParameterId,validateParameterIds} from './export/parameter-contract.js';
import {constructionGuide} from './export/java-material.js';
import {installGeometrySettings} from './geometry-settings.js';
import {createWorkflowCompiler} from './compiler/workflow-compiler.js';
import {stages,stageNodes,supportsStage,migrateVertexGraph} from './workflow-stages.js';
let activeStage=new URLSearchParams(location.search).get('stage')==='vertex'?'vertex':'fragment';
const stageHistory=new Map();
import {normalizeTransform} from './compiler/vertex-graph.js';
import {buildRuntimeSources} from './export/runtime-exporter.js';
import {downloadZip} from './export/zip.js';
const runtimeFiles=await Promise.all(['WorkflowBatch.java','WorkflowGlState.java'].map(async name=>{const response=await fetch('./runtime/'+name);if(!response.ok)throw new Error('运行时模板加载失败：'+name);return {filename:'src/data/scripts/workflow/'+name,content:await response.text()};}));
const catalog = [
  ...stageNodes,
  { typeId: "io.input", title: "输入", category: "输入输出", inputs: [], outputs: [{ name: "value", type: "FLOAT" }], properties: { uniform: "u_value", defaultValue: "0.0", scope:"shared" } },
  { typeId: "input.texture", title: "纹理入口", category: "输入输出", inputs: [], outputs: [{ name: "texture", type: "SAMPLER2D" }], properties: { uniform: "u_texture", textureId: "texture", previewDataUrl: "" } },
  { typeId: "input.time", title: "时间 Time", category: "输入输出", inputs: [], outputs: [{ name: "time", type: "FLOAT" }], properties: { uniform: "u_time", defaultValue: "0.0", autoAdvance: true } },
  { typeId: "io.output", title: "片段输出", category: "输入输出", inputs: [{ name: "color", type: "VEC4" }], outputs: [], properties: {} },
  { typeId: "math.constant", title: "常量", category: "基础", inputs: [], outputs: [{ name: "value", type: "FLOAT" }], properties: { value: "0.5" } },
  { typeId: "math.add", title: "加法", category: "数学", inputs: [{ name: "a", type: "FLOAT" }, { name: "b", type: "FLOAT" }], outputs: [{ name: "value", type: "FLOAT" }], properties: {} },
  { typeId: "math.multiply", title: "乘法", category: "数学", inputs: [{ name: "a", type: "FLOAT" }, { name: "b", type: "FLOAT" }], outputs: [{ name: "value", type: "FLOAT" }], properties: {} },
  { typeId: "noise.fbm", title: "分形噪声", category: "噪声", inputs: [{ name: "uv", type: "VEC2" }, { name: "octaves", type: "FLOAT" }], outputs: [{ name: "value", type: "FLOAT" }], properties: { scale: "4.0" } },
];

// Keep the editor catalog data-driven: future backend NodeCatalogApi can replace this local source unchanged.
catalog.push(
  { typeId:"math.subtract",title:"减法",category:"数学",inputs:[{name:"a",type:"FLOAT"},{name:"b",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{} },
  { typeId:"math.divide",title:"除法",category:"数学",inputs:[{name:"a",type:"FLOAT"},{name:"b",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{} },
  { typeId:"math.clamp",title:"钳制",category:"数学",inputs:[{name:"value",type:"FLOAT"},{name:"min",type:"FLOAT"},{name:"max",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{} },
  { typeId:"math.sin",title:"正弦",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{} },
  { typeId:"math.cos",title:"余弦",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{} },
  { typeId:"vector.split",title:"拆分向量",category:"向量",inputs:[{name:"value",type:"ANY"}],outputs:[{name:"x",type:"FLOAT"},{name:"y",type:"FLOAT"},{name:"z",type:"FLOAT"},{name:"w",type:"FLOAT"}],properties:{valueType:"AUTO"} },
  { typeId:"vector.combine",title:"组合向量",category:"向量",inputs:[{name:"x",type:"FLOAT"},{name:"y",type:"FLOAT"},{name:"z",type:"FLOAT"},{name:"w",type:"FLOAT"}],outputs:[{name:"value",type:"VEC2"}],properties:{valueType:"VEC2"} },
  { typeId:"vector.scale",title:"向量缩放",category:"向量",inputs:[{name:"value",type:"ANY"},{name:"scale",type:"FLOAT"}],outputs:[{name:"value",type:"ANY"}],properties:{valueType:"AUTO"} },
  { typeId:"vector.length",title:"长度",category:"向量",inputs:[{name:"value",type:"VEC2"}],outputs:[{name:"length",type:"FLOAT"}],properties:{} },
  { typeId:"vector.normalize",title:"归一化",category:"向量",inputs:[{name:"value",type:"VEC2"}],outputs:[{name:"value",type:"VEC2"}],properties:{} },
  { typeId:"texture.sample2d",title:"纹理采样",category:"纹理",inputs:[{name:"texture",type:"SAMPLER2D"},{name:"uv",type:"VEC2"}],outputs:[{name:"rgba",type:"VEC4"}],properties:{ sampler:"u_texture" } },
  { typeId:"noise.value",title:"值噪声",category:"噪声",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{} }
);
catalog.push(
  { typeId:"input.uv",title:"UV 坐标",category:"输入输出",inputs:[],outputs:[{name:"uv",type:"VEC2"}],properties:{} },
  { typeId:"vector.center",title:"中心化 UV",category:"向量",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"VEC2"}],properties:{} },
  { typeId:"math.remap",title:"映射范围",category:"数学",inputs:[{name:"value",type:"FLOAT"},{name:"inMin",type:"FLOAT"},{name:"inMax",type:"FLOAT"},{name:"outMin",type:"FLOAT"},{name:"outMax",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{} }
);
catalog.push(
  {typeId:"math.min",title:"最小值",category:"数学",inputs:[{name:"a",type:"FLOAT"},{name:"b",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.max",title:"最大值",category:"数学",inputs:[{name:"a",type:"FLOAT"},{name:"b",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.abs",title:"绝对值",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.fract",title:"小数部分",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.floor",title:"向下取整",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.pow",title:"幂",category:"数学",inputs:[{name:"base",type:"FLOAT"},{name:"exponent",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.smoothstep",title:"平滑阶梯",category:"数学",inputs:[{name:"edge0",type:"FLOAT"},{name:"edge1",type:"FLOAT"},{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.mix",title:"线性插值",category:"数学",inputs:[{name:"a",type:"FLOAT"},{name:"b",type:"FLOAT"},{name:"t",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"vector.dot",title:"点积",category:"向量",inputs:[{name:"a",type:"VEC2"},{name:"b",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"vector.cross",title:"叉积",category:"向量",inputs:[{name:"a",type:"VEC3"},{name:"b",type:"VEC3"}],outputs:[{name:"value",type:"VEC3"}],properties:{}},
  {typeId:"vector.reflect",title:"反射",category:"向量",inputs:[{name:"incident",type:"VEC2"},{name:"normal",type:"VEC2"}],outputs:[{name:"value",type:"VEC2"}],properties:{}},
  {typeId:"noise.simplex",title:"Simplex 噪声",category:"噪声",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"noise.perlin",title:"柏林噪声",category:"噪声",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"noise.worley",title:"Worley 噪声",category:"噪声",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"noise.turbulence",title:"湍流",category:"噪声",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"noise.turbulize",title:"噪声湍流化",category:"噪声",inputs:[{name:"noise",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"noise.turbulence3",title:"3D 湍流",category:"噪声",inputs:[{name:"x",type:"FLOAT"},{name:"y",type:"FLOAT"},{name:"z",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"sdf.circle",title:"圆形 SDF",category:"SDF",inputs:[{name:"point",type:"VEC2"},{name:"radius",type:"FLOAT"}],outputs:[{name:"distance",type:"FLOAT"}],properties:{}},
  {typeId:"sdf.box",title:"矩形 SDF",category:"SDF",inputs:[{name:"point",type:"VEC2"},{name:"size",type:"VEC2"}],outputs:[{name:"distance",type:"FLOAT"}],properties:{}},
  {typeId:"sdf.segment",title:"线段距离",category:"SDF",inputs:[{name:"point",type:"VEC2"},{name:"a",type:"VEC2"},{name:"b",type:"VEC2"}],outputs:[{name:"distance",type:"FLOAT"}],properties:{}}
);
// GLSL built-ins and every reusable MengGod snippet are represented as first-class nodes.
// Polymorphic arithmetic resolves to the connected scalar/vector type in the inspector.
catalog.push(
  {typeId:"math.atan",title:"反正切 atan",category:"数学",inputs:[{name:"y",type:"FLOAT"},{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.tan",title:"正切",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.asin",title:"反正弦",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.acos",title:"反余弦",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.exp",title:"指数 exp",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.log",title:"自然对数",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.sqrt",title:"平方根",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.sign",title:"符号 sign",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.ceil",title:"向上取整",category:"数学",inputs:[{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.step",title:"阶梯 step",category:"数学",inputs:[{name:"edge",type:"FLOAT"},{name:"x",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.mod",title:"取模 mod",category:"数学",inputs:[{name:"x",type:"FLOAT"},{name:"y",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.radians",title:"角度转弧度",category:"数学",inputs:[{name:"degrees",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"math.degrees",title:"弧度转角度",category:"数学",inputs:[{name:"radians",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"vector.distance2",title:"两点距离",category:"向量",inputs:[{name:"a",type:"VEC2"},{name:"b",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"vector.rotate2d",title:"二维旋转",category:"向量",inputs:[{name:"value",type:"VEC2"},{name:"angle",type:"FLOAT"}],outputs:[{name:"value",type:"VEC2"}],properties:{}},
  {typeId:"noise.fbmSimplex",title:"Simplex 分形噪声",category:"噪声",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"noise.fbmWorley",title:"Worley 分形噪声",category:"噪声",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"sdf.lance",title:"光矛 SDF",category:"SDF",inputs:[{name:"point",type:"VEC2"},{name:"baseX",type:"FLOAT"},{name:"tipX",type:"FLOAT"},{name:"maxR",type:"FLOAT"}],outputs:[{name:"distance",type:"FLOAT"}],properties:{}},
  {typeId:"shape.lanceTaper",title:"光矛锥度",category:"形状",inputs:[{name:"t",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"shape.xFade",title:"横向淡出",category:"形状",inputs:[{name:"point",type:"VEC2"},{name:"baseX",type:"FLOAT"},{name:"tipX",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"shape.fadeVertical",title:"纵向淡出",category:"形状",inputs:[{name:"value",type:"FLOAT"},{name:"edge0",type:"FLOAT"},{name:"edge1",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"shape.fadeHorizontal",title:"横向淡出",category:"形状",inputs:[{name:"value",type:"FLOAT"},{name:"edge0",type:"FLOAT"},{name:"edge1",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"curve.cubicBezier",title:"三阶贝塞尔",category:"曲线",inputs:[{name:"p0",type:"VEC2"},{name:"p1",type:"VEC2"},{name:"p2",type:"VEC2"},{name:"p3",type:"VEC2"},{name:"t",type:"FLOAT"}],outputs:[{name:"value",type:"VEC2"}],properties:{}},
  {typeId:"curve.quarticBezier",title:"四阶贝塞尔 Y",category:"曲线",inputs:[{name:"p0",type:"VEC2"},{name:"p1",type:"VEC2"},{name:"p2",type:"VEC2"},{name:"p3",type:"VEC2"},{name:"p4",type:"VEC2"},{name:"t",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}}
);
catalog.push(
  {typeId:"logic.if",title:"If 分支",category:"逻辑",inputs:[{name:"condition",type:"BOOL"}],outputs:[],properties:{trueWidth:430,trueHeight:300,falseWidth:430,falseHeight:300}},
  {typeId:"logic.for",title:"For 循环",category:"逻辑",inputs:[{name:"count",type:"FLOAT"}],outputs:[{name:"i",type:"FLOAT"}],properties:{width:430,height:300}},
  {typeId:"logic.variable",title:"变量",category:"逻辑",inputs:[{name:"init",type:"ANY"},{name:"value",type:"ANY"}],outputs:[{name:"value",type:"ANY"}],properties:{valueType:"FLOAT",initialValue:"0.0",name:"branchValue"}},
  {typeId:"logic.equal",title:"等于 ==",category:"逻辑",inputs:[{name:"a",type:"ANY"},{name:"b",type:"ANY"}],outputs:[{name:"value",type:"BOOL"}],properties:{valueType:"AUTO"}},
  {typeId:"logic.notEqual",title:"不等于 !=",category:"逻辑",inputs:[{name:"a",type:"ANY"},{name:"b",type:"ANY"}],outputs:[{name:"value",type:"BOOL"}],properties:{valueType:"AUTO"}},
  {typeId:"logic.greater",title:"大于 >",category:"逻辑",inputs:[{name:"a",type:"FLOAT"},{name:"b",type:"FLOAT"}],outputs:[{name:"value",type:"BOOL"}],properties:{}},
  {typeId:"logic.greaterEqual",title:"大于等于 >=",category:"逻辑",inputs:[{name:"a",type:"FLOAT"},{name:"b",type:"FLOAT"}],outputs:[{name:"value",type:"BOOL"}],properties:{}},
  {typeId:"logic.less",title:"小于 <",category:"逻辑",inputs:[{name:"a",type:"FLOAT"},{name:"b",type:"FLOAT"}],outputs:[{name:"value",type:"BOOL"}],properties:{}},
  {typeId:"logic.lessEqual",title:"小于等于 <=",category:"逻辑",inputs:[{name:"a",type:"FLOAT"},{name:"b",type:"FLOAT"}],outputs:[{name:"value",type:"BOOL"}],properties:{}},
  {typeId:"logic.and",title:"逻辑与 &&",category:"逻辑",inputs:[{name:"a",type:"BOOL"},{name:"b",type:"BOOL"}],outputs:[{name:"value",type:"BOOL"}],properties:{}},
  {typeId:"logic.or",title:"逻辑或 ||",category:"逻辑",inputs:[{name:"a",type:"BOOL"},{name:"b",type:"BOOL"}],outputs:[{name:"value",type:"BOOL"}],properties:{}},
  {typeId:"logic.not",title:"逻辑非 !",category:"逻辑",inputs:[{name:"value",type:"BOOL"}],outputs:[{name:"value",type:"BOOL"}],properties:{}},
  {typeId:"custom.radialFade",title:"径向 Fade（自定义 GLSL）",category:"自定义 GLSL",inputs:[{name:"distance",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{expression:"radialFade(${distance})",helperSource:"float radialFade(float dist) {\n    return smoothstep(1.0, 0.5, dist);\n}"}},
  {typeId:"custom.innerFade",title:"内环 Fade（自定义 GLSL）",category:"自定义 GLSL",inputs:[{name:"distance",type:"FLOAT"},{name:"time",type:"FLOAT"}],outputs:[{name:"value",type:"FLOAT"}],properties:{expression:"innerFade(${distance}, ${time})",helperSource:"float innerFade(float dist, float time) {\n    float wave = 0.025 * sin(time * 3.0);\n    return smoothstep(0.25 + wave, 0.5 + wave, dist);\n}"}}
);
try {
  const overrides=JSON.parse(localStorage.getItem("workflow.customNodeOverrides") || "{}");
  Object.entries(overrides).forEach(([typeId, definition]) => {
    const index=catalog.findIndex(item=>item.typeId===typeId);
    if(index>=0) catalog[index]=definition;
  });
  catalog.push(...JSON.parse(localStorage.getItem("workflow.customNodes") || "[]"));
} catch (_) { /* stale user storage never blocks the editor */ }

// A type variable is resolved from a concrete neighboring port or selected in Inspector. Semantic ports
// (UV, sampler, fragment color) deliberately remain fixed because changing them would create invalid GLSL.
catalog.forEach(node => {
  if (["io.input", "math.constant"].includes(node.typeId)) { node.dynamicKind = "output"; node.properties.valueType = "AUTO"; }
  if (node.typeId === "vector.split") { node.dynamicKind = "splitVector"; node.properties.valueType = "AUTO"; }
  if (node.typeId === "vector.combine") { node.dynamicKind = "combineVector"; node.properties.valueType = "VEC2"; }
  if (["logic.variable"].includes(node.typeId)) { node.dynamicKind = "all"; }
  if (["math.add", "math.subtract", "math.multiply", "math.divide", "math.clamp", "math.sin", "math.cos", "math.tan", "math.asin", "math.acos", "math.exp", "math.log", "math.sqrt", "math.sign", "math.ceil", "math.floor", "math.fract", "math.abs", "math.min", "math.max", "math.pow", "math.mod", "math.step", "math.smoothstep"].includes(node.typeId)) { node.dynamicKind = "all"; node.properties.valueType = "AUTO"; }
  if (node.typeId === "math.mix") { node.dynamicKind = "mix"; node.properties.valueType = "AUTO"; }
  if (["vector.normalize"].includes(node.typeId)) { node.dynamicKind = "all"; node.properties.valueType = "AUTO"; }
  if (["vector.length"].includes(node.typeId)) { node.dynamicKind = "vectorInput"; node.properties.valueType = "AUTO"; }
  if (node.typeId === "vector.scale") { node.dynamicKind = "scaleVector"; node.properties.valueType = "AUTO"; }
});

const clone = (value) => JSON.parse(JSON.stringify(value));
function starterGraph() {
  const uv={id:"uv_start",typeId:"input.uv",title:"UV 坐标",canvasX:120,canvasY:190,properties:{previewEnabled:true}};
  const center={id:"center_start",typeId:"vector.center",title:"中心化 UV",canvasX:410,canvasY:190,properties:{previewEnabled:true}};
  const length={id:"length_start",typeId:"vector.length",title:"长度",canvasX:700,canvasY:190,properties:{previewEnabled:true,valueType:"VEC2"}};
  return {schemaVersion:1,projectId:"mvp-local",revision:0,outputNodeId:null,nodes:[uv,center,length],links:[{fromNode:uv.id,fromSocket:"uv",toNode:center.id,toSocket:"uv"},{fromNode:center.id,fromSocket:"value",toNode:length.id,toSocket:"value"}]};
}
function mingGodSignGraph() {
  const constant=(id,title,x,y,value)=>({id,typeId:"math.constant",title,canvasX:x,canvasY:y,properties:{value:String(value),previewEnabled:false,valueType:"FLOAT"}});
  const uv={id:"sign_uv",typeId:"input.uv",title:"UV 坐标",canvasX:80,canvasY:230,properties:{previewEnabled:true}};
  const time={id:"sign_time",typeId:"input.time",title:"时间 Time",canvasX:80,canvasY:450,properties:{previewEnabled:true,uniform:"u_time",defaultValue:"0.0",autoAdvance:true}};
  const duration={id:"sign_duration",typeId:"io.input",title:"Duration 参数",canvasX:80,canvasY:560,properties:{uniform:"u_duration",defaultValue:"100.0",previewEnabled:false}};
  const progress={id:"sign_progress",typeId:"io.input",title:"Progress 参数",canvasX:80,canvasY:670,properties:{uniform:"u_progress",defaultValue:"0.0",previewEnabled:false}};
  const center={id:"sign_center",typeId:"vector.center",title:"UV - 0.5",canvasX:310,canvasY:230,properties:{previewEnabled:true}};
  const two=constant("sign_two","常量 2.0",530,100,2.0);
  const toCenter={id:"sign_to_center",typeId:"vector.scale",title:"toCenter × 2",canvasX:540,canvasY:230,properties:{previewEnabled:true,valueType:"VEC2"}};
  const distance={id:"sign_distance",typeId:"vector.length",title:"径向距离 dist",canvasX:780,canvasY:230,properties:{previewEnabled:true,valueType:"VEC2"}};
  const toCenterSplit={id:"sign_to_center_split",typeId:"vector.split",title:"拆分 toCenter",canvasX:780,canvasY:430,properties:{previewEnabled:true,valueType:"VEC2"}};
  const angle={id:"sign_angle",typeId:"math.atan",title:"atan(y, x)",canvasX:1020,canvasY:430,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const exponent=constant("sign_exp","常量 0.36",1020,120,.36),noiseExponent=constant("sign_noise_exp","常量 0.5",2700,120,.5),timeFactor=constant("sign_time_factor","常量 0.1",1020,650,.1),timeFactorFast=constant("sign_time_factor_fast","常量 0.2",1510,650,.2),tau=constant("sign_tau","常量 2PI",1510,120,6.28318);
  const normalizedAngle={id:"sign_normalized_angle",typeId:"math.divide",title:"角度 / 2PI",canvasX:1260,canvasY:430,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const pow={id:"sign_pow",typeId:"math.pow",title:"pow(dist, 0.36)",canvasX:1260,canvasY:180,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const timeScale={id:"sign_time_scale",typeId:"math.multiply",title:"Time × 0.1",canvasX:1010,canvasY:500,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const subtract={id:"sign_subtract",typeId:"math.subtract",title:"径向 - 时间",canvasX:1250,canvasY:290,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const add={id:"sign_add",typeId:"math.add",title:"角度 + 径向",canvasX:1490,canvasY:290,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const scale={id:"sign_scale",typeId:"math.multiply",title:"乘以 2PI",canvasX:1730,canvasY:290,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const cosine={id:"sign_cos",typeId:"math.cos",title:"cos 旋涡",canvasX:1970,canvasY:290,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const contraction={id:"sign_contraction",typeId:"math.add",title:"距离 + Time×0.2",canvasX:1730,canvasY:510,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const timeFast={id:"sign_time_fast",typeId:"math.multiply",title:"Time × 0.2",canvasX:1490,canvasY:570,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const turbulence={id:"sign_turbulence",typeId:"noise.turbulence3",title:"3D 湍流",canvasX:2210,canvasY:290,properties:{previewEnabled:true}};
  const fog={id:"sign_fog",typeId:"math.pow",title:"pow(湍流, 0.5)",canvasX:2450,canvasY:290,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const radialFade={id:"sign_radial_fade",typeId:"custom.radialFade",title:"径向 Fade（自定义 GLSL）",canvasX:1970,canvasY:700,properties:{previewEnabled:true}};
  const innerFade={id:"sign_inner_fade",typeId:"custom.innerFade",title:"内环 Fade（自定义 GLSL）",canvasX:2210,canvasY:700,properties:{previewEnabled:true}};
  const colorConstant={id:"sign_color_constant",typeId:"math.constant",title:"颜色 (1.0, 0.65, 0.75)",canvasX:2450,canvasY:820,properties:{value:"1.0, 0.65, 0.75",valueType:"VEC3",previewEnabled:false}};
  const colorFog={id:"sign_color_fog",typeId:"vector.scale",title:"颜色 × fog",canvasX:2700,canvasY:650,properties:{previewEnabled:true,valueType:"VEC3"}};
  const colorRadial={id:"sign_color_radial",typeId:"vector.scale",title:"颜色 × radialFade",canvasX:2940,canvasY:650,properties:{previewEnabled:true,valueType:"VEC3"}};
  const colorInner={id:"sign_color_inner",typeId:"vector.scale",title:"颜色 × innerFade",canvasX:3180,canvasY:650,properties:{previewEnabled:true,valueType:"VEC3"}};
  const one=constant("sign_one","常量 1.0",2450,100,1.0),alphaScale=constant("sign_alpha_scale","常量 0.8",2700,100,.8);
  const alphaHole={id:"sign_alpha_hole",typeId:"math.subtract",title:"1.0 - innerFade",canvasX:2700,canvasY:250,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const alphaFog={id:"sign_alpha_fog",typeId:"math.multiply",title:"fog × radialFade",canvasX:2940,canvasY:250,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const alphaScaled={id:"sign_alpha_scaled",typeId:"math.multiply",title:"× 0.8",canvasX:3180,canvasY:250,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const alpha={id:"sign_alpha",typeId:"math.max",title:"max(alpha)",canvasX:3420,canvasY:250,properties:{previewEnabled:true,valueType:"FLOAT"}};
  const colorSplit={id:"sign_color_split",typeId:"vector.split",title:"拆分颜色",canvasX:3420,canvasY:650,properties:{previewEnabled:false,valueType:"VEC3"}};
  const combine={id:"sign_combine",typeId:"vector.combine",title:"组合 RGBA",canvasX:3660,canvasY:440,properties:{previewEnabled:true,valueType:"VEC4"}};
  const output={id:"sign_output",typeId:"io.output",title:"片段输出",canvasX:3900,canvasY:440,properties:{previewEnabled:false}};
  return {schemaVersion:1,projectId:"ming-god-sign-example",revision:0,outputNodeId:output.id,nodes:[uv,time,duration,progress,center,two,toCenter,distance,toCenterSplit,angle,normalizedAngle,exponent,noiseExponent,timeFactor,timeFactorFast,tau,pow,timeScale,subtract,add,scale,cosine,timeFast,contraction,turbulence,fog,radialFade,innerFade,colorConstant,colorFog,colorRadial,colorInner,one,alphaScale,alphaHole,alphaFog,alphaScaled,alpha,colorSplit,combine,output],links:[
    {fromNode:uv.id,fromSocket:"uv",toNode:center.id,toSocket:"uv"},
    {fromNode:center.id,fromSocket:"value",toNode:toCenter.id,toSocket:"value"},
    {fromNode:two.id,fromSocket:"value",toNode:toCenter.id,toSocket:"scale"},
    {fromNode:toCenter.id,fromSocket:"value",toNode:distance.id,toSocket:"value"},
    {fromNode:toCenter.id,fromSocket:"value",toNode:toCenterSplit.id,toSocket:"value"},
    {fromNode:toCenterSplit.id,fromSocket:"y",toNode:angle.id,toSocket:"y"},
    {fromNode:toCenterSplit.id,fromSocket:"x",toNode:angle.id,toSocket:"x"},
    {fromNode:angle.id,fromSocket:"value",toNode:normalizedAngle.id,toSocket:"a"},
    {fromNode:tau.id,fromSocket:"value",toNode:normalizedAngle.id,toSocket:"b"},
    {fromNode:distance.id,fromSocket:"length",toNode:pow.id,toSocket:"base"},
    {fromNode:exponent.id,fromSocket:"value",toNode:pow.id,toSocket:"exponent"},
    {fromNode:time.id,fromSocket:"time",toNode:timeScale.id,toSocket:"a"},
    {fromNode:timeFactor.id,fromSocket:"value",toNode:timeScale.id,toSocket:"b"},
    {fromNode:pow.id,fromSocket:"value",toNode:subtract.id,toSocket:"a"},
    {fromNode:timeScale.id,fromSocket:"value",toNode:subtract.id,toSocket:"b"},
    {fromNode:normalizedAngle.id,fromSocket:"value",toNode:add.id,toSocket:"a"},
    {fromNode:subtract.id,fromSocket:"value",toNode:add.id,toSocket:"b"},
    {fromNode:add.id,fromSocket:"value",toNode:scale.id,toSocket:"a"},
    {fromNode:tau.id,fromSocket:"value",toNode:scale.id,toSocket:"b"},
    {fromNode:scale.id,fromSocket:"value",toNode:cosine.id,toSocket:"x"},
    {fromNode:time.id,fromSocket:"time",toNode:timeFast.id,toSocket:"a"},
    {fromNode:timeFactorFast.id,fromSocket:"value",toNode:timeFast.id,toSocket:"b"},
    {fromNode:distance.id,fromSocket:"length",toNode:contraction.id,toSocket:"a"},
    {fromNode:timeFast.id,fromSocket:"value",toNode:contraction.id,toSocket:"b"},
    {fromNode:cosine.id,fromSocket:"value",toNode:turbulence.id,toSocket:"x"},
    {fromNode:contraction.id,fromSocket:"value",toNode:turbulence.id,toSocket:"y"},
    {fromNode:timeScale.id,fromSocket:"value",toNode:turbulence.id,toSocket:"z"},
    {fromNode:turbulence.id,fromSocket:"value",toNode:fog.id,toSocket:"base"},
    {fromNode:noiseExponent.id,fromSocket:"value",toNode:fog.id,toSocket:"exponent"},
    {fromNode:distance.id,fromSocket:"length",toNode:radialFade.id,toSocket:"distance"},
    {fromNode:distance.id,fromSocket:"length",toNode:innerFade.id,toSocket:"distance"},
    {fromNode:time.id,fromSocket:"time",toNode:innerFade.id,toSocket:"time"},
    {fromNode:colorConstant.id,fromSocket:"value",toNode:colorFog.id,toSocket:"value"},
    {fromNode:fog.id,fromSocket:"value",toNode:colorFog.id,toSocket:"scale"},
    {fromNode:colorFog.id,fromSocket:"value",toNode:colorRadial.id,toSocket:"value"},
    {fromNode:radialFade.id,fromSocket:"value",toNode:colorRadial.id,toSocket:"scale"},
    {fromNode:colorRadial.id,fromSocket:"value",toNode:colorInner.id,toSocket:"value"},
    {fromNode:innerFade.id,fromSocket:"value",toNode:colorInner.id,toSocket:"scale"},
    {fromNode:one.id,fromSocket:"value",toNode:alphaHole.id,toSocket:"a"},
    {fromNode:innerFade.id,fromSocket:"value",toNode:alphaHole.id,toSocket:"b"},
    {fromNode:fog.id,fromSocket:"value",toNode:alphaFog.id,toSocket:"a"},
    {fromNode:radialFade.id,fromSocket:"value",toNode:alphaFog.id,toSocket:"b"},
    {fromNode:alphaFog.id,fromSocket:"value",toNode:alphaScaled.id,toSocket:"a"},
    {fromNode:alphaScale.id,fromSocket:"value",toNode:alphaScaled.id,toSocket:"b"},
    {fromNode:alphaHole.id,fromSocket:"value",toNode:alpha.id,toSocket:"a"},
    {fromNode:alphaScaled.id,fromSocket:"value",toNode:alpha.id,toSocket:"b"},
    {fromNode:colorInner.id,fromSocket:"value",toNode:colorSplit.id,toSocket:"value"},
    {fromNode:colorSplit.id,fromSocket:"x",toNode:combine.id,toSocket:"x"},
    {fromNode:colorSplit.id,fromSocket:"y",toNode:combine.id,toSocket:"y"},
    {fromNode:colorSplit.id,fromSocket:"z",toNode:combine.id,toSocket:"z"},
    {fromNode:alpha.id,fromSocket:"value",toNode:combine.id,toSocket:"w"},
    {fromNode:combine.id,fromSocket:"value",toNode:output.id,toSocket:"color"}
  ]};
}
class GraphStore {
  constructor() { this.listeners = new Set(); this.previewRevision = 0; this.undoStack = []; this.redoStack = []; this.reset(loadCurrentGraph()); }
  reset(graph = stageStarterGraph()) { this.undoStack=[]; this.redoStack=[]; migrateBranchMetadata(graph); graph.revision=Number.isFinite(graph.revision)?graph.revision:0; graph.previewRevision = ++this.previewRevision; this.graph = graph; this.emit(); }
  subscribe(listener) { this.listeners.add(listener); listener(this.snapshot()); return () => this.listeners.delete(listener); }
  snapshot() { return clone(this.graph); }
  emit() { this.listeners.forEach(listener => listener(this.snapshot())); }
  checkpoint() { this.undoStack.push(this.snapshot()); if(this.undoStack.length>100)this.undoStack.shift(); this.redoStack=[]; }
  restore(graph) { migrateBranchMetadata(graph); graph.previewRevision=++this.previewRevision; this.graph=graph; this.emit(); }
  undo() { if(!this.undoStack.length)return false; this.redoStack.push(this.snapshot()); this.restore(this.undoStack.pop()); return true; }
  redo() { if(!this.redoStack.length)return false; this.undoStack.push(this.snapshot()); this.restore(this.redoStack.pop()); return true; }
  command(type, payload) {
    const g = this.graph;
    this.checkpoint();
    if (type === "ADD_NODE") g.nodes.push(payload.node);
    if (type === "RENAME_NODE") { const n=this.node(payload.nodeId);if(n)n.title=String(payload.title||"").trim()||nodeDef(n).title; }
    if (type === "MOVE_NODE") { const n = this.node(payload.nodeId); if (n) Object.assign(n, { canvasX: payload.x, canvasY: payload.y }); g.revision++; this.emit(); return; }
    if (type === "SET_PROPERTY") { const n = this.node(payload.nodeId); if (n) n.properties[payload.key] = payload.value; }
    if (type === "SET_OUTPUT") { const n=this.node(payload.nodeId);if(n)g.outputNodeId=n.id; }
    if (type === "REMOVE_NODE") { g.nodes = g.nodes.filter(n => n.id !== payload.nodeId); g.links = g.links.filter(l => l.fromNode !== payload.nodeId && l.toNode !== payload.nodeId); if (g.outputNodeId === payload.nodeId) g.outputNodeId = null; }
    if (type === "CONNECT") {
      if (isInvalidBranchConnection(g,payload.link)) { document.querySelector("#footer-message").textContent="If 分支内部的输出只能连接同一分支节点，或连接到变量节点后带出。"; return; }
      g.links = g.links.filter(l => !(l.toNode === payload.link.toNode && l.toSocket === payload.link.toSocket)); g.links.push(payload.link);
    }
    if (type === "DISCONNECT") g.links = g.links.filter(l => !(l.fromNode === payload.link.fromNode && l.fromSocket === payload.link.fromSocket && l.toNode === payload.link.toNode && l.toSocket === payload.link.toSocket));
    if (payload.node?.typeId === stages[activeStage].output) g.outputNodeId = payload.node.id;
    resolveTypes(g); pruneInvalidLinks(g);
    if (type !== "MOVE_NODE") g.previewRevision = ++this.previewRevision;
    g.revision++; this.emit();
  }
  node(id) { return this.graph.nodes.find(n => n.id === id); }
  moveNodes(nodes, record=true) {
    const positions = new Map(nodes.map(node => [node.id, node]));
    if (!positions.size) return;
    if(record)this.checkpoint();
    this.graph.nodes.forEach(node => {
      const position = positions.get(node.id);
      if (position) Object.assign(node, { canvasX: position.x, canvasY: position.y });
    });
    this.graph.revision++;
    this.emit();
  }
  removeNodes(nodeIds) {
    const ids=new Set(nodeIds); if(!ids.size)return;
    this.checkpoint();
    this.graph.nodes=this.graph.nodes.filter(node=>!ids.has(node.id));
    this.graph.links=this.graph.links.filter(link=>!ids.has(link.fromNode)&&!ids.has(link.toNode));
    if(ids.has(this.graph.outputNodeId))this.graph.outputNodeId=null;
    resolveTypes(this.graph);pruneInvalidLinks(this.graph);
    this.graph.previewRevision=++this.previewRevision;this.graph.revision++;this.emit();
  }
}

const store = new GraphStore();
let lastGeneratedSources = null;
const ui = { selected: null, selectedNodes: new Set(), pendingWire: null, disconnectWire: null, drag: null, selectionBox: null, contextNodeId: null, contextPastePosition: null, clipboard: null, backgroundPointer: null, catalogCollapsed: new Set(JSON.parse(localStorage.getItem("workflow.catalogCollapsed") || "[]")), view: { x: 0, y: 0, zoom: 1, pan: null } };
const previewClock = { enabled: sessionStorage.getItem("workflow.previewTimeEnabled") === "true", startedAt: performance.now(), lastFrameAt: 0, animationFrame: 0 };
const workflowBridge = (() => {
  const requestedPort=Number(new URLSearchParams(location.search).get("bridgePort"));
  let port = requestedPort || Number(localStorage.getItem("workflow.bridgePort") || 4174);
  if(requestedPort)localStorage.setItem("workflow.bridgePort",String(port));
  let editorId=sessionStorage.getItem("workflow.editorId");
  if(!editorId){editorId=globalThis.crypto?.randomUUID?.()||`editor_${Date.now()}_${Math.random().toString(36).slice(2)}`;sessionStorage.setItem("workflow.editorId",editorId);}
  let cursor = 0;
  let pulling = false;
  let active = false;
  let lastClaimAt = 0;
  const base = () => `http://127.0.0.1:${port}`;
  const statePayload = graph => ({ source: "active_editor_draft", editorId, stage:activeStage, graph, fragmentGraph:currentFragmentGraph(), project: projectConfig(), vertexTransform: currentVertexTransform(), selection: [...ui.selectedNodes], view:{x:ui.view.x,y:ui.view.y,zoom:ui.view.zoom}, savedWorkflows: workflowLibrary().map(item=>({id:item.id,title:item.config.title,className:item.config.className,shaderDir:item.config.shaderDir,nodeCount:item.graph.nodes.length,linkCount:item.graph.links.length})), customNodes: JSON.parse(localStorage.getItem("workflow.customNodes")||"[]"), workflowNodes: workflowNodeLibrary().map(item=>({id:item.id,title:item.title,preset:!!item.preset,description:item.description||"",nodeCount:item.graph.nodes.length,linkCount:item.graph.links.length})), generatedSources: lastGeneratedSources, catalog: catalog.filter(n=>supportsStage(n.typeId,activeStage)).map(({typeId,title,category,inputs,outputs,properties})=>({typeId,title,category,inputs,outputs,properties})) });
  async function publish(graph) { try { const response=await fetch(`${base()}/v1/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(statePayload(graph)) }); if(!response.ok)return null;const result=await response.json();active=result.active===true;return result; } catch (_) { active=false;return null; } }
  async function claimActive(graph=store.snapshot(),force=false) { if(!force&&Date.now()-lastClaimAt<750)return active;lastClaimAt=Date.now();await publish(graph);try { const response=await fetch(`${base()}/v1/activate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({editorId})});if(!response.ok)return false;const result=await response.json();active=result.active===true;return active; } catch (_) { active=false;return false; } }
  async function pull() {
    if(pulling)return;
    pulling=true;
    try {
      const response=await fetch(`${base()}/v1/commands?cursor=${cursor}&editorId=${encodeURIComponent(editorId)}`);
      if(!response.ok)return;
      const body=await response.json();
      const groups=new Map();
      for(const item of body.items||[]){const key=item.requestId||`legacy_${item.id}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
      for(const [requestId,items] of groups){
        let error=null;
        try { for(const item of items){if(item.kind==="command")store.command(item.type,item.payload);else if(item.kind==="action")applyBridgeAction(item.type,item.payload||{});} }
        catch(reason) { error=reason; console.warn("Workflow bridge command failed",items,reason);document.querySelector("#footer-message").textContent=`MCP 操作失败：${reason.message||reason}`; }
        if(items[0]?.requestId) await acknowledge(requestId,!error,error?.message||String(error||""));
      }
      cursor=Number(body.cursor||cursor);
    } catch(error) { console.warn("Workflow bridge polling failed",error); }
    finally { pulling=false; }
  }
  async function acknowledge(requestId,ok,error="") { try { await fetch(`${base()}/v1/ack`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({editorId,requestId,ok,error,revision:store.snapshot().revision})}); } catch (_) {} }
  function setPort(value) { port = Math.max(1, Math.min(65535, Number(value) || 4174)); localStorage.setItem("workflow.bridgePort", String(port)); cursor = 0; }
  function url() { return base(); }
  return { publish, pull, claimActive, setPort, url, port:()=>port, editorId:()=>editorId, active:()=>active };
})();
function applyBridgeAction(type, payload) {
  if (type === "SET_STAGE") {if(!stages[payload.stage])throw new Error("未知着色阶段");switchStage(payload.stage);}
  else if (type === "SAVE_WORKFLOW") saveWorkflow();
  else if (type === "EXPORT_RUNTIME") exportRuntime(true);
  else if (type === "NEW_WORKFLOW") { const config=bridgeProjectConfig(payload);openWorkflow(config,starterGraph(),false);saveWorkflow(); }
  else if (type === "RESET_CURRENT_DRAFT") { store.reset(stageStarterGraph());ui.selected=null;ui.selectedNodes.clear(); }
  else if (type === "LOAD_MING_GOD_EXAMPLE") loadMingGodExample(false);
  else if (type === "OPEN_WORKFLOW") { const item=workflowLibrary().find(entry=>entry.id===payload.id);if(!item)throw new Error(`未找到工作流：${payload.id}`);openWorkflow(item.config,item.graph,true,item.vertexTransform); }
  else if (type === "DELETE_WORKFLOW") { const existing=workflowLibrary().find(entry=>entry.id===payload.id);if(!existing)throw new Error(`未找到工作流：${payload.id}`);const remaining=workflowLibrary().filter(entry=>entry.id!==payload.id);localStorage.setItem("workflow.library",JSON.stringify(remaining));if(projectConfig().id===payload.id)openWorkflow(newWorkflowConfig(),starterGraph(),false);renderWorkflowLibrary(); }
  else if (type === "IMPORT_WORKFLOW_DATA") { const imported=validateImportedWorkflow(payload.workflow);openWorkflow(imported.project,imported.graph,false,imported.vertexTransform);saveWorkflow(); }
  else if (type === "SET_PROJECT_CONFIG") { const config={...projectConfig(),...bridgeProjectConfig(payload,projectConfig())};sessionStorage.setItem("workflow.projectConfig",JSON.stringify(config)); }
  else if (type === "SET_VERTEX_TRANSFORM") { const transform=bridgeVertexTransform({...currentVertexTransform(),...payload});transform.graph=migrateVertexGraph(transform.graph,currentFragmentGraph());validateStageGraph(transform.graph,"vertex");stageHistory.delete("vertex");sessionStorage.setItem("workflow.vertexTransform",JSON.stringify(transform));localStorage.setItem("workflow.vertexTransform",JSON.stringify(transform));if(activeStage==="vertex")store.reset(migrateVertexGraph(transform.graph,currentFragmentGraph())); }
  else if (type === "SET_VIEW") { ui.view.x=Number(payload.x)||0;ui.view.y=Number(payload.y)||0;ui.view.zoom=Math.max(.35,Math.min(1.8,Number(payload.zoom)||1));updateView(); }
  else if (type === "SET_SELECTION") { const valid=new Set(store.snapshot().nodes.map(node=>node.id));ui.selectedNodes=new Set((payload.nodeIds||[]).filter(id=>valid.has(id)));ui.selected=[...ui.selectedNodes][0]||null;renderGraph(store.snapshot());renderInspector(store.snapshot()); }
  else if (type === "DELETE_SELECTED") { const ids=[...ui.selectedNodes];ui.selectedNodes.clear();ui.selected=null;store.removeNodes(ids); }
  else if (type === "DISCONNECT_SELECTED") { const ids=new Set(ui.selectedNodes),links=store.snapshot().links.filter(link=>ids.has(link.fromNode)||ids.has(link.toNode));links.forEach(link=>store.command("DISCONNECT",{link})); }
  else if (type === "TOGGLE_SELECTED_PREVIEW") { const nodes=store.snapshot().nodes.filter(node=>ui.selectedNodes.has(node.id)),enabled=typeof payload.enabled==="boolean"?payload.enabled:!nodes.every(node=>node.properties.previewEnabled);nodes.forEach(node=>store.command("SET_PROPERTY",{nodeId:node.id,key:"previewEnabled",value:enabled})); }
  else if (type === "SAVE_SELECTION_AS_WORKFLOW_NODE") saveSelectionAsWorkflowNode(payload.title);
  else if (type === "EXPAND_WORKFLOW_NODE") { if(!workflowNodeLibrary().some(item=>item.id===payload.workflowNodeId))throw new Error(`未找到工作流节点：${payload.workflowNodeId}`);addWorkflowNode(payload.workflowNodeId,Number(payload.canvasX)||100,Number(payload.canvasY)||100); }
  else if (type === "DELETE_WORKFLOW_NODE") { const saved=JSON.parse(localStorage.getItem("workflow.subgraphNodes")||"[]").filter(node=>node.id!==payload.id);localStorage.setItem("workflow.subgraphNodes",JSON.stringify(saved));renderCatalog(); }
  else if (type === "UPSERT_CUSTOM_NODE") { const definition=bridgeCustomDefinition(payload.definition);updateCustomDefinition(definition);renderCatalog(); }
  else if (type === "DELETE_CUSTOM_NODE") { const typeId=String(payload.typeId||"");if(isUserCustomNode(typeId)){const nodes=JSON.parse(localStorage.getItem("workflow.customNodes")||"[]").filter(node=>node.typeId!==typeId);localStorage.setItem("workflow.customNodes",JSON.stringify(nodes));const index=catalog.findIndex(node=>node.typeId===typeId);if(index>=0)catalog.splice(index,1);renderCatalog();} }
  else if (type === "ADD_DEMO") addDemo();
  workflowBridge.publish(store.snapshot());
}
function previewResolution(config=projectConfig()){const value=(key,fallback)=>Math.max(64,Math.min(4096,Math.round(Number(config[key])||fallback)));return {width:value("previewWidth",1024),height:value("previewHeight",1024)};}
function bridgeProjectConfig(payload={},base=newWorkflowConfig()){const resolution=previewResolution({...base,previewWidth:payload.previewWidth??base.previewWidth,previewHeight:payload.previewHeight??base.previewHeight});return {id:String(payload.id||base.id||`workflow_${Date.now()}`),title:String(payload.title||base.title||"Untitled Workflow"),className:String(payload.className||base.className||"GeneratedCombatLayerPlugin").replace(/[^A-Za-z0-9_]/g,"")||"GeneratedCombatLayerPlugin",shaderDir:String(payload.shaderDir||base.shaderDir||"data/shaders/generated"),previewWidth:resolution.width,previewHeight:resolution.height,blendMode:payload.blendMode??base.blendMode??"alpha"};}
function bridgeVertexTransform(payload={}){return normalizeTransform(payload);}
function bridgeCustomDefinition(value){
  if(!value||typeof value!=="object")throw new Error("definition 必须是对象");
  const title=String(value.title||"Custom Node").trim()||"Custom Node",typeId=String(value.typeId||customTypeId(title));
  if(!/^custom\.[A-Za-z0-9._-]+$/.test(typeId))throw new Error("自定义节点 typeId 必须以 custom. 开头");
  const parameters=value.properties?.parameters||value.parameters;
  if(Array.isArray(parameters)){
    const names=new Set(),clean=parameters.map((parameter,index)=>({id:String(parameter.id||`p${index}`),name:String(parameter.name||""),type:typeKey(parameter.type),qualifier:String(parameter.qualifier||"in")}));
    if(!clean.length||!clean.every(parameter=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(parameter.name)&&isSupportedType(parameter.type)&&["in","out","inout"].includes(parameter.qualifier)&&!names.has(parameter.name)&&(names.add(parameter.name),true)))throw new Error("自定义节点参数无效：名称必须唯一，并使用 GLSL 类型和 in/out/inout。");
    const code=String(value.properties?.code??value.code??"");if(!code.trim())throw new Error("自定义节点函数体不能为空");
    return customDefinition(title,typeId,clean,code);
  }
  const inputs=Array.isArray(value.inputs)?value.inputs.map(port=>({name:String(port.name||""),type:typeKey(port.type)})):[];
  const output=typeKey(value.outputs?.[0]?.type||value.outputType||"FLOAT"),expression=String(value.properties?.expression??value.expression??"");
  if(!inputs.every(port=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(port.name)&&isSupportedType(port.type))||!expression.trim())throw new Error("自定义节点输入端口或表达式无效");
  return {typeId,title,category:"自定义 GLSL",inputs,outputs:[{name:"value",type:output}],properties:{expression,helperSource:String(value.properties?.helperSource??value.helperSource??""),custom:true}};
}
const bridgePrompt = async () => { const port=workflowBridge.port(),bridgeUrl=`http://127.0.0.1:${port}`,desktop=window.workflowDesktop||null,nodeConfig={command:"node",args:["/absolute/path/to/MengGodWorkflowStudio/ai-gateway/mcp-server.mjs"],env:{WORKFLOW_BRIDGE_URL:bridgeUrl}},desktopRuntime=desktop?.getMcpConfig?await desktop.getMcpConfig().catch(()=>null):null,desktopConfig=desktopRuntime?.executablePath&&desktopRuntime?.mcpServerPath?{command:desktopRuntime.executablePath,args:[desktopRuntime.mcpServerPath],env:{ELECTRON_RUN_AS_NODE:"1",WORKFLOW_BRIDGE_URL:bridgeUrl}}:null;return `# Workflow Shader MCP 接入说明

桥接地址：${bridgeUrl}

## 桌面版 EXE

桌面版启动时会自动启动本地页面桥接。无需另开 server.mjs，也无需安装 Node.js。请保持编辑器窗口打开，再在 MCP 客户端中新建 STDIO 服务并填写下列 JSON（路径由当前桌面版自动提供）：

\`\`\`json
${JSON.stringify({mcpServers:{"workflow-shader":desktopConfig||{command:"<MengGod Workflow Studio.exe 的完整路径>",args:["<安装目录>/resources/ai-gateway/mcp-server.mjs"],env:{ELECTRON_RUN_AS_NODE:"1",WORKFLOW_BRIDGE_URL:bridgeUrl}}}},null,2)}
\`\`\`

## 浏览器 / 源码版

先在项目根目录启动桥接服务：

\`\`\`powershell
cd <MengGodWorkflowStudio 项目目录>/ai-gateway
$env:WORKFLOW_BRIDGE_PORT = "${port}"
node server.mjs
\`\`\`

然后在 MCP 客户端中新建 STDIO 服务。将 command 中的 node 替换为 Node.js 可执行文件完整路径（若客户端无法从 PATH 找到 node），并将 args 的占位路径替换为本机真实路径：

\`\`\`json
${JSON.stringify({mcpServers:{"workflow-shader":nodeConfig}},null,2)}
\`\`\`

## 使用规则

MCP 服务由 Codex、Claude Desktop 等客户端按需启动，因此 EXE 不会单独常驻一个 MCP 进程；EXE 自动启动的是页面桥接。服务既提供 workflow_* 工具，也提供 workflow://active/summary 只读资源。添加或修改 MCP 配置后，请新建或重启 Agent 会话让工具重新加载；如果 Codex 工具栏没有 workflow_get_status，说明该会话尚未接入，不能用 Shell 手工 JSON-RPC 代替。

打开需要编辑的工作流页面后，在该页面点击“激活当前草稿”或画布，使其成为 MCP 当前编辑器。Agent 必须先调用 workflow_get_status，再调用 workflow_get_summary；这两个接口不会返回纹理 Base64 或生成源码。workflow_get_current 仅用于调试。不要让 Agent 另开编辑器页面，也不要调用 workflow_open、workflow_create、workflow_import 或 workflow_reset，除非用户明确要求切换、创建、导入或重置工作流。写入操作使用 expectedRevision，完成后再次读取 workflow_get_summary 验证，再调用 workflow_export_runtime。`; };
async function checkBridge() { const status=document.querySelector("#bridge-status");workflowBridge.setPort(document.querySelector("#bridge-port").value);try { const response=await fetch(`${workflowBridge.url()}/health`);if(!response.ok)throw new Error(`HTTP ${response.status}`);const claimed=await workflowBridge.claimActive(store.snapshot(),true);if(!claimed)throw new Error("当前页面未能成为活动编辑器");status.textContent=`已激活：${workflowBridge.url()}（MCP 将操作此页面的未保存草稿）`;status.style.color="#74dfa4";}catch(error){status.textContent=`未连接：请先启动 ai-gateway/server.mjs（${workflowBridge.url()}）`;status.style.color="#ff9eaa";} }
async function selfTestMcp(){const status=document.querySelector("#bridge-status");try{await checkBridge();if(!window.workflowDesktop?.testMcp)throw new Error("MCP 自检仅在桌面 EXE 中可用。");const result=await window.workflowDesktop.testMcp(),required=result.requiredTools.filter(name=>!result.tools.includes(name));if(required.length)throw new Error(`stdio MCP 缺少工具：${required.join(", ")}`);status.textContent=`MCP 本机自检通过：${result.toolCount} 个工具，已验证 ${result.bridgeUrl}。请在 Codex 新会话确认 workflow_get_status 已出现。`;status.style.color="#74dfa4";}catch(error){status.textContent=`MCP 自检失败：${error.message||error}`;status.style.color="#ff9eaa";}}
const nodeLayer = document.querySelector("#node-layer"), wireLayer = document.querySelector("#wire-layer"), shell = document.querySelector("#canvas-shell"), graphTransform = document.querySelector("#graph-transform"), hint = document.querySelector(".canvas-hint");
let renderedPreviewRevision = -1;
function updateView() { graphTransform.style.transform = `translate(${ui.view.x}px, ${ui.view.y}px) scale(${ui.view.zoom})`; }
function toWorld(clientX, clientY) { const rect=shell.getBoundingClientRect(); return { x:(clientX-rect.left-ui.view.x)/ui.view.zoom, y:(clientY-rect.top-ui.view.y)/ui.view.zoom }; }
const def = (typeId) => catalog.find(d => d.typeId === typeId);
const nodeDef = (node) => {
  const base = def(node.typeId); if (!base?.dynamicKind) return base;
  const type = node.properties.valueType || "AUTO", resolved = type === "AUTO" ? "ANY" : type;
  if (base.dynamicKind === "splitVector") {
    const count={VEC2:2,VEC3:3,VEC4:4}[resolved] || 0;
    return { ...base, inputs: base.inputs.map(port => ({ ...port, type: resolved })), outputs: base.outputs.slice(0,count) };
  }
  if (base.dynamicKind === "combineVector") {
    const count={VEC2:2,VEC3:3,VEC4:4}[resolved] || 2;
    return { ...base, inputs: base.inputs.slice(0,count), outputs: base.outputs.map(port => ({ ...port, type: resolved === "ANY" ? "VEC2" : resolved })) };
  }
  if (base.dynamicKind === "scaleVector") return { ...base, inputs: base.inputs.map(port => ({ ...port, type: port.name === "scale" ? "FLOAT" : resolved })), outputs: base.outputs.map(port => ({ ...port, type: resolved })) };
  if (base.dynamicKind === "mix") return { ...base, inputs: base.inputs.map(port => ({ ...port, type: port.name === "t" ? "FLOAT" : resolved })), outputs: base.outputs.map(port => ({ ...port, type: resolved })) };
  if (base.dynamicKind === "output") return { ...base, outputs: base.outputs.map(port => ({ ...port, type: resolved })) };
  if (base.dynamicKind === "vectorInput") return { ...base, inputs: base.inputs.map(port => ({ ...port, type: resolved })) };
  return { ...base, inputs: base.inputs.map(port => ({ ...port, type: resolved })), outputs: base.outputs.map(port => ({ ...port, type: resolved })) };
};
// Type keys remain backward-compatible with saved MVP workflows.  Every user-facing label is
// the exact GLSL spelling, which also makes custom-node signatures directly transferable to GLSL.
const GLSL_TYPE_OPTIONS = ["bool", "int", "uint", "float", "vec2", "vec3", "vec4", "ivec2", "ivec3", "ivec4", "uvec2", "uvec3", "uvec4", "bvec2", "bvec3", "bvec4", "mat2", "mat3", "mat4", "sampler2D", "samplerCube"];
const TYPE_KEY_BY_GLSL = Object.fromEntries(GLSL_TYPE_OPTIONS.map(type => [type.toLowerCase(), type === "sampler2D" ? "SAMPLER2D" : type === "samplerCube" ? "SAMPLER_CUBE" : type.toUpperCase()]));
function typeKey(type) { return TYPE_KEY_BY_GLSL[String(type || "float").toLowerCase()] || String(type || "FLOAT").toUpperCase(); }
function typeLabel(type) { const key=typeKey(type); return ({BOOL:"bool",INT:"int",UINT:"uint",FLOAT:"float",VEC2:"vec2",VEC3:"vec3",VEC4:"vec4",IVEC2:"ivec2",IVEC3:"ivec3",IVEC4:"ivec4",UVEC2:"uvec2",UVEC3:"uvec3",UVEC4:"uvec4",BVEC2:"bvec2",BVEC3:"bvec3",BVEC4:"bvec4",MAT2:"mat2",MAT3:"mat3",MAT4:"mat4",SAMPLER2D:"sampler2D",SAMPLER_CUBE:"samplerCube"})[key] || "float"; }
function isSupportedType(type) { return Object.values(TYPE_KEY_BY_GLSL).includes(typeKey(type)); }
const numericTypes = ["BOOL", "INT", "UINT", "FLOAT", "VEC2", "VEC3", "VEC4", "IVEC2", "IVEC3", "IVEC4", "UVEC2", "UVEC3", "UVEC4", "BVEC2", "BVEC3", "BVEC4"];
const portType = (graph, nodeId, socket, direction) => nodeDef(graph.nodes.find(node => node.id === nodeId))?.[direction === "output" ? "outputs" : "inputs"].find(port => port.name === socket)?.type;
const compatible = (from, to) => typeKey(from) === "ANY" || typeKey(to) === "ANY" || typeKey(from) === typeKey(to);
function resolveTypes(graph) {
  for (let pass=0;pass<graph.nodes.length;pass++) graph.links.forEach(link => {
    const fromType=portType(graph,link.fromNode,link.fromSocket,"output"), toType=portType(graph,link.toNode,link.toSocket,"input"),fromKey=typeKey(fromType),toKey=typeKey(toType);
    if(fromKey === "ANY" && numericTypes.includes(toKey)) graph.nodes.find(node=>node.id===link.fromNode).properties.valueType=toKey;
    if(toKey === "ANY" && numericTypes.includes(fromKey)) graph.nodes.find(node=>node.id===link.toNode).properties.valueType=fromKey;
  });
}
function pruneInvalidLinks(graph) { graph.links=graph.links.filter(link=>compatible(portType(graph,link.fromNode,link.fromSocket,"output"),portType(graph,link.toNode,link.toSocket,"input"))&&!isInvalidBranchConnection(graph,link)); }
const id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
const portId = (nodeId, direction, name) => `${nodeId}:${direction}:${name}`;
const path = (x1, y1, x2, y2) => { const d = Math.max(56, Math.abs(x2 - x1) * .55); return `M ${x1} ${y1} C ${x1 + d} ${y1}, ${x2 - d} ${y2}, ${x2} ${y2}`; };
function addNode(typeId, x = 100, y = 100) {
  const d = def(typeId), node = { id: id(typeId.split(".").pop()), typeId, title: d.title, canvasX: Math.round(x), canvasY: Math.round(y), properties: { ...clone(d.properties), previewEnabled: !["math.constant"].includes(typeId) } };
  if(["io.input","input.texture"].includes(typeId)){node.properties.parameterId=node.id;node.properties.uniform="u_"+node.id;}
  store.command("ADD_NODE", { node }); select(node.id);
}
function timePreviewNode(graph){return graph.nodes.find(node=>node.typeId==="input.time")||null;}
function previewTimeValue(graph){const node=timePreviewNode(graph),base=Number(node?.properties?.defaultValue??0)||0;return previewClock.enabled&&node?base+(performance.now()-previewClock.startedAt)/1000:base;}
function updatePreviewTimeControl(graph){let button=document.querySelector("#preview-time-toggle");if(!button){button=document.createElement("button");button.type="button";button.id="preview-time-toggle";button.title="仅驱动编辑器节点预览，不会改变导出的着色器或运行时代码";document.querySelector(".toolbar").prepend(button);button.addEventListener("click",()=>{previewClock.enabled=!previewClock.enabled;previewClock.startedAt=performance.now();sessionStorage.setItem("workflow.previewTimeEnabled",String(previewClock.enabled));updatePreviewTimeControl(store.snapshot());drawNodePreviews(store.snapshot());scheduleTimePreviews();});}const available=!!timePreviewNode(graph);button.hidden=!available;button.textContent=previewClock.enabled?"预览时间：开":"预览时间：关";if(!available&&previewClock.enabled){previewClock.enabled=false;sessionStorage.setItem("workflow.previewTimeEnabled","false");}}
function branchOwner(graph,node){return graph.nodes.find(item=>{if(item.typeId==="logic.if")return node.canvasX>=item.canvasX&&node.canvasX<=item.canvasX+Number(item.properties.trueWidth||430)*2+40&&node.canvasY>=item.canvasY+48&&node.canvasY<=item.canvasY+Number(item.properties.trueHeight||300)+48;if(item.typeId==="logic.for")return node.canvasX>=item.canvasX&&node.canvasX<=item.canvasX+Number(item.properties.width||430)&&node.canvasY>=item.canvasY+48&&node.canvasY<=item.canvasY+48+Number(item.properties.height||300);return false;});}
function branchSide(controlNode,node){return controlNode.typeId==="logic.for"?"loop":node.canvasX<controlNode.canvasX+Number(controlNode.properties.trueWidth||430)+20?"true":"false";}
function isInvalidBranchConnection(graph,link){const source=graph.nodes.find(node=>node.id===link.fromNode),target=graph.nodes.find(node=>node.id===link.toNode);if(!source||!target)return false;if(source.typeId==="logic.for"&&link.fromSocket==="i"){const targetOwner=branchOwner(graph,target);return !targetOwner||targetOwner.id!==source.id;}if(source.typeId==="logic.variable"&&link.fromSocket==="value")return false;const sourceOwner=branchOwner(graph,source);if(!sourceOwner)return false;if(target.typeId==="logic.variable")return link.toSocket!=="value";const targetOwner=branchOwner(graph,target);return !targetOwner||targetOwner.id!==sourceOwner.id||branchSide(sourceOwner,source)!==branchSide(targetOwner,target);}
function variableBranchOwner(graph,node){const link=graph.links.find(item=>item.toNode===node.id&&item.toSocket==="value"),source=link&&graph.nodes.find(item=>item.id===link.fromNode),owner=source&&branchOwner(graph,source)||branchOwner(graph,node);return owner?{ownerId:owner.id,branch:branchSide(owner,source||node)}:null;}
function migrateBranchMetadata(graph){
  if(!graph?.nodes)return graph;
  const additions=[];
  graph.nodes.forEach(node=>{
    if(!node.properties)return;
    const originalType=node.typeId;
    if(originalType==="vector.constant3"){
      node.typeId="math.constant";
      node.properties.value=`${node.properties.x??0}, ${node.properties.y??0}, ${node.properties.z??0}`;
      node.properties.valueType="VEC3";
      delete node.properties.x;delete node.properties.y;delete node.properties.z;
    }
    if(originalType==="vector.scale2"||originalType==="vector.scale3"){
      node.typeId="vector.scale";
      node.properties.valueType=originalType.endsWith("2")?"VEC2":"VEC3";
    }
    if(originalType==="vector.distance"){
      node.typeId="vector.length";
      node.properties.valueType=node.properties.valueType||"VEC2";
      graph.links.filter(link=>link.fromNode===node.id&&link.fromSocket==="distance").forEach(link=>{link.fromSocket="length";});
    }
    const legacyType={"vector.combine2":"VEC2","vector.combine3":"VEC3","vector.combine4":"VEC4","vector.extractX":"VEC2","vector.extractY":"VEC2"}[originalType];
    if(legacyType){
      const isExtract=originalType.startsWith("vector.extract");
      node.typeId=isExtract?"vector.split":"vector.combine";
      node.properties.valueType=legacyType;
      if(isExtract)graph.links.filter(link=>link.fromNode===node.id).forEach(link=>{link.fromSocket=originalType.endsWith("Y")?"y":"x";});
      if(originalType==="vector.combine4"){
        const splitId=`${node.id}_legacy_split`,rgbLink=graph.links.find(link=>link.toNode===node.id&&link.toSocket==="rgb"),alphaLink=graph.links.find(link=>link.toNode===node.id&&link.toSocket==="a");
        if(rgbLink){rgbLink.toNode=splitId;rgbLink.toSocket="value";additions.push({id:splitId,typeId:"vector.split",title:"拆分 RGBA 颜色",canvasX:node.canvasX-230,canvasY:node.canvasY+120,properties:{valueType:"VEC3",previewEnabled:false}});["x","y","z"].forEach(socket=>graph.links.push({fromNode:splitId,fromSocket:socket,toNode:node.id,toSocket:socket}));}
        if(alphaLink)alphaLink.toSocket="w";
        graph.links.filter(link=>link.fromNode===node.id&&link.fromSocket==="color").forEach(link=>{link.fromSocket="value";});
      }
    }
    delete node.properties.ifId;
    delete node.properties.branchIfId;
    delete node.properties.branch;
    delete node.properties.component;
  });
  graph.nodes.push(...additions);
  return graph;
}
function select(nodeId, append=false) { if(!append)ui.selectedNodes.clear();ui.selectedNodes.add(nodeId);ui.selected = nodeId;document.querySelectorAll(".workflow-node.selected").forEach(node=>node.classList.remove("selected"));ui.selectedNodes.forEach(id=>document.querySelector(`.workflow-node[data-id="${id}"]`)?.classList.add("selected"));renderInspector(store.snapshot()); }
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]);}
function portSummary(ports){return ports?.length?ports.map(port=>`${port.name}: ${typeLabel(port.type)}`).join("，"):"无";}
function nodeDescription(definition){
  const special={
    "io.input":"声明一个由 Java Plugin 构造器传入、再以 uniform 参与片段工作流的参数。输出类型可切换；defaultValue 只用于编辑器预览。",
    "input.texture":"声明一个纹理 uniform。编辑器中的图片仅供预览；导出后的 Plugin 构造器需要由调用者传入对应 SpriteAPI。",
    "input.time":"提供着色器时间 uniform。导出运行时由 Plugin 的 advance(amount) 累积；预览时间开关只影响编辑器画面。",
    "input.uv":"提供标准化 UV 坐标，左下为 (0, 0)，右上为 (1, 1)。",
    "io.output":"片段着色器的最终出口。必须把一个 VEC4 连到 color，才可以导出运行文件。",
    "logic.if":"条件输入必须是 BOOL。TRUE 与 FALSE 框内的普通节点只能连接同一分支内的节点，不能直接跨出分支。若要把分支结果带到框外，先用变量节点：在 If 前通过 init 初始化，在分支内将结果连到变量的 value，再从变量输出继续连接。",
    "logic.for":"count 指定循环次数，i 输出只能连接到该循环框内节点。循环体若要向外带出结果，使用变量节点：init 在循环前初始化，value 在循环体内赋值，再使用变量输出。",
    "logic.variable":"valueType 决定变量数据类型。init 是控制块之前的初始化入口，未连接时使用 initialValue；value 是 If 分支或 For 循环内的赋值入口。变量输出是唯一允许从控制块内部带值到外部的通道。",
    "vector.split":"将输入向量拆为分量出口。输入类型决定可用的 x/y/z/w 输出数量；VEC2 仅使用 x、y，VEC3 增加 z，VEC4 再增加 w。",
    "vector.combine":"将多个 FLOAT 分量组合成向量。valueType 决定结果类型和生效入口数量：VEC2 使用 x/y，VEC3 使用 x/y/z，VEC4 使用 x/y/z/w。",
    "texture.sample2d":"按 UV 坐标采样 SAMPLER2D，输出 RGBA（VEC4）。预览与导出都会保持纹理比例并对画布外区域透明处理。",
    "noise.perlin":"二维经典梯度柏林噪声。输入 uv 坐标，输出平滑的 0-1 FLOAT 噪声，可先缩放 UV 再连接以控制颗粒大小。",
    "noise.turbulize":"将任意 FLOAT 噪声转换为湍流强度，等价于 abs(noise)。它不会自行生成坐标噪声，因此可串接柏林、Simplex、纹理或自定义噪声。"
  };
  if(special[definition.typeId])return special[definition.typeId];
  if(definition.typeId.startsWith("custom."))return "执行用户定义的 GLSL void 函数。参数表采用 GLSL 的 in、out、inout：in 只有输入端口，out 只有输出端口，inout 同时具有输入和输出端口。单击画布实例或双击左侧节点库条目即可编辑定义。";
  const category={"数学":"对输入执行 GLSL 数学运算。", "向量":"对标量或向量执行构造、分解或几何运算。", "噪声":"从坐标生成程序化噪声值；通常输入 UV 或三维坐标，输出 FLOAT。", "SDF":"计算有符号距离场；距离通常小于 0 表示形状内部。", "曲线":"根据控制点和参数 t 计算曲线上的值。", "形状":"用于构成可复用图形效果的计算。", "逻辑":"执行布尔判断或控制流计算。", "输入输出":"向工作流提供资源或输出最终片段颜色。"}[definition.category]||"执行此节点定义的计算。";
  return `${category} 输入：${portSummary(definition.inputs)}。输出：${portSummary(definition.outputs)}。`;
}
function renderCatalog(filter = "") {
  const root = document.querySelector("#node-catalog"); root.innerHTML = "";
  if (!filter) { const create=document.createElement("button");create.type="button";create.className="catalog-create-custom";create.textContent="+ 创建自定义 GLSL 节点";create.addEventListener("click",()=>openCustomNodeEditor());root.append(create); }
  if (!filter) renderWorkflowNodeCatalog(root);
  const groups = new Map();
  const compositeTypes=new Set(["shape.lanceTaper","shape.xFade","shape.fadeVertical","shape.fadeHorizontal","sdf.lance","curve.quarticBezier"]);
  catalog.filter(n => supportsStage(n.typeId,activeStage) && !compositeTypes.has(n.typeId) && (n.title.includes(filter) || n.category.includes(filter))).forEach(n => { if (!groups.has(n.category)) groups.set(n.category, []); groups.get(n.category).push(n); });
  groups.forEach((nodes, category) => {
    const section = document.createElement("section"),collapsed=!filter&&ui.catalogCollapsed.has(category);section.className=`catalog-group${collapsed?" collapsed":""}`;
    const heading=document.createElement("button");heading.type="button";heading.className="catalog-group-title";heading.innerHTML=`<span>${category}</span><span class="catalog-chevron">▾</span>`;heading.addEventListener("click",()=>{if(ui.catalogCollapsed.has(category))ui.catalogCollapsed.delete(category);else ui.catalogCollapsed.add(category);localStorage.setItem("workflow.catalogCollapsed",JSON.stringify([...ui.catalogCollapsed]));renderCatalog(document.querySelector("#node-search").value);});section.append(heading);
    const entries=document.createElement("div");entries.className="catalog-entries";nodes.forEach(n => { const e = document.createElement("div"); e.className = "catalog-node"; e.dataset.type = n.typeId; e.draggable = true; e.title=`${nodeDescription(n)}\n\n拖到工作区创建节点${n.typeId.startsWith("custom.")?"；双击编辑定义":""}`; e.innerHTML = `<span class="catalog-dot"></span><span>${n.title}</span>`; e.addEventListener("dragstart", ev => { ev.dataTransfer.effectAllowed="copy";ev.dataTransfer.setData("node-type", n.typeId); }); if(n.typeId.startsWith("custom."))e.addEventListener("dblclick",event=>{event.preventDefault();openCustomNodeEditor(n);});if (isUserCustomNode(n.typeId)) e.addEventListener("contextmenu", event => deleteUserCustomNode(event,n.typeId,n.title)); entries.append(e); });section.append(entries);root.append(section);
  });
}
function presetWorkflowNodes(){const constant=(id,title,x,y,value)=>({id,typeId:"math.constant",title,canvasX:x,canvasY:y,properties:{value:String(value),previewEnabled:false,valueType:"FLOAT"}});return [{id:"preset.horizontalFade",title:"横向淡出",preset:true,description:"由 UV、拆分向量、两个 smoothstep 和乘法组成",graph:{nodes:[{id:"wf_uv",typeId:"input.uv",title:"UV 坐标",canvasX:0,canvasY:0,properties:{previewEnabled:true}},{id:"wf_split",typeId:"vector.split",title:"拆分 UV",canvasX:230,canvasY:0,properties:{previewEnabled:true,valueType:"VEC2"}},constant("wf_l0","左边界 0.0",260,-130,0),constant("wf_l1","左边界 0.15",260,-75,.15),constant("wf_r0","右边界 1.0",260,135,1),constant("wf_r1","右边界 0.85",260,190,.85),{id:"wf_left",typeId:"math.smoothstep",title:"左侧淡入",canvasX:460,canvasY:-70,properties:{previewEnabled:true,valueType:"FLOAT"}},{id:"wf_right",typeId:"math.smoothstep",title:"右侧淡出",canvasX:460,canvasY:90,properties:{previewEnabled:true,valueType:"FLOAT"}},{id:"wf_multiply",typeId:"math.multiply",title:"横向淡出",canvasX:700,canvasY:10,properties:{previewEnabled:true,valueType:"FLOAT"}}],links:[{fromNode:"wf_uv",fromSocket:"uv",toNode:"wf_split",toSocket:"value"},{fromNode:"wf_split",fromSocket:"x",toNode:"wf_left",toSocket:"x"},{fromNode:"wf_l0",fromSocket:"value",toNode:"wf_left",toSocket:"edge0"},{fromNode:"wf_l1",fromSocket:"value",toNode:"wf_left",toSocket:"edge1"},{fromNode:"wf_split",fromSocket:"x",toNode:"wf_right",toSocket:"x"},{fromNode:"wf_r0",fromSocket:"value",toNode:"wf_right",toSocket:"edge0"},{fromNode:"wf_r1",fromSocket:"value",toNode:"wf_right",toSocket:"edge1"},{fromNode:"wf_left",fromSocket:"value",toNode:"wf_multiply",toSocket:"a"},{fromNode:"wf_right",fromSocket:"value",toNode:"wf_multiply",toSocket:"b"}]}}];}
function workflowNodeLibrary(){try{return [...presetWorkflowNodes(),...JSON.parse(localStorage.getItem("workflow.subgraphNodes")||"[]")];}catch(_){return presetWorkflowNodes();}}
function isUserCustomNode(typeId){return typeId.startsWith("custom.")&&!['custom.radialFade','custom.innerFade'].includes(typeId);}
function deleteUserCustomNode(event,typeId,title){event.preventDefault();if(!window.confirm(`删除自定义节点“${title}”？现有工作流中的实例不会自动删除。`))return;const nodes=JSON.parse(localStorage.getItem("workflow.customNodes")||"[]").filter(node=>node.typeId!==typeId);localStorage.setItem("workflow.customNodes",JSON.stringify(nodes));const index=catalog.findIndex(node=>node.typeId===typeId);if(index>=0)catalog.splice(index,1);renderCatalog(document.querySelector("#node-search").value);document.querySelector("#footer-message").textContent=`已删除自定义节点：${title}`;}
function deleteWorkflowNode(event,item){event.preventDefault();if(!window.confirm(`删除工作流节点“${item.title}”？`))return;const saved=JSON.parse(localStorage.getItem("workflow.subgraphNodes")||"[]").filter(node=>node.id!==item.id);localStorage.setItem("workflow.subgraphNodes",JSON.stringify(saved));renderCatalog(document.querySelector("#node-search").value);document.querySelector("#footer-message").textContent=`已删除工作流节点：${item.title}`;}
function renderWorkflowNodeCatalog(root){const nodes=workflowNodeLibrary().filter(item=>item.graph.nodes.every(n=>supportsStage(n.typeId,activeStage))),section=document.createElement("section");section.className="catalog-group workflow-node-group";section.innerHTML='<div class="catalog-group-title static"><span>工作流节点</span><span class="catalog-chevron">▣</span></div>';const entries=document.createElement("div");entries.className="catalog-entries";nodes.forEach(item=>{const entry=document.createElement("div");entry.className=`catalog-node workflow-catalog-node${item.preset?"":" user-workflow-node"}`;entry.dataset.workflowNodeId=item.id;entry.draggable=true;entry.title=item.preset?(item.description||"拖到工作区展开子流程图"):`用户工作流节点：${item.description||"拖到工作区展开子流程图"}（右键删除）`;entry.innerHTML=`<span class="catalog-dot"></span><span>${item.title}</span>${item.preset?"":"<small>用户</small>"}`;entry.addEventListener("dragstart",event=>{event.dataTransfer.effectAllowed="copy";event.dataTransfer.setData("workflow-node-id",item.id);});if(!item.preset)entry.addEventListener("contextmenu",event=>deleteWorkflowNode(event,item));entries.append(entry);});section.append(entries);root.append(section);}
function normalizeGraphFragment(fragment){const source=clone(fragment),minX=Math.min(...source.nodes.map(node=>node.canvasX)),minY=Math.min(...source.nodes.map(node=>node.canvasY));source.nodes.forEach(node=>{node.canvasX-=minX;node.canvasY-=minY;});return source;}
function addWorkflowNode(workflowNodeId,x,y){const workflow=workflowNodeLibrary().find(item=>item.id===workflowNodeId);if(!workflow)return;pasteGraphFragment(normalizeGraphFragment(workflow.graph),{x,y},`已展开工作流节点：${workflow.title}`);}
function selectedGraphFragment(){const graph=store.snapshot(),ids=new Set(ui.selectedNodes),nodes=graph.nodes.filter(node=>ids.has(node.id));return {nodes,links:graph.links.filter(link=>ids.has(link.fromNode)&&ids.has(link.toNode))};}
function copySelectedNodes(){const fragment=selectedGraphFragment();if(!fragment.nodes.length){document.querySelector("#footer-message").textContent="请先选择要复制的节点";return false;}const minX=Math.min(...fragment.nodes.map(node=>node.canvasX)),minY=Math.min(...fragment.nodes.map(node=>node.canvasY));ui.clipboard={nodes:fragment.nodes.map(node=>({...clone(node),canvasX:node.canvasX-minX,canvasY:node.canvasY-minY})),links:clone(fragment.links)};document.querySelector("#footer-message").textContent=`已复制 ${fragment.nodes.length} 个节点和 ${fragment.links.length} 条内部连线`;
  navigator.clipboard?.writeText(JSON.stringify({schema:"MengGodWorkflowFragment",...ui.clipboard})).catch(()=>{});return true;
}
function pasteGraphFragment(fragment,position,message=null){if(!fragment?.nodes?.length)return false;if(fragment.nodes.some(n=>!supportsStage(n.typeId,activeStage))){document.querySelector("#footer-message").textContent="所选内容含有其他着色阶段专用节点";return false;}const source=clone(fragment),ids=new Map(),created=[];source.nodes.forEach(node=>ids.set(node.id,id("paste")));store.checkpoint();source.nodes.forEach(node=>{const oldId=node.id;node.id=ids.get(oldId);node.canvasX=Math.round(position.x+node.canvasX);node.canvasY=Math.round(position.y+node.canvasY);created.push(node.id);store.graph.nodes.push(node);if(node.typeId===stages[activeStage].output)store.graph.outputNodeId=node.id;});source.links.forEach(link=>{const fromNode=ids.get(link.fromNode),toNode=ids.get(link.toNode);if(fromNode&&toNode)store.graph.links.push({...link,fromNode,toNode});});resolveTypes(store.graph);pruneInvalidLinks(store.graph);store.graph.previewRevision=++store.previewRevision;store.graph.revision++;ui.selectedNodes=new Set(created);ui.selected=created[0]||null;store.emit();document.querySelector("#footer-message").textContent=message||`已粘贴 ${created.length} 个节点`;return true;}
function pasteClipboard(position){if(!ui.clipboard?.nodes?.length){document.querySelector("#footer-message").textContent="剪贴板中没有可粘贴的节点";return false;}return pasteGraphFragment(ui.clipboard,position);}
function cutSelectedNodes(){if(!copySelectedNodes())return;const ids=[...ui.selectedNodes];ui.selectedNodes.clear();ui.selected=null;store.checkpoint();store.graph.nodes=store.graph.nodes.filter(node=>!ids.includes(node.id));store.graph.links=store.graph.links.filter(link=>!ids.includes(link.fromNode)&&!ids.includes(link.toNode));if(ids.includes(store.graph.outputNodeId))store.graph.outputNodeId=null;store.graph.previewRevision=++store.previewRevision;store.graph.revision++;store.emit();document.querySelector("#footer-message").textContent=`已剪切 ${ids.length} 个节点`;}
function saveSelectionAsWorkflowNode(requestedTitle=null){const fragment=selectedGraphFragment();if(!fragment.nodes.length){document.querySelector("#footer-message").textContent="请先选择节点";return false;}const title=String(requestedTitle||`工作流节点 ${workflowNodeLibrary().filter(item=>!item.preset).length+1}`).trim()||"工作流节点";const custom={id:`subgraph_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,title,preset:false,description:"用户保存的组合节点",graph:clone(fragment)};const items=workflowNodeLibrary().filter(item=>!item.preset);items.push(custom);localStorage.setItem("workflow.subgraphNodes",JSON.stringify(items));renderCatalog("");document.querySelector("#node-search").value="";document.querySelector("#footer-message").textContent=`已保存工作流节点：${custom.title}（${fragment.nodes.length} 个节点）`;return true;}
function openWorkflowNodeSaveDialog(){const fragment=selectedGraphFragment();if(!fragment.nodes.length){document.querySelector("#footer-message").textContent="请先选择节点";return;}const dialog=document.querySelector("#workflow-node-save-dialog"),title=dialog.querySelector("#workflow-node-save-title");dialog.querySelector("#workflow-node-save-summary").textContent=`将保存 ${fragment.nodes.length} 个节点和 ${fragment.links.length} 条内部连线。`;title.value=`工作流节点 ${workflowNodeLibrary().filter(item=>!item.preset).length+1}`;dialog.showModal();requestAnimationFrame(()=>{title.focus();title.select();});}
function renderGraph(graph) {
  // Rebuilding node cards also creates fresh preview canvases, so their previous GPU frame cannot be reused.
  renderedPreviewRevision = -1;
  updatePreviewTimeControl(graph);
  nodeLayer.innerHTML = ""; wireLayer.innerHTML = ""; hint.hidden = graph.nodes.length > 0;
  graph.nodes.filter(node=>node.typeId==="logic.if").forEach(node=>{
    const trueWidth=Number(node.properties.trueWidth||430),trueHeight=Number(node.properties.trueHeight||300),falseWidth=Number(node.properties.falseWidth||430),falseHeight=Number(node.properties.falseHeight||300),frame=document.createElement("section");
    frame.className="if-branches";frame.style.left=`${node.canvasX}px`;frame.style.top=`${node.canvasY+42}px`;frame.innerHTML=`<div class="if-branch true" style="width:${trueWidth}px;height:${trueHeight}px"><span>TRUE 分支</span></div><div class="if-branch false" style="width:${falseWidth}px;height:${falseHeight}px"><span>FALSE 分支</span></div>`;frame.addEventListener("pointerdown",event=>beginControlDrag(event,node));nodeLayer.append(frame);
  });
  graph.nodes.filter(node=>node.typeId==="logic.for").forEach(node=>{const width=Number(node.properties.width||430),height=Number(node.properties.height||300),frame=document.createElement("section");frame.className="for-branch";frame.style.left=`${node.canvasX}px`;frame.style.top=`${node.canvasY+42}px`;frame.innerHTML=`<span>FOR 循环体 · 使用 i 输出作为索引</span>`;frame.style.width=`${width}px`;frame.style.height=`${height}px`;frame.addEventListener("pointerdown",event=>beginControlDrag(event,node));nodeLayer.append(frame);});
  graph.nodes.forEach(node => {
    const d = nodeDef(node), element = document.createElement("article"); element.className = `workflow-node${ui.selectedNodes.has(node.id) ? " selected" : ""}`; element.dataset.id = node.id; element.dataset.type = node.typeId; element.style.left = `${node.canvasX}px`; element.style.top = `${node.canvasY}px`;
    const showPreview=d.outputs.length && node.properties.previewEnabled;
    element.innerHTML = `<header class="node-header"><span class="type-icon"></span><span>${node.title||d.title}</span><span class="node-id">${escapeHtml(["io.input","input.texture"].includes(node.typeId)?parameterId(node):node.id)}</span></header>${showPreview ? `<canvas class="node-preview" width="112" height="112" title="节点输出预览"></canvas>` : ""}<div class="node-body"></div>`;
    element.addEventListener("pointerdown", event => {
      if (event.button !== 0 || isNodeInteractiveTarget(event.target)) return;
      beginDrag(event, node);
    });
    element.addEventListener("contextmenu", event => openContextMenu(event, node.id));
    if (node.typeId.startsWith("custom.")) element.addEventListener("click", event => { if(!isNodeInteractiveTarget(event.target)){ event.preventDefault(); select(node.id); openCustomNodeEditor(def(node.typeId), node.id); } });
    const body = element.querySelector(".node-body");
    d.inputs.forEach(p => body.append(portRow(node, p, "input"))); d.outputs.forEach(p => body.append(portRow(node, p, "output"))); nodeLayer.append(element);
  });
  requestAnimationFrame(() => { drawWires(graph); if (renderedPreviewRevision !== graph.previewRevision) { drawNodePreviews(graph); renderedPreviewRevision = graph.previewRevision; } scheduleTimePreviews(); });
}
function isNodeInteractiveTarget(target) {
  return target.closest(".port, button, input, select, textarea, [contenteditable='true']");
}
function portRow(node, port, direction) {
  const row = document.createElement("div"); row.className = `port-row ${direction}`; const p = document.createElement("i"); p.className = `port ${direction}`; p.dataset.portId = portId(node.id, direction, port.name); p.dataset.nodeId = node.id; p.dataset.socket = port.name; p.dataset.direction = direction; p.dataset.valueType = port.type;
  p.addEventListener("pointerdown", e => beginWire(e, p)); row.append(p); row.insertAdjacentHTML("beforeend", direction === "input" ? `<span class="port-label">${port.name}</span><span class="port-type">${typeLabel(port.type)}</span>` : `<span class="port-type">${typeLabel(port.type)}</span><span class="port-label">${port.name}</span>`); return row;
}
function beginDrag(event, node) { if (event.button !== 0) return; event.stopPropagation();if(!ui.selectedNodes.has(node.id))select(node.id);startDrag(event,[...ui.selectedNodes]); }
function startDrag(event,nodeIds) { const nodes=[...new Set(nodeIds)].map(nodeId=>store.node(nodeId)).filter(Boolean).map(item=>({id:item.id,startX:item.canvasX,startY:item.canvasY}));if(!nodes.length)return;store.checkpoint();ui.drag={nodes,x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture?.(event.pointerId); }
function controlBranchMembers(graph,control) { return [control.id,...graph.nodes.filter(node=>node.id!==control.id&&branchOwner(graph,node)?.id===control.id).map(node=>node.id)]; }
function beginControlDrag(event,control) { if(event.button!==0)return;event.preventDefault();event.stopPropagation();const ids=controlBranchMembers(store.snapshot(),control);ui.selectedNodes=new Set(ids);ui.selected=control.id;renderInspector(store.snapshot());startDrag(event,ids); }
function beginWire(event, port) {
  if (event.button !== 0) return; event.stopPropagation(); const graph=store.snapshot(), direction=port.dataset.direction;
  if (direction === "input") { const link=graph.links.find(item=>item.toNode===port.dataset.nodeId&&item.toSocket===port.dataset.socket); if(!link)return; ui.disconnectWire={link,type:port.dataset.valueType,x:event.clientX,y:event.clientY}; markCompatible(port.dataset.valueType,"output"); return; }
  ui.pendingWire = { fromNode: port.dataset.nodeId, fromSocket: port.dataset.socket, type: port.dataset.valueType, x: event.clientX, y: event.clientY }; markCompatible(port.dataset.valueType,"input");
}
function markCompatible(type, direction) { document.querySelectorAll(`.port.${direction}`).forEach(port => { if (compatible(type,port.dataset.valueType)) port.classList.add("compatible"); }); }
function clearCompatible() { document.querySelectorAll(".port.compatible").forEach(p => p.classList.remove("compatible")); }
function portCenter(selector) { const element = document.querySelector(selector); if (!element) return null; const a = element.getBoundingClientRect(), b = shell.getBoundingClientRect(); return { x: (a.left - b.left - ui.view.x + a.width / 2) / ui.view.zoom, y: (a.top - b.top - ui.view.y + a.height / 2) / ui.view.zoom }; }
function drawWires(graph) {
  wireLayer.innerHTML = ""; graph.links.forEach(link => { const a = portCenter(`[data-port-id="${portId(link.fromNode, "output", link.fromSocket)}"]`), b = portCenter(`[data-port-id="${portId(link.toNode, "input", link.toSocket)}"]`); if (!a || !b) return; const wire = document.createElementNS("http://www.w3.org/2000/svg", "path"); wire.classList.add("wire"); wire.setAttribute("d", path(a.x, a.y, b.x, b.y)); wire.addEventListener("dblclick", () => store.command("DISCONNECT", { link })); wireLayer.append(wire); });
  const pending=ui.pendingWire || ui.disconnectWire;
  if (pending) { const isDisconnect=!!ui.disconnectWire, a = isDisconnect ? portCenter(`[data-port-id="${portId(pending.link.toNode, "input", pending.link.toSocket)}"]`) : portCenter(`[data-port-id="${portId(pending.fromNode, "output", pending.fromSocket)}"]`), cursor=toWorld(pending.x,pending.y); if (a) { const wire = document.createElementNS("http://www.w3.org/2000/svg", "path"); wire.classList.add("wire", "pending"); wire.setAttribute("d", isDisconnect ? path(cursor.x,cursor.y,a.x,a.y) : path(a.x,a.y,cursor.x,cursor.y)); wireLayer.append(wire); } }
}
function validateConstantValue(value, type) {
  const raw=String(value??"").trim(),key=typeKey(type),label=typeLabel(key),count=Number((key.match(/[234]$/)||[])[0]||0),bool=key==="BOOL"||key.startsWith("BVEC"),uint=key==="UINT"||key.startsWith("UVEC"),integer=uint||key==="INT"||key.startsWith("IVEC");
  const validatePart=part=>{if(bool)return /^(true|false)$/i.test(part);if(!Number.isFinite(Number(part)))return false;if(uint)return Number.isInteger(Number(part))&&Number(part)>=0;if(integer)return Number.isInteger(Number(part));return true;};
  if(!count){if(bool)return /^(true|false)$/i.test(raw)?{valid:true,value:raw.toLowerCase()}:{valid:false,message:"bool 常量只能选择 true 或 false。"};return raw!==""&&validatePart(raw)?{valid:true,value:String(Number(raw))}:{valid:false,message:`${label} 常量必须是${integer?uint?"非负整数":"整数":"有效数字"}。`};}
  const parts=raw.split(",").map(item=>item.trim());
  if(parts.length!==count||parts.some(part=>part===""||!validatePart(part))) return {valid:false,message:`${label} 常量必须输入 ${count} 个逗号分隔的${bool?" true/false":"分量"}。`};
  return {valid:true,value:parts.map(part=>bool?part.toLowerCase():String(Number(part))).join(", ")};
}
function normalizedConstantValue(value, type) {
  const current=validateConstantValue(value,type);
  if(current.valid)return current.value;
  const key=typeKey(type);if(key==="BOOL")return "false";
  const count=Number((key.match(/[234]$/)||[])[0]||0);
  if(key.startsWith("BVEC"))return Array(count).fill("false").join(", ");
  const scalar=Number(value);
  if(count&&Number.isFinite(scalar))return Array(count).fill(scalar).join(", ");
  return count?Array(count).fill(0).join(", "):"0";
}
function validateGraphProperties(graph) {
  graph.nodes.forEach(node=>{
    const definition=nodeDef(node);
    Object.entries(node.properties||{}).forEach(([key,value])=>{
      const result=validateNodeProperty(node,definition,key,value);
      if(!result.valid)throw new Error(`节点“${node.title}”的 ${key} 格式无效：${result.message}`);
    });
  });
}
function typedPropertyType(node, definition, key) {
  if(node.typeId==="math.constant"&&key==="value")return definition.outputs[0]?.type==="ANY"?"FLOAT":definition.outputs[0]?.type||"FLOAT";
  if(node.typeId==="io.input"&&key==="defaultValue")return definition.outputs[0]?.type==="ANY"?"FLOAT":definition.outputs[0]?.type||"FLOAT";
  if(node.typeId==="input.time"&&key==="defaultValue")return "FLOAT";
  if(node.typeId==="logic.variable"&&key==="initialValue")return definition.outputs[0]?.type==="ANY"?"FLOAT":definition.outputs[0]?.type||"FLOAT";
  return null;
}
function typedValueProperty(node) {
  if(node.typeId==="math.constant")return "value";
  if(node.typeId==="io.input"||node.typeId==="input.time")return "defaultValue";
  if(node.typeId==="logic.variable")return "initialValue";
  return null;
}
function validateNodeProperty(node, definition, key, value) {
  const typed=typedPropertyType(node,definition,key);
  if(typed)return validateConstantValue(value,typed);
  if(typeof node.properties[key]==="boolean")return String(value)==="true"?{valid:true,value:true}:{valid:true,value:false};
  if(key==="parameterId")return validParameterId(String(value))?{valid:true,value:String(value)}:{valid:false,message:"参数 ID 必须是有效 Java 标识符，不能是关键字。"};
  if(key==="uniform")return /^u_[A-Za-z][A-Za-z0-9_]*$/.test(String(value))?{valid:true,value:String(value)}:{valid:false,message:"Uniform 名称必须以 u_ 开头，并且后续只能使用字母、数字或下划线。"};
  if(["trueWidth","trueHeight","falseWidth","falseHeight","width","height"].includes(key))return Number.isFinite(Number(value))&&Number(value)>0?{valid:true,value:String(Number(value))}:{valid:false,message:"分支区域尺寸必须是大于 0 的数字。"};
  return {valid:true,value:String(value)};
}
function renderInspector(graph) {
  const root = document.querySelector("#inspector-content"), node = graph.nodes.find(n => n.id === ui.selected); if (!node) { root.className = "inspector-empty"; root.textContent = "选择一个节点以编辑它的属性。"; return; }
  if(node.typeId.startsWith("custom.")){openCustomNodeEditor(def(node.typeId),node.id);return;}
  root.className = ""; const d = nodeDef(node); root.innerHTML = `<div class="field"><label>节点名称</label><input id="node-title" value="${escapeHtml(node.title)}" /></div><div class="field"><label>类型</label><div class="readonly">${escapeHtml(node.typeId)}</div></div><section class="node-description"><strong>节点说明</strong><p>${escapeHtml(nodeDescription(d))}</p><div class="node-contract"><span>输入：${escapeHtml(portSummary(d.inputs))}</span><span>输出：${escapeHtml(portSummary(d.outputs))}</span></div></section>`;
  root.querySelector("#node-title").addEventListener("change",event=>store.command("RENAME_NODE",{nodeId:node.id,title:event.target.value}));
  if (def(node.typeId).dynamicKind) {
    const field=document.createElement("div"),isSplit=node.typeId==="vector.split",isCombine=node.typeId==="vector.combine";
    field.className="field";
    const options=isSplit?"<option>AUTO</option><option>VEC2</option><option>VEC3</option><option>VEC4</option>":isCombine?"<option>VEC2</option><option>VEC3</option><option>VEC4</option>":"<option>AUTO</option><option>BOOL</option><option>INT</option><option>UINT</option><option>FLOAT</option><option>VEC2</option><option>VEC3</option><option>VEC4</option>";
    field.innerHTML=`<label>类型变量</label><select>${options}</select><small class="type-hint">${isSplit?"连接输入向量后自动确定类型。":isCombine?"类型决定显示的 Float 输入数量。":"AUTO 会从已连接的具体端口推导；切换为具体类型会移除不兼容连线。"}</small>`;
    const select=field.querySelector("select");
    select.value=node.properties.valueType||"AUTO";
    select.addEventListener("change",event=>{
      const next=event.target.value;
      const typedKey=typedValueProperty(node);
      if(typedKey&&next!=="AUTO") store.command("SET_PROPERTY",{nodeId:node.id,key:typedKey,value:normalizedConstantValue(node.properties[typedKey],next)});
      store.command("SET_PROPERTY",{nodeId:node.id,key:"valueType",value:next});
    });
    root.append(field);
  }
  if(['io.input','input.texture'].includes(node.typeId)){
    const field=document.createElement('div');field.className='field';
    field.innerHTML='<label>参数 ID（生成代码中的名称）</label><input aria-label="参数 ID"><small>字段与构造参数使用此 ID。中文说明可填在节点名称中。</small><small class="constant-error" hidden></small>';
    const input=field.querySelector('input'),error=field.querySelector('.constant-error');input.value=parameterId(node);
    input.onchange=()=>{const value=input.value.trim();if(!validParameterId(value)||(node.properties.scope==='instance'&&value==='transform')){error.textContent='请输入有效且非保留的 Java 参数 ID';error.hidden=false;input.setAttribute('aria-invalid','true');return;}store.command('SET_PROPERTY',{nodeId:node.id,key:'parameterId',value});};root.append(field);
  }
  if(node.typeId==='io.input'){const field=document.createElement('div');field.className='field';field.innerHTML='<label>参数作用域</label><select aria-label="参数作用域"><option value="shared">整批共享</option><option value="instance">每个实例</option></select><small>创建 Plugin 时通过 InstanceParameters 传入；共享值通过 SharedParameters 传入。</small>';field.querySelector('select').value=node.properties.scope||'shared';field.querySelector('select').onchange=e=>store.command('SET_PROPERTY',{nodeId:node.id,key:'scope',value:e.target.value});root.append(field);}
  if(node.typeId==="logic.variable"){const inferred=variableBranchOwner(graph,node),field=document.createElement("div");field.className="field";field.innerHTML=`<label>控制流来源</label><div class="readonly">${inferred?(inferred.branch==="loop"?"FOR 循环体（由 value 输入来源自动推断）":`${inferred.branch.toUpperCase()} 分支（由 value 输入来源自动推断）`):"未连接到 If 或 For 内的节点"}</div><small class="type-hint">init 在控制块前初始化，value 的输入来源决定在哪个 If 分支或 For 循环体内写入。</small>`;root.append(field);}
  if (node.typeId === "input.texture") { const field=document.createElement("div");field.className="field texture-input-field";field.innerHTML=`<label>预览纹理</label><input type="file" accept="image/*"><small>仅用于工作流预览；导出后由构造器传入 SpriteAPI。</small>${node.properties.previewDataUrl?'<img class="texture-source-preview" alt="纹理预览">':''}`;const file=field.querySelector("input");file.addEventListener("change",event=>{const selected=event.target.files?.[0];if(!selected)return;const reader=new FileReader();reader.addEventListener("load",()=>store.command("SET_PROPERTY",{nodeId:node.id,key:"previewDataUrl",value:String(reader.result||"")}));reader.readAsDataURL(selected);});const image=field.querySelector("img");if(image)image.src=node.properties.previewDataUrl;root.append(field); }
  if (d.outputs.length) { const preview=document.createElement("div"); preview.className="field preview-toggle"; preview.innerHTML=`<label><input type="checkbox" ${node.properties.previewEnabled ? "checked" : ""}> 输出预览</label>`; preview.querySelector("input").addEventListener("change",event=>store.command("SET_PROPERTY",{nodeId:node.id,key:"previewEnabled",value:event.target.checked})); root.append(preview); }
  Object.entries(node.properties).filter(([key])=>!['previewEnabled','valueType','previewDataUrl','scope','parameterId'].includes(key)).forEach(([key, value]) => {
    const field=document.createElement("div");
    field.className="field";
    const valueType=typedPropertyType(node,d,key),isTypedValue=!!valueType;
    const vectorHint=isTypedValue&&["VEC2","VEC3","VEC4"].includes(valueType)?`<small class="type-hint">必须输入 ${valueType.slice(-1)} 个逗号分隔的分量。</small>`:"";
    const isBoolean=(isTypedValue&&valueType==="BOOL")||typeof value==="boolean";
    field.innerHTML=isBoolean?`<label>${key}</label><select><option value="false">false</option><option value="true">true</option></select><small class="type-hint">布尔值使用选择框。</small>`:`<label>${key}</label><input value="${value}" />${vectorHint}<small class="constant-error" hidden></small>`;
    const input=field.querySelector("input, select");
    if(isBoolean)input.value=String(value).toLowerCase()==="true"?"true":"false";
    const initialValidation=validateNodeProperty(node,d,key,value),initialError=field.querySelector(".constant-error");
    if(!initialValidation.valid){if(initialError){initialError.textContent=initialValidation.message;initialError.hidden=false;}input.setAttribute("aria-invalid","true");}
    const commit=()=>{
      const result=validateNodeProperty(node,d,key,input.value),error=field.querySelector(".constant-error");
      if(!result.valid){if(error){error.textContent=result.message;error.hidden=false;}input.setAttribute("aria-invalid","true");return;}
      if(error)error.hidden=true;input.removeAttribute("aria-invalid");store.command("SET_PROPERTY",{nodeId:node.id,key,value:result.value});
    };
    // Re-rendering on every keystroke replaces this element and drops its focus.
    input.addEventListener("change",commit);
    input.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();input.blur();}});
    root.append(field);
  });
  const ports = document.createElement("div"); ports.className = "field"; ports.innerHTML = `<label>端口</label><div class="readonly">输入 ${d.inputs.length} · 输出 ${d.outputs.length}</div>`; root.append(ports);
}
function customTypeId(title) { return `custom.${String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"") || "node"}`; }
function customFunctionName(title) { return `wf_custom_${String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^\d/,"_") || "node"}`; }
function customParameters(definition) {
  const existing=definition?.properties?.parameters;
  if(Array.isArray(existing) && existing.length) return existing.map((parameter,index)=>({id:String(parameter.id||`p${index}`),name:String(parameter.name||`value${index}`),type:typeLabel(parameter.type),qualifier:["in","out","inout"].includes(parameter.qualifier)?parameter.qualifier:"in"}));
  // Legacy nodes retain their expression contract until the user saves them in the new editor.
  return null;
}
function customDefinition(title, typeId, parameters, code, helperSource="") {
  const normalized=parameters.map((parameter,index)=>({id:String(parameter.id||`p${index}`),name:String(parameter.name||`value${index}`),type:typeLabel(parameter.type),qualifier:parameter.qualifier}));
  const resolvedTypeId=typeId||customTypeId(title);
  return {typeId:resolvedTypeId,title:title||"Custom Node",category:"自定义 GLSL",inputs:normalized.filter(p=>p.qualifier!=="out").map(p=>({name:p.name,type:p.type})),outputs:normalized.filter(p=>p.qualifier!=="in").map(p=>({name:p.name,type:p.type})),properties:{custom:true,functionName:customFunctionName(resolvedTypeId),parameters:normalized,code:String(code||""),helperSource:String(helperSource||"")}};
}
function typeOptions(selected) { return GLSL_TYPE_OPTIONS.map(type=>`<option value="${typeKey(type)}">${type}</option>`).join(""); }
function updateCustomDefinition(definition) {
  const index=catalog.findIndex(item=>item.typeId===definition.typeId);if(index>=0)catalog[index]=definition;else catalog.push(definition);
  const builtIn=["custom.radialFade","custom.innerFade"].includes(definition.typeId);
  if(builtIn){const overrides=JSON.parse(localStorage.getItem("workflow.customNodeOverrides")||"{}");overrides[definition.typeId]=definition;localStorage.setItem("workflow.customNodeOverrides",JSON.stringify(overrides));}
  else {const list=JSON.parse(localStorage.getItem("workflow.customNodes")||"[]"),existing=list.findIndex(item=>item.typeId===definition.typeId);if(existing>=0)list[existing]=definition;else list.push(definition);localStorage.setItem("workflow.customNodes",JSON.stringify(list));}
}
function openCustomNodeEditor(existing=null,nodeId=null) {
  const root=document.querySelector("#inspector-content"),definition=clone(existing||{});
  const legacy=customParameters(definition)===null;
  const initial=legacy?[...(definition.inputs||[{name:"uv",type:"VEC2"}]).map((port,index)=>({id:`p${index}`,name:port.name,type:typeKey(port.type),qualifier:"in"})),{id:"result",name:(definition.outputs||[{name:"value"}])[0].name||"value",type:typeKey((definition.outputs||[{type:"FLOAT"}])[0].type),qualifier:"out"}]:customParameters(definition);
  const legacyCode=legacy?`// Convert the former expression contract to an out parameter.\n${initial.at(-1).name} = ${String(definition.properties?.expression||"0.0").replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,"$1")};`:String(definition.properties?.code||"");
  root.className="custom-inline-editor";
  root.innerHTML=`<div class="field"><label>节点名称</label><input id="custom-editor-title" value="${escapeHtml(definition.title||"Custom Node")}"></div><section class="custom-parameter-editor"><div class="custom-parameter-heading"><label>函数参数</label><span>名称 · GLSL 类型 · I/O</span></div><div id="custom-parameter-list"></div><button type="button" id="custom-add-parameter" class="small-button">+ 添加参数</button><small class="type-hint">in 生成输入端口；out 生成输出端口；inout 同时生成两个端口。GLSL 的 out/inout 参数必须在函数体中被赋值。</small></section><div class="field"><label>GLSL 函数体</label><textarea id="custom-editor-code" rows="14" spellcheck="false" placeholder="result = ...;">${escapeHtml(legacyCode)}</textarea><small class="type-hint">这里只填写函数体，不需要写函数签名。函数会生成为 void，参数签名由上方列表决定。</small></div><div class="editor-actions"><button class="save-custom">保存节点定义</button>${nodeId?'<button class="delete-custom">删除画布节点</button>':''}</div>`;
  const list=root.querySelector("#custom-parameter-list");
  const addRow=(parameter=null)=>{const index=list.children.length,entry=parameter||{id:id("param"),name:index?`value${index+1}`:"value",type:"float",qualifier:"in"},row=document.createElement("div");row.className="custom-parameter-row";row.dataset.id=entry.id;row.innerHTML=`<input class="custom-param-name" value="${escapeHtml(entry.name)}" aria-label="参数名称"><select class="custom-param-type" aria-label="GLSL 类型">${typeOptions(entry.type)}</select><select class="custom-param-qualifier" aria-label="参数方向"><option value="in">in</option><option value="out">out</option><option value="inout">inout</option></select><button type="button" class="icon-button custom-param-delete" title="删除参数">×</button>`;row.querySelector(".custom-param-type").value=typeKey(entry.type);row.querySelector(".custom-param-qualifier").value=entry.qualifier;row.querySelector(".custom-param-delete").addEventListener("click",()=>row.remove());list.append(row);};
  initial.forEach(addRow);root.querySelector("#custom-add-parameter").addEventListener("click",()=>addRow());
  root.querySelector(".save-custom").addEventListener("click",()=>{const title=root.querySelector("#custom-editor-title").value.trim()||"Custom Node",parameters=[...list.querySelectorAll(".custom-parameter-row")].map(row=>({id:row.dataset.id,name:row.querySelector(".custom-param-name").value.trim(),type:row.querySelector(".custom-param-type").value,qualifier:row.querySelector(".custom-param-qualifier").value})),code=root.querySelector("#custom-editor-code").value.trim(),names=new Set();const valid=parameters.length>0&&parameters.every(parameter=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(parameter.name)&&isSupportedType(parameter.type)&&!names.has(parameter.name)&&(names.add(parameter.name),true));if(!valid||!code){document.querySelector("#footer-message").textContent="自定义节点无效：参数名必须唯一且符合 GLSL 标识符规则，函数体不能为空。";return;}const next=customDefinition(title,definition.typeId,parameters,code,definition.properties?.helperSource||"");updateCustomDefinition(next);const instances=store.graph.nodes.filter(item=>item.typeId===next.typeId);if(nodeId){const node=store.node(nodeId);node.title=title;}if(instances.length){pruneInvalidLinks(store.graph);store.graph.previewRevision=++store.previewRevision;store.graph.revision++;store.emit();}renderCatalog();document.querySelector("#footer-message").textContent=`已保存自定义节点：${title}`;});
  root.querySelector(".delete-custom")?.addEventListener("click",()=>{store.command("REMOVE_NODE",{nodeId});ui.selected=null;});
}
function openContextMenu(event,nodeId=null) { event.preventDefault();if(nodeId&&!ui.selectedNodes.has(nodeId))select(nodeId);ui.contextNodeId=nodeId;ui.contextPastePosition=toWorld(event.clientX,event.clientY);const menu=document.querySelector("#node-context-menu"),selected=[...ui.selectedNodes].map(id=>store.node(id)).filter(Boolean),allPreviewEnabled=selected.length>0&&selected.every(node=>node.properties.previewEnabled),hasSelection=selected.length>0,canPaste=!!ui.clipboard?.nodes?.length;menu.querySelector('[data-action="copy"]').hidden=!hasSelection;menu.querySelector('[data-action="cut"]').hidden=!hasSelection;menu.querySelector('[data-action="paste"]').hidden=!canPaste;menu.querySelector('[data-action="toggle-preview"]').hidden=!hasSelection;menu.querySelector('[data-action="disconnect"]').hidden=!hasSelection;menu.querySelector('[data-action="save-workflow-node"]').hidden=!hasSelection;menu.querySelector('[data-action="delete"]').hidden=!hasSelection;menu.querySelector('[data-action="toggle-preview"]').textContent=allPreviewEnabled?"关闭选中预览":"开启选中预览";menu.querySelector('[data-action="disconnect"]').textContent=selected.length>1?"断开选中节点连线":"断开所有连线";menu.querySelector('[data-action="delete"]').textContent=selected.length>1?"删除选中节点":"删除节点";menu.style.left=`${event.clientX}px`;menu.style.top=`${event.clientY}px`;menu.hidden=false; }
function closeContextMenu(){document.querySelector("#node-context-menu").hidden=true;ui.contextNodeId=null;ui.contextPastePosition=null;}
document.querySelector("#node-context-menu").addEventListener("click",event=>{const action=event.target.dataset.action;if(!action)return;const nodeId=ui.contextNodeId,ids=[...ui.selectedNodes];if(nodeId&&!ids.length)ids.push(nodeId);const graph=store.snapshot(),nodes=graph.nodes.filter(node=>ids.includes(node.id));if(action==="copy")copySelectedNodes();if(action==="cut")cutSelectedNodes();if(action==="paste")pasteClipboard(ui.contextPastePosition||{x:100,y:100});if(action==="delete"){ui.selectedNodes.clear();ui.selected=null;store.removeNodes(ids);}if(action==="disconnect")graph.links.filter(link=>ids.includes(link.fromNode)||ids.includes(link.toNode)).forEach(link=>store.command("DISCONNECT",{link}));if(action==="toggle-preview"){const enabled=nodes.length>0&&nodes.every(node=>node.properties.previewEnabled);ids.forEach(id=>store.command("SET_PROPERTY",{nodeId:id,key:"previewEnabled",value:!enabled}));}if(action==="save-workflow-node")openWorkflowNodeSaveDialog();closeContextMenu();});
window.addEventListener("pointerdown",event=>{if(!event.target.closest("#node-context-menu"))closeContextMenu();});
document.querySelector("#confirm-workflow-node-save").addEventListener("click",event=>{event.preventDefault();const dialog=document.querySelector("#workflow-node-save-dialog"),title=dialog.querySelector("#workflow-node-save-title").value;if(saveSelectionAsWorkflowNode(title))dialog.close();});
function fallback(type) { return type === "BOOL" ? false : type === "ANY" || type === "FLOAT" ? 0 : type === "VEC2" ? [0, 0] : type === "VEC3" ? [0, 0, 0] : [0, 0, 0, 1]; }
function scalar(value) { return Array.isArray(value) ? value[0] : value; }
function vector(value, size) { const source=Array.isArray(value)?value:[value]; return Array.from({length:size},(_,i)=>source[i] ?? source[0] ?? 0); }
function combine(a,b,operator,type) { if(type === "ANY" || type === "FLOAT") return operator(scalar(a),scalar(b)); const size=Number(type.slice(-1)); const av=vector(a,size),bv=vector(b,size); return av.map((x,i)=>operator(x,bv[i])); }
function previewValue(graph, nodeId, socket, uv, memo = new Map(), stack = new Set()) {
  const cacheKey=`${nodeId}:${socket}:${uv[0].toFixed(3)}:${uv[1].toFixed(3)}`; if(memo.has(cacheKey)) return memo.get(cacheKey); if(stack.has(nodeId)) return { value: fallback("FLOAT"), type:"FLOAT" };
  const node=graph.nodes.find(n=>n.id===nodeId), d=node && nodeDef(node); if(!node || !d) return {value:0,type:"FLOAT"}; stack.add(nodeId);
  const input=(name)=>{ const port=d.inputs.find(p=>p.name===name), link=graph.links.find(l=>l.toNode===nodeId&&l.toSocket===name); return link ? previewValue(graph,link.fromNode,link.fromSocket,uv,memo,stack).value : fallback(port?.type||"FLOAT"); };
  let value=fallback(d.outputs[0]?.type||"FLOAT"), type=d.outputs[0]?.type||"FLOAT"; if(type === "ANY") type="FLOAT";
  if(node.typeId === "input.position") value=uv.map((v,i)=>(v-.5)*(i?180:360));
  else if(node.typeId === "input.uv") value=uv;
  else if(node.typeId === "input.time" || node.typeId === "io.input") value=Number(node.properties.defaultValue ?? 0) || 0;
  else if(node.typeId === "math.constant") {
    if(node.properties.valueType==="BOOL"||d.outputs[0]?.type==="BOOL") value=String(node.properties.value).toLowerCase()==="true";
    else {
      const values=String(node.properties.value??.5).split(/[\s,]+/).filter(Boolean).map(Number).map(value=>Number.isFinite(value)?value:0);
      const count={VEC2:2,VEC3:3,VEC4:4}[d.outputs[0]?.type];
      value=count?vector(values,count):values[0]??0;
    }
  }
  else if(node.typeId === "logic.equal") { value=JSON.stringify(input("a"))===JSON.stringify(input("b"));type="BOOL"; }
  else if(node.typeId === "logic.notEqual") { value=JSON.stringify(input("a"))!==JSON.stringify(input("b"));type="BOOL"; }
  else if(["logic.greater","logic.greaterEqual","logic.less","logic.lessEqual"].includes(node.typeId)){const a=scalar(input("a")),b=scalar(input("b"));value=node.typeId==="logic.greater"?a>b:node.typeId==="logic.greaterEqual"?a>=b:node.typeId==="logic.less"?a<b:a<=b;type="BOOL";}
  else if(node.typeId === "logic.and") { value=!!input("a")&&!!input("b");type="BOOL"; }
  else if(node.typeId === "logic.or") { value=!!input("a")||!!input("b");type="BOOL"; }
  else if(node.typeId === "logic.not") { value=!input("value");type="BOOL"; }
  else if(node.typeId === "logic.variable") { value=input("value");type=d.outputs[0]?.type||"FLOAT"; }
  else if(node.typeId === "io.input") value=0.5;
  else if(node.typeId === "vector.combine") { const vectorType=node.properties.valueType||"VEC2",count={VEC2:2,VEC3:3,VEC4:4}[vectorType]||2;value=["x","y","z","w"].slice(0,count).map(input).map(scalar);type=vectorType; }
  else if(node.typeId === "vector.split") { const vectorType=node.properties.valueType||"VEC2",count={VEC2:2,VEC3:3,VEC4:4}[vectorType]||2,index=({x:0,y:1,z:2,w:3})[socket]??0;value=vector(input("value"),count)[index]??0;type="FLOAT"; }
  else if(node.typeId === "vector.scale") { const vectorType=d.outputs[0]?.type||"VEC2",count={VEC2:2,VEC3:3,VEC4:4}[vectorType]||2,p=vector(input("value"),count),s=scalar(input("scale")); value=p.map(component=>component*s); type=vectorType; }
  else if(node.typeId === "vector.center") value=vector(input("uv"),2).map(x=>x-.5);
  else if(node.typeId === "vector.length") { const vectorType=d.inputs[0]?.type||"VEC2",count={VEC2:2,VEC3:3,VEC4:4}[vectorType]||2,p=vector(input("value"),count); value=Math.hypot(...p); type="FLOAT"; }
  else if(node.typeId === "vector.normalize") { const p=vector(input("value"),2),l=Math.hypot(p[0],p[1])||1; value=[p[0]/l,p[1]/l]; }
  else if(node.typeId === "noise.value" || node.typeId === "noise.fbm" || node.typeId === "noise.perlin") { const p=vector(input("uv"),2); const n=Math.sin(p[0]*127.1+p[1]*311.7)*43758.5453; value=n-Math.floor(n); type="FLOAT"; }
  else if(node.typeId === "noise.turbulize") { value=Math.abs(scalar(input("noise")));type="FLOAT"; }
  else if(node.typeId.includes("add")) value=combine(input("a"),input("b"),(a,b)=>a+b,type);
  else if(node.typeId.includes("subtract")) value=combine(input("a"),input("b"),(a,b)=>a-b,type);
  else if(node.typeId.includes("multiply")) value=combine(input("a"),input("b"),(a,b)=>a*b,type);
  else if(node.typeId.includes("divide")) value=combine(input("a"),input("b"),(a,b)=>a/(Math.abs(b)<.0001?.0001:b),type);
  else if(node.typeId.includes("clamp")) { const min=input("min"),max=input("max"); value=combine(input("value"),min,(a,b)=>Math.min(Math.max(a,b),scalar(max)),type); }
  else if(node.typeId === "math.pow") value=Math.pow(Math.max(0,scalar(input("base"))),scalar(input("exponent")));
  else if(node.typeId.includes("sin")) value=Math.sin(scalar(input("x")));
  else if(node.typeId.includes("cos")) value=Math.cos(scalar(input("x")));
  else if(node.typeId === "math.atan") value=Math.atan2(scalar(input("y")),scalar(input("x")));
  else if(node.typeId === "math.tan") value=Math.tan(scalar(input("x")));
  else if(node.typeId === "math.asin") value=Math.asin(Math.max(-1,Math.min(1,scalar(input("x")))));
  else if(node.typeId === "math.acos") value=Math.acos(Math.max(-1,Math.min(1,scalar(input("x")))));
  else if(node.typeId === "math.exp") value=Math.exp(scalar(input("x")));
  else if(node.typeId === "math.log") value=Math.log(Math.max(.0001,scalar(input("x"))));
  else if(node.typeId === "math.sqrt") value=Math.sqrt(Math.max(0,scalar(input("x"))));
  else if(node.typeId === "math.sign") value=Math.sign(scalar(input("x")));
  else if(node.typeId === "math.ceil") value=Math.ceil(scalar(input("x")));
  else if(node.typeId === "math.step") value=scalar(input("x")) < scalar(input("edge")) ? 0 : 1;
  else if(node.typeId === "math.mod") value=scalar(input("x")) % Math.max(.0001,scalar(input("y")));
  else if(node.typeId === "math.radians") value=scalar(input("degrees"))*Math.PI/180;
  else if(node.typeId === "math.degrees") value=scalar(input("radians"))*180/Math.PI;
  else if(node.typeId === "vector.distance2") { const a=vector(input("a"),2),b=vector(input("b"),2); value=Math.hypot(a[0]-b[0],a[1]-b[1]); type="FLOAT"; }
  else if(node.typeId === "vector.rotate2d") { const p=vector(input("value"),2),a=scalar(input("angle")),c=Math.cos(a),s=Math.sin(a); value=[c*p[0]-s*p[1],s*p[0]+c*p[1]]; type="VEC2"; }
  else if(node.typeId === "custom.radialFade") { const dist=scalar(input("distance")); value=Math.max(0,Math.min(1,(1-dist)/.5)); type="FLOAT"; }
  else if(node.typeId === "custom.innerFade") { const dist=scalar(input("distance")),time=scalar(input("time")),edge0=.25+.025*Math.sin(time*3),edge1=.5+.025*Math.sin(time*3),t=Math.max(0,Math.min(1,(dist-edge0)/(edge1-edge0))); value=t*t*(3-2*t); type="FLOAT"; }
  else if(node.typeId === "noise.turbulence3") { const p=[scalar(input("x")),scalar(input("y")),scalar(input("z"))]; let valueSum=0,amplitude=1,frequency=1; for(let octave=0;octave<6;octave++){const n=Math.sin((p[0]*frequency)*12.9898+(p[1]*frequency)*78.233+(p[2]*frequency)*37.719)*43758.5453;valueSum+=amplitude*Math.abs((n-Math.floor(n))*2-1);amplitude*=.5;frequency*=2;} value=Math.sqrt(Math.max(0,valueSum*.5));type="FLOAT"; }
  else if(node.typeId === "sdf.circle") { value=Math.hypot(...vector(input("point"),2))-scalar(input("radius")); type="FLOAT"; }
  else if(node.typeId === "sdf.segment") { const p=vector(input("point"),2),a=vector(input("a"),2),b=vector(input("b"),2),ba=[b[0]-a[0],b[1]-a[1]],pa=[p[0]-a[0],p[1]-a[1]],h=Math.max(0,Math.min(1,(pa[0]*ba[0]+pa[1]*ba[1])/Math.max(.0001,ba[0]*ba[0]+ba[1]*ba[1]))); value=Math.hypot(pa[0]-ba[0]*h,pa[1]-ba[1]*h); type="FLOAT"; }
  else if(node.typeId === "io.output") { value=input("color"); type="VEC4"; }
  stack.delete(nodeId); const result={value,type}; memo.set(cacheKey,result); return result;
}
// Preview is deliberately shader-driven.  The former CPU approximation could not execute user GLSL
// and used a different turbulence function, which erased the spiral structure from the noise preview.
function textureSampleName(uniform) { return `sampleTexture_${javaIdentifier(uniform, "texture")}`; }
function textureAspectUniformName(uniform) { return `u_textureAspect_${javaIdentifier(uniform, "texture")}`; }
function previewColorExpression(type, expression) {
  const key=typeKey(type);
  if (key === "SAMPLER2D") return `${textureSampleName(expression)}(${expression}, v_uv)`;
  if (key === "VEC4") return expression;
  if (key === "VEC3") return `vec4(${expression}, 1.0)`;
  if (key === "VEC2") return `vec4(${expression} * 0.5 + 0.5, 0.5, 1.0)`;
  if (key === "BOOL") return `vec4(vec3(${expression} ? 1.0 : 0.0), 1.0)`;
  if (key.startsWith("BVEC")) return `vec4(vec3(any(${expression}) ? 1.0 : 0.0), 1.0)`;
  return `vec4(vec3(${expression}), 1.0)`;
}
function textureSamplingFunctions(graph) {
  return graphTextureInputs(graph).map(input => {
    const name=textureSampleName(input.name), aspect=textureAspectUniformName(input.name);
    return `uniform vec2 ${aspect};
vec4 ${name}(sampler2D source, vec2 uv) {
    float ratio = max(${aspect}.x / max(${aspect}.y, 1.0), 0.0001);
    vec2 scale = ratio >= 1.0 ? vec2(1.0, ratio) : vec2(1.0 / ratio, 1.0);
    vec2 textureUv = (uv - vec2(0.5)) * scale + vec2(0.5);
    if (any(lessThan(textureUv, vec2(0.0))) || any(greaterThan(textureUv, vec2(1.0)))) return vec4(0.0);
    return texture(source, textureUv);
}`;
  }).join("\n\n");
}
function previewExpressionFor(graph, nodeId, socket) {
  return expressionFor(graph,nodeId,socket).replace(/\btexture\(\s*(u_[A-Za-z0-9_]+)\s*,/g, (_, uniform) => `${textureSampleName(uniform)}(${uniform},`);
}
function upstreamCustomHelpers(graph, nodeId, seen = new Set(), helpers = []) {
  if (seen.has(nodeId)) return helpers;
  seen.add(nodeId);
  const node=graph.nodes.find(item=>item.id===nodeId), definition=node&&nodeDef(node);
  if (!node || !definition) return helpers;
  graph.links.filter(link=>link.toNode===nodeId).forEach(link=>upstreamCustomHelpers(graph,link.fromNode,seen,helpers));
  const helper=definition.properties?.helperSource;
  if (node.typeId.startsWith("custom.") && helper && !helpers.includes(helper)) helpers.push(helper);
  return helpers;
}
function previewLoopIndexDeclarations(graph,node) {
  const loop=node.typeId==="logic.for"?node:branchOwner(graph,node);
  return loop?.typeId==="logic.for" ? `    int wf_loop_i_${javaIdentifier(loop.id)} = 0;` : "";
}
function previewFragmentSource(graph, node, output) {
  const definition=nodeDef(node),compiled=compileGraphExpression(graph,node,output.name),expression=compiled.expression;
  const uniforms=graphInputs(graph).map(input=>`uniform ${glslType(input.type)} ${input.name};`).join("\n");
  const textures=graphTextureInputs(graph).map(input=>`uniform sampler2D ${input.name};`).join("\n");
  return `#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
${uniforms}
${textures}
${textureSamplingFunctions(graph)}
${shaderLibrary()}
${customHelpers(graph)}
void main() {
    vec2 a_position=(v_uv-0.5)*vec2(360.0,180.0);
${compiled.statements.join("\n")}
    fragColor = ${previewColorExpression(output.type === "ANY" ? "FLOAT" : output.type, expression)};
}`;
}
function compilePreviewProgram(gl,source,vertexSource=null){
  const shaders=[];let program=null;
  const compile=(type,code)=>{const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'GLSL 编译失败');return shader;};
  try{
    const vertex=compile(gl.VERTEX_SHADER,vertexSource||`#version 300 es
in vec2 position;
out vec2 v_uv;
void main(){v_uv=position*0.5+0.5;gl_Position=vec4(position,0.0,1.0);}`);
    const fragment=compile(gl.FRAGMENT_SHADER,source);program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'GLSL 链接失败');
    return program;
  }catch(error){if(program)gl.deleteProgram(program);throw error;}finally{shaders.forEach(shader=>gl.deleteShader(shader));}
}
// One shared offscreen WebGL context prevents browser context eviction when a large graph has
// dozens of visible preview nodes.  Finished GPU frames are copied to ordinary 2D canvases.
const previewRenderer = (() => {
  const surface=document.createElement("canvas");surface.width=112;surface.height=112;
  const gl=surface.getContext("webgl2",{preserveDrawingBuffer:true,antialias:false,alpha:true,premultipliedAlpha:false});
  if(!gl) return null;
  const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  return {surface,gl,quad,textures:new Map(),programs:new Map(),revision:-1};
})();
function clearPreviewPrograms(){if(!previewRenderer)return;previewRenderer.programs.forEach(program=>previewRenderer.gl.deleteProgram(program));previewRenderer.programs.clear();}
function cachedPreviewProgram(gl,key,source){let program=previewRenderer.programs.get(key);if(!program){program=compilePreviewProgram(gl,source);previewRenderer.programs.set(key,program);}return program;}
function previewTexture(gl, textureNode) { const key=textureNode.id,dataUrl=textureNode.properties.previewDataUrl||"",cache=previewRenderer.textures.get(key);if(cache?.dataUrl===dataUrl)return cache;const texture=cache?.texture||gl.createTexture(),entry={texture,dataUrl,width:1,height:1};gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));previewRenderer.textures.set(key,entry);if(dataUrl){const image=new Image();image.onload=()=>{entry.width=image.naturalWidth||image.width||1;entry.height=image.naturalHeight||image.height||1;gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);drawNodePreviews(store.snapshot());};image.src=dataUrl;}return entry;}
function drawNodePreviews(graph) {
  if(previewRenderer&&previewRenderer.revision!==graph.previewRevision){clearPreviewPrograms();previewRenderer.revision=graph.previewRevision;}
  graph.nodes.forEach(node=>{
    const canvas=document.querySelector(`.workflow-node[data-id="${node.id}"] .node-preview`),definition=nodeDef(node);
    if(!canvas || !definition.outputs.length) return;
    if(!previewRenderer) { canvas.title="当前浏览器不支持 WebGL2 节点预览"; return; }
    const {gl,quad,surface}=previewRenderer;
    const resolution=previewResolution(),width=resolution.width,height=resolution.height;
    if(surface.width!==width||surface.height!==height){surface.width=width;surface.height=height;}
    let program=null;
    try {
      program=cachedPreviewProgram(gl,`${node.id}:${definition.outputs[0].name}`,previewFragmentSource(graph,node,definition.outputs[0]));
      gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,quad);
      const location=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
      const time=previewTimeValue(graph);
      const timeLocation=gl.getUniformLocation(program,"u_time");if(timeLocation!==null)gl.uniform1f(timeLocation,time);
      graphInputs(graph).forEach(input=>uploadPreviewParameter(gl,program,input));
      graphTextureInputs(graph).forEach((input,index)=>{const textureNode=graph.nodes.find(item=>item.id===input.nodeId),location=gl.getUniformLocation(program,input.name),texture=previewTexture(gl,textureNode),aspectLocation=gl.getUniformLocation(program,textureAspectUniformName(input.name));gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture.texture);if(location)gl.uniform1i(location,index);if(aspectLocation)gl.uniform2f(aspectLocation,texture.width,texture.height);});
      gl.viewport(0,0,surface.width,surface.height);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      const context=canvas.getContext("2d"),scale=Math.min(canvas.width/surface.width,canvas.height/surface.height),drawWidth=surface.width*scale,drawHeight=surface.height*scale;
      context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(surface,(canvas.width-drawWidth)/2,(canvas.height-drawHeight)/2,drawWidth,drawHeight);canvas.title=`GPU 节点预览：${width} × ${height}，图修改时重新渲染`;
    } catch (error) {
      const context=canvas.getContext("2d");context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle="#331a23";context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle="#ffb2bf";context.font="10px sans-serif";context.fillText("GLSL 预览失败",8,20);canvas.title=String(error.message||error);
    } finally { /* Cached programs are released only when the graph preview revision changes. */ }
  });
}
function scheduleTimePreviews(){if(previewClock.animationFrame)return;const tick=now=>{previewClock.animationFrame=0;const graph=store.snapshot();if(!previewClock.enabled||!timePreviewNode(graph))return;if(now-previewClock.lastFrameAt>=83){previewClock.lastFrameAt=now;drawNodePreviews(graph);}previewClock.animationFrame=requestAnimationFrame(tick);};previewClock.animationFrame=requestAnimationFrame(tick);}
shell.addEventListener("dragover", e => e.preventDefault()); shell.addEventListener("drop", e => { e.preventDefault(); const p=toWorld(e.clientX,e.clientY),workflowNodeId=e.dataTransfer.getData("workflow-node-id"),type=e.dataTransfer.getData("node-type");if(workflowNodeId)addWorkflowNode(workflowNodeId,p.x,p.y);else if(type)addNode(type,p.x,p.y); });
shell.addEventListener("contextmenu",e=>{if(e.target.closest(".workflow-node, .if-branches, .for-branch, #node-context-menu"))return;openContextMenu(e);});
shell.addEventListener("pointerdown", e => { if ((e.button !== 0 && e.button !== 1) || (e.target !== shell && e.target !== graphTransform && e.target !== nodeLayer && e.target !== wireLayer)) return; e.preventDefault();if(e.button===0&&e.shiftKey){const start=toWorld(e.clientX,e.clientY),box=document.createElement("div");box.className="selection-box";graphTransform.append(box);ui.selectionBox={start,box};return;}if(e.button===0)ui.backgroundPointer={x:e.clientX,y:e.clientY};ui.view.pan={x:e.clientX,y:e.clientY,startX:ui.view.x,startY:ui.view.y};shell.classList.add("panning"); });
shell.addEventListener("wheel", e => { e.preventDefault(); const before=toWorld(e.clientX,e.clientY), factor=e.deltaY<0?1.12:1/1.12; ui.view.zoom=Math.max(.35,Math.min(1.8,ui.view.zoom*factor)); const rect=shell.getBoundingClientRect();ui.view.x=e.clientX-rect.left-before.x*ui.view.zoom;ui.view.y=e.clientY-rect.top-before.y*ui.view.zoom;updateView(); },{passive:false});
shell.addEventListener("dblclick", e => { if (e.target !== shell && e.target !== graphTransform) return; const p=toWorld(e.clientX,e.clientY); addNode("math.constant",p.x,p.y); });
window.addEventListener("pointermove", e => { if(ui.selectionBox){const end=toWorld(e.clientX,e.clientY),start=ui.selectionBox.start,left=Math.min(start.x,end.x),top=Math.min(start.y,end.y);Object.assign(ui.selectionBox.box.style,{left:`${left}px`,top:`${top}px`,width:`${Math.abs(end.x-start.x)}px`,height:`${Math.abs(end.y-start.y)}px`});return;}if (ui.view.pan) { ui.view.x=ui.view.pan.startX+e.clientX-ui.view.pan.x;ui.view.y=ui.view.pan.startY+e.clientY-ui.view.pan.y;updateView();return; } if (ui.drag) { const dx = (e.clientX - ui.drag.x)/ui.view.zoom, dy = (e.clientY - ui.drag.y)/ui.view.zoom;store.moveNodes(ui.drag.nodes.map(item=>({id:item.id,x:item.startX+dx,y:item.startY+dy})),false); } const pending=ui.pendingWire||ui.disconnectWire; if (pending) { pending.x = e.clientX; pending.y = e.clientY; drawWires(store.snapshot()); } });
window.addEventListener("pointerup", e => { if(ui.selectionBox){const end=toWorld(e.clientX,e.clientY),start=ui.selectionBox.start,left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);ui.selectionBox.box.remove();ui.selectionBox=null;ui.selectedNodes.clear();store.snapshot().nodes.forEach(node=>{if(node.canvasX<right&&node.canvasX+206>left&&node.canvasY<bottom&&node.canvasY+150>top)ui.selectedNodes.add(node.id);});ui.selected=[...ui.selectedNodes][0]||null;renderGraph(store.snapshot());renderInspector(store.snapshot());return;}if(ui.view.pan){const backgroundPointer=ui.backgroundPointer;ui.view.pan=null;ui.backgroundPointer=null;shell.classList.remove("panning");if(backgroundPointer&&Math.hypot(e.clientX-backgroundPointer.x,e.clientY-backgroundPointer.y)<4){ui.selectedNodes.clear();ui.selected=null;renderGraph(store.snapshot());renderInspector(store.snapshot());}return;} ui.drag = null; const target = document.elementFromPoint(e.clientX, e.clientY); if(ui.disconnectWire){const link=ui.disconnectWire.link;store.command("DISCONNECT",{link});ui.disconnectWire=null;clearCompatible();return;} if (!ui.pendingWire) return; if (target?.classList.contains("port") && target.dataset.direction === "input" && compatible(ui.pendingWire.type,target.dataset.valueType)) store.command("CONNECT", { link: { fromNode: ui.pendingWire.fromNode, fromSocket: ui.pendingWire.fromSocket, toNode: target.dataset.nodeId, toSocket: target.dataset.socket } }); ui.pendingWire = null; clearCompatible(); drawWires(store.snapshot()); });
window.addEventListener("keydown", e => { const editing=["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)||document.activeElement.isContentEditable;if(editing)return;const modifier=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();if(modifier&&key==="c"){e.preventDefault();copySelectedNodes();return;}if(modifier&&key==="x"){e.preventDefault();cutSelectedNodes();return;}if(modifier&&key==="v"){e.preventDefault();const p=ui.contextPastePosition||toWorld(shell.getBoundingClientRect().left+shell.clientWidth/2,shell.getBoundingClientRect().top+shell.clientHeight/2);pasteClipboard(p);return;}if(modifier&&key==="z"){e.preventDefault();const changed=e.shiftKey?store.redo():store.undo();if(changed){ui.selectedNodes.clear();ui.selected=null;document.querySelector("#footer-message").textContent=e.shiftKey?"已恢复操作":"已撤销操作";}return;}if(modifier&&key==="y"){e.preventDefault();if(store.redo()){ui.selectedNodes.clear();ui.selected=null;document.querySelector("#footer-message").textContent="已恢复操作";}return;}if (e.key === "Delete" && ui.selectedNodes.size) { e.preventDefault();const ids=[...ui.selectedNodes];ui.selectedNodes.clear();ui.selected=null;store.removeNodes(ids);renderInspector(store.snapshot()); } });
function projectConfig(){try{const raw=sessionStorage.getItem("workflow.projectConfig")||localStorage.getItem("workflow.projectConfig")||'{"id":"default","title":"Untitled Workflow","className":"GeneratedCombatLayerPlugin","shaderDir":"data/shaders/generated","previewWidth":1024,"previewHeight":1024}';if(!sessionStorage.getItem("workflow.projectConfig"))sessionStorage.setItem("workflow.projectConfig",raw);const config=JSON.parse(raw),resolution=previewResolution(config);return {...config,previewWidth:resolution.width,previewHeight:resolution.height};}catch(_){return {id:"default",title:"Untitled Workflow",className:"GeneratedCombatLayerPlugin",shaderDir:"data/shaders/generated",previewWidth:1024,previewHeight:1024};}}
function loadCurrentGraph(){if(activeStage==="vertex")return currentVertexTransform().graph;try { const raw=sessionStorage.getItem("workflow.graph")||localStorage.getItem("workflow.graph")||"null";if(!sessionStorage.getItem("workflow.graph")&&raw!=="null")sessionStorage.setItem("workflow.graph",raw);const graph=JSON.parse(raw); return graph?.nodes && graph?.links ? graph : starterGraph(); } catch (_) { return starterGraph(); }}
function validateImportedWorkflow(value){
  if(!value||typeof value!=="object")throw new Error("根对象必须是 JSON 对象");
  if(Number(value.schemaVersion)!==1)throw new Error("schemaVersion 必须为 1");
  if(!value.project||typeof value.project!=="object")throw new Error("缺少 project 对象");
  const graph=value.graph;
  if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.links))throw new Error("graph 必须包含 nodes 和 links 数组");
  validateStageGraph(graph,"fragment");
  const transform=normalizeTransform(value.vertexTransform||defaultVertexTransform());
  transform.graph=migrateVertexGraph(transform.graph,graph);validateStageGraph(transform.graph,"vertex");
  return {schemaVersion:1,project:bridgeProjectConfig(value.project,{...newWorkflowConfig(),title:"Imported Workflow"}),graph:clone(graph),vertexTransform:transform};
}
function validateStageGraph(graph,stage){
  if(!Array.isArray(graph.nodes)||!Array.isArray(graph.links))throw new Error("工作流必须包含 nodes 与 links");
  migrateBranchMetadata(graph);
  const ids=new Set(),types=new Set(catalog.filter(n=>supportsStage(n.typeId,stage)).map(node=>node.typeId));
  graph.nodes.forEach(node=>{
    if(!node.id||ids.has(node.id))throw new Error(`节点 ID 重复或为空：${node.id||"<empty>"}`);
    if(!types.has(node.typeId))throw new Error(`未知节点类型：${node.typeId}`);
    if(!Number.isFinite(Number(node.canvasX))||!Number.isFinite(Number(node.canvasY)))throw new Error(`节点坐标无效：${node.id}`);
    node.properties ||= {};ids.add(node.id);
  });
  const destinations=new Set();
  graph.links.forEach(link=>{
    const destination=JSON.stringify([link.toNode,link.toSocket]);if(destinations.has(destination))throw new Error("同一输入端口存在重复连线");destinations.add(destination);
    const from=graph.nodes.find(node=>node.id===link.fromNode),to=graph.nodes.find(node=>node.id===link.toNode);
    if(!from||!to||!link.fromSocket||!link.toSocket)throw new Error("存在指向未知节点或端口不完整的连线");
    const fromPort=nodeDef(from)?.outputs.find(port=>port.name===link.fromSocket),toPort=nodeDef(to)?.inputs.find(port=>port.name===link.toSocket);
    if(!fromPort||!toPort)throw new Error(`连线引用了不存在的端口：${link.fromNode}.${link.fromSocket} -> ${link.toNode}.${link.toSocket}`);
    if(!compatible(fromPort.type,toPort.type))throw new Error(`连线类型不匹配：${typeLabel(fromPort.type)} 不能连接到 ${typeLabel(toPort.type)}`);
    if(isInvalidBranchConnection(graph,link))throw new Error("分支内部的输出只能连接同一分支节点，或通过变量节点带出。");
  });
  return graph;
}
function importWorkflowFile(file){const status=document.querySelector("#import-status");file.text().then(text=>{const imported=validateImportedWorkflow(JSON.parse(text));openWorkflow(imported.project,imported.graph,false,imported.vertexTransform);saveWorkflow();status.textContent=`导入成功：${imported.project.title}（${imported.graph.nodes.length} 节点，${imported.graph.links.length} 连线）`;document.querySelector("#footer-message").textContent=`已导入工作流：${imported.project.title}`;}).catch(error=>{status.textContent=`导入失败：${error.message||error}`;});}
function persistCurrentGraph(){persistActiveGraph(store.snapshot());}
function defaultVertexTransform(){return {vertices:[[-180,-90],[180,-90],[-180,90],[180,90]],tx:0,ty:0,sx:1,sy:1,rotation:0};}
function currentVertexTransform(){const t=normalizeTransform(JSON.parse(sessionStorage.getItem("workflow.vertexTransform")||"null")||defaultVertexTransform());t.graph=migrateVertexGraph(t.graph,currentFragmentGraph());return t;}
function currentFragmentGraph(){const raw=sessionStorage.getItem('workflow.graph')||localStorage.getItem('workflow.graph');return raw?JSON.parse(raw):starterGraph();}
function stageStarterGraph(){return activeStage==='vertex'?migrateVertexGraph(normalizeTransform().graph):starterGraph();}
function persistActiveGraph(graph){if(activeStage==='fragment')sessionStorage.setItem('workflow.graph',JSON.stringify(graph));else{const t=currentVertexTransform();t.graph=graph;sessionStorage.setItem('workflow.vertexTransform',JSON.stringify(t));}}
function switchStage(stage){
  if(!stages[stage]||stage===activeStage)return;
  persistActiveGraph(store.snapshot());
  stageHistory.set(activeStage,{undo:store.undoStack,redo:store.redoStack,selected:[...ui.selectedNodes],view:{x:ui.view.x,y:ui.view.y,zoom:ui.view.zoom}});
  activeStage=stage;const saved=stageHistory.get(stage);
  ui.selectedNodes=new Set(saved?.selected||[]);ui.selected=[...ui.selectedNodes][0]||null;ui.pendingWire=null;ui.disconnectWire=null;ui.drag=null;ui.contextPastePosition=null;
  Object.assign(ui.view,saved?.view||{x:0,y:0,zoom:1}, {pan:null});
  store.graph=loadCurrentGraph();store.undoStack=saved?.undo||[];store.redoStack=saved?.redo||[];store.graph.previewRevision=++store.previewRevision;
  const url=new URL(location.href);url.searchParams.set('stage',stage);history.replaceState(null,'',url);
  updateStageUI();updateView();store.emit();
}
function updateStageUI(){document.title=stages[activeStage].title+' · Workflow Shader';document.body.dataset.stage=activeStage;document.querySelectorAll('a[data-stage]').forEach(a=>a.classList.toggle('active',a.dataset.stage===activeStage));document.querySelector('#vertex-settings').hidden=activeStage!=='vertex';renderCatalog(document.querySelector('#node-search').value);}

function workflowLibrary(){try{return JSON.parse(localStorage.getItem("workflow.library")||"[]");}catch(_){return[];}}
function newWorkflowConfig(){return {id:`workflow_${Date.now()}`,title:"Untitled Workflow",className:"GeneratedCombatLayerPlugin",shaderDir:"data/shaders/generated",previewWidth:1024,previewHeight:1024};}
function persistCurrentWorkflow(silent=true){const config=projectConfig(),id=String(config.id||"");if(!id)return;const library=workflowLibrary(),index=library.findIndex(item=>item.id===id);if(index<0)return;library[index]={id,config:clone(config),graph:currentFragmentGraph(),vertexTransform:currentVertexTransform()};localStorage.setItem("workflow.library",JSON.stringify(library));persistCurrentGraph();if(!silent){renderWorkflowLibrary();document.querySelector("#footer-message").textContent=`已保存：${config.title}`;}}
// Opening must be read-only against the workflow library.  Persisting the outgoing in-memory
// draft here used to overwrite a saved entry while the user was trying to load it.
function openWorkflow(config,graph,closeDialog=true,vertexTransform=null){const nextConfig=clone(config),nextGraph=clone(graph),transform=normalizeTransform(vertexTransform||defaultVertexTransform());transform.graph=migrateVertexGraph(transform.graph,nextGraph);stageHistory.clear();sessionStorage.setItem("workflow.projectConfig",JSON.stringify(nextConfig));sessionStorage.setItem("workflow.vertexTransform",JSON.stringify(transform));localStorage.setItem("workflow.vertexTransform",JSON.stringify(transform));sessionStorage.setItem("workflow.graph",JSON.stringify(nextGraph));ui.selected=null;ui.selectedNodes.clear();Object.assign(ui.view,{x:0,y:0,zoom:1});store.reset(activeStage==="vertex"?transform.graph:nextGraph);updateView();if(closeDialog)document.querySelector("#workflow-dialog").close();renderWorkflowLibrary();}
function loadMingGodExample(closeDialog=true){const config={id:`workflow_${Date.now()}`,title:"明神印记旋涡",className:"Meng_MingGodSignPlugin",shaderDir:"data/shaders/meng",previewWidth:1024,previewHeight:1024};openWorkflow(config,mingGodSignGraph(),closeDialog);saveWorkflow();document.querySelector("#footer-message").textContent="已创建并保存工作流：明神印记旋涡";}
async function loadInstanceExample(){try{const response=await fetch('./examples/instanced-wave.workflow.json');if(!response.ok)throw new Error('示例加载失败');const value=validateImportedWorkflow(await response.json());value.project.id='instance_'+Date.now();openWorkflow(value.project,value.graph,true,value.vertexTransform);saveWorkflow();}catch(error){document.querySelector('#footer-message').textContent=error.message;}}
function renderWorkflowLibrary(){
  const root=document.querySelector("#saved-workflows"),examples=document.querySelector("#example-workflows");if(!root)return;
  const library=workflowLibrary(),activeId=projectConfig().id;root.innerHTML=library.length?"":"<p class=\"readonly\">暂无保存的工作流。</p>";
  library.forEach(item=>{const row=document.createElement("div");row.className=`saved-workflow${item.id===activeId?" active":""}`;row.innerHTML=`<span class="saved-workflow-title">${item.config.title}<small>${item.config.shaderDir}</small></span><button data-open="${item.id}">打开</button><button data-delete="${item.id}" class="delete-workflow">删除</button>`;row.querySelector("[data-open]").addEventListener("click",()=>openWorkflow(item.config,item.graph,true,item.vertexTransform));row.querySelector("[data-delete]").addEventListener("click",()=>{const remaining=workflowLibrary().filter(entry=>entry.id!==item.id);localStorage.setItem("workflow.library",JSON.stringify(remaining));if(item.id===projectConfig().id){const config=newWorkflowConfig();openWorkflow(config,starterGraph(),false);}renderWorkflowLibrary();});root.append(row);});
  if(examples){examples.innerHTML="";const row=document.createElement("div");row.className="saved-workflow";row.innerHTML='<span class="saved-workflow-title">明神印记旋涡<small>Meng_MingGodSignPlugin</small></span><button data-open-example>载入</button>';row.querySelector("[data-open-example]").addEventListener("click",()=>loadMingGodExample());examples.append(row);}
  if(examples){const row=document.createElement('div');row.className='saved-workflow';row.innerHTML='<span class="saved-workflow-title">实例波动四边形<small>顶点波动 + 独立实例颜色与波幅</small></span><button id="open-instance-example">创建</button>';row.querySelector('button').onclick=loadInstanceExample;examples.append(row);}
}
function saveWorkflow(){persistCurrentGraph();const config=projectConfig(),graph=currentFragmentGraph(),vertexTransform=currentVertexTransform(),id=config.id||`workflow_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;config.id=id;sessionStorage.setItem("workflow.projectConfig",JSON.stringify(config));sessionStorage.setItem("workflow.graph",JSON.stringify(graph));localStorage.setItem("workflow.vertexTransform",JSON.stringify(vertexTransform));const library=workflowLibrary().filter(item=>item.id!==id);library.push({id,config:clone(config),graph:clone(graph),vertexTransform:clone(vertexTransform)});localStorage.setItem("workflow.library",JSON.stringify(library));renderWorkflowLibrary();document.querySelector("#footer-message").textContent=`已保存：${config.title}`;}
function download(name,source){const blob=new Blob([source],{type:"text/plain;charset=utf-8"}),link=Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:name});link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
const {vertexStage,zeroFor,constantExpression,inputUniformName,graphInputs,javaIdentifier,validJavaClassName,graphTextureInputs,expressionFor,shaderLibrary,activeGraphNodeIds,extractShaderHelper,shaderLibraryFor,customFunctionSource,customHelpers,glslType,compileGraphExpression,branchVariableCode,graphFinalNode,fragmentSource} = createWorkflowCompiler({nodeDef,typeKey,typeLabel,variableBranchOwner,customParameters,customFunctionName,textureSampleName,textureAspectUniformName,textureSamplingFunctions});
function hasConnectedFragmentOutput(graph) { const node=graphFinalNode(graph);return node?.typeId==="io.output"&&graph.links.some(link=>link.toNode===node.id&&link.toSocket==="color"&&graph.nodes.some(source=>source.id===link.fromNode)); }
function exportReadiness(graph, config=projectConfig()) {
  graph=activeStage==="fragment"?graph:currentFragmentGraph();
  if(!hasConnectedFragmentOutput(graph)) return {ready:false, message:"未连接片段输出：请将结果连接到“片段输出”的 color 输入端口。"};
  try {
    if(!validJavaClassName(config.className)) throw new Error(`Java 类名无效：${config.className}。请使用非关键字的字母、数字或下划线名称，且不能以数字开头。`);
    const vertex=currentVertexTransform().graph;validateStageGraph(graph,"fragment");validateStageGraph(vertex,"vertex");
    validateGraphProperties(graph);validateGraphProperties(vertex);
    validateRuntimeInputs({nodes:[...graph.nodes,...vertex.nodes],links:[]});
    runtimeSources(graph,config);
    return {ready:true, message:"顶点与片段输出已连接，跨阶段参数校验通过，可导出运行文件。"};
  } catch(error) {
    return {ready:false, message:`导出前校验失败：${error.message||error}`};
  }
}
function renderCompileStatus(graph) {
  const readiness=exportReadiness(graph),message=document.querySelector("#compile-message"),pill=document.querySelector(".compile-card .pill");
  if(!message||!pill)return readiness;
  message.textContent=readiness.message;
  pill.textContent=readiness.ready?"可导出":"不可导出";
  pill.classList.toggle("invalid",!readiness.ready);
  return readiness;
}
function validateRuntimeInputs(graph){
  validateParameterIds(graph.nodes.filter(n=>["io.input","input.texture"].includes(n.typeId)).map(n=>({id:parameterId(n),name:inputUniformName(n),type:n.typeId==="input.texture"?"SAMPLER2D":typeKey(nodeDef(n).outputs[0]?.type),scope:n.typeId==="input.texture"?"shared":n.properties.scope||"shared"})));
  const supported=new Set(["BOOL","INT","UINT","FLOAT","VEC2","VEC3","VEC4"]),inputs=graphInputs(graph),textures=graphTextureInputs(graph),unsupported=inputs.filter(input=>!supported.has(typeKey(input.type)));
  if(unsupported.length)throw new Error(`当前 Java Plugin 的公共 uniform 参数不支持：${unsupported.map(input=>`${input.name}: ${typeLabel(input.type)}`).join("，")}。请改用 bool/int/uint/float/vec2/vec3/vec4，或先在工作流内部转换。`);
  const declarations=[];
  graph.nodes.filter(node=>node.typeId==="io.input").forEach(node=>declarations.push({name:inputUniformName(node),type:typeKey(nodeDef(node)?.outputs[0]?.type),source:node.title||node.id,scope:node.properties.scope||"shared"}));
  graph.nodes.filter(node=>node.typeId==="input.texture").forEach(node=>{
    const name=inputUniformName(node);declarations.push({name,type:"SAMPLER2D",source:node.title||node.id});declarations.push({name:textureAspectUniformName(name),type:"VEC2",source:`${node.title||node.id} 的纹理尺寸`});
  });
  const reserved=new Set(["u_time","u_viewportAlpha","u_instanceOffset"]),byName=new Map();
  declarations.forEach(declaration=>{
    if(reserved.has(declaration.name))throw new Error(`uniform 名称 ${declaration.name} 由运行时保留，用于时间推进，不能作为自定义输入。`);
    const existing=byName.get(declaration.name);if(existing&&(existing.type!==declaration.type||existing.scope!==declaration.scope))throw new Error(`uniform 名称冲突：${declaration.name} 同时声明为 ${typeLabel(existing.type)} 和 ${typeLabel(declaration.type)}。`);
    byName.set(declaration.name,declaration);
  });
}
function runtimeSources(graph=currentFragmentGraph(),config=projectConfig()){if(activeStage==='vertex')graph=currentFragmentGraph();const transform=currentVertexTransform(),all={nodes:[...graph.nodes,...transform.graph.nodes],links:[]};return buildRuntimeSources({config,graph,transform,inputs:graphInputs(all),textures:graphTextureInputs(all),fragment:fragmentSource(graph),vertexProgram:vertexStage(transform.graph),runtimeFiles});}
function exportRuntime(strict=false){const graph=store.snapshot(),readiness=renderCompileStatus(graph);if(!readiness.ready){if(strict===true)throw new Error(readiness.message);return null;}saveWorkflow();lastGeneratedSources=runtimeSources(graph);downloadZip(projectConfig().className+'.zip',Object.values(lastGeneratedSources));workflowBridge.publish(graph);document.querySelector('#footer-message').textContent='已导出实例化运行时 ZIP';return lastGeneratedSources;}

document.querySelector("#node-search").addEventListener("input", e => renderCatalog(e.target.value)); document.querySelector("#new-graph").addEventListener("click", () => { ui.selected = null;ui.selectedNodes.clear(); store.reset(); });
document.querySelector("#add-demo").addEventListener("click", addDemo);document.querySelector("#save-workflow").addEventListener("click",saveWorkflow);document.querySelector("#export-runtime").addEventListener("click",exportRuntime);
document.querySelector("#import-workflow").addEventListener("click",()=>{document.querySelector("#import-status").textContent="尚未选择文件。";document.querySelector("#import-dialog").showModal();});
document.querySelector("#close-import-dialog").addEventListener("click",()=>document.querySelector("#import-dialog").close());
document.querySelector("#choose-workflow-file").addEventListener("click",()=>document.querySelector("#workflow-file-input").click());
document.querySelector("#workflow-file-input").addEventListener("change",event=>{const file=event.target.files?.[0];if(file)importWorkflowFile(file);event.target.value="";});
document.querySelector("#workflow-manager").addEventListener("click",()=>{const config=projectConfig(),resolution=previewResolution(config);document.querySelector("#workflow-title").value=config.title;document.querySelector("#plugin-class-name").value=config.className;document.querySelector("#shader-directory").value=config.shaderDir;document.querySelector("#blend-mode").value=config.blendMode||"alpha";document.querySelector("#preview-canvas-width").value=resolution.width;document.querySelector("#preview-canvas-height").value=resolution.height;document.querySelector("#bridge-port").value=workflowBridge.port();document.querySelector("#bridge-status").textContent="未检测；点击“检测桥接”后再配置 MCP。";renderWorkflowLibrary();renderConstructorContract();document.querySelector("#workflow-dialog").showModal();});
document.querySelector("#bridge-port").addEventListener("change",event=>workflowBridge.setPort(event.target.value));
document.querySelector("#bridge-check").addEventListener("click",checkBridge);
document.querySelector("#bridge-self-test").addEventListener("click",selfTestMcp);
shell.addEventListener("pointerdown",()=>workflowBridge.claimActive(store.snapshot()),{capture:true});
const bridgePromptButton=document.querySelector("#bridge-copy-prompt");
bridgePromptButton.textContent="显示 MCP 配置与接入提示";
const bridgePromptBox=document.createElement("textarea");
bridgePromptBox.id="bridge-prompt"; bridgePromptBox.className="bridge-prompt"; bridgePromptBox.readOnly=true; bridgePromptBox.spellcheck=false;
bridgePromptBox.setAttribute("aria-label","MCP 配置与接入提示");
bridgePromptBox.placeholder="点击“显示 MCP 配置与接入提示”生成内容，可自行选择复制";
bridgePromptButton.parentElement.insertAdjacentElement("afterend",bridgePromptBox);
bridgePromptButton.addEventListener("click",async()=>{bridgePromptBox.value=await bridgePrompt();bridgePromptBox.focus();document.querySelector("#bridge-status").textContent="提示已显示；请按当前运行方式选择对应段落。";});
document.querySelector("#close-workflow-dialog").addEventListener("click",()=>document.querySelector("#workflow-dialog").close());
document.querySelector("#create-workflow").addEventListener("click",()=>{const config=bridgeProjectConfig({id:`workflow_${Date.now()}`,title:document.querySelector("#workflow-title").value||"Untitled Workflow",className:document.querySelector("#plugin-class-name").value,shaderDir:document.querySelector("#shader-directory").value,blendMode:document.querySelector("#blend-mode").value,previewWidth:document.querySelector("#preview-canvas-width").value,previewHeight:document.querySelector("#preview-canvas-height").value});openWorkflow(config,starterGraph(),false);saveWorkflow();renderWorkflowLibrary();});
document.querySelector("#save-current-workflow").addEventListener("click",()=>{const config=bridgeProjectConfig({id:projectConfig().id,title:document.querySelector("#workflow-title").value,className:document.querySelector("#plugin-class-name").value,shaderDir:document.querySelector("#shader-directory").value,blendMode:document.querySelector("#blend-mode").value,previewWidth:document.querySelector("#preview-canvas-width").value,previewHeight:document.querySelector("#preview-canvas-height").value},projectConfig());sessionStorage.setItem("workflow.projectConfig",JSON.stringify(config));store.graph.previewRevision=++store.previewRevision;store.emit();saveWorkflow();renderWorkflowLibrary();});
store.subscribe(graph => { persistActiveGraph(graph); document.querySelector("#revision").textContent = graph.revision; document.querySelector("#workflow-name").textContent=projectConfig().title; document.querySelector("#footer-message").textContent = `${graph.nodes.length} 节点 · ${graph.links.length} 连线`; renderGraph(graph); renderInspector(graph); renderCompileStatus(graph);if(document.querySelector("#workflow-dialog").open)renderConstructorContract(); workflowBridge.publish(graph); });
setInterval(() => workflowBridge.pull(), 250);
setInterval(() => workflowBridge.publish(store.snapshot()), 2000);
function addDemo() {
  const x=115,y=175; addNode("input.uv",x,y); addNode("vector.center",x+280,y); addNode("vector.length",x+560,y); const graph=store.snapshot();
  const uv=graph.nodes.filter(n=>n.typeId==="input.uv").slice(-1)[0], center=graph.nodes.filter(n=>n.typeId==="vector.center").slice(-1)[0], length=graph.nodes.filter(n=>n.typeId==="vector.length").slice(-1)[0];
  store.command("CONNECT",{link:{fromNode:uv.id,fromSocket:"uv",toNode:center.id,toSocket:"uv"}}); store.command("CONNECT",{link:{fromNode:center.id,fromSocket:"value",toNode:length.id,toSocket:"value"}});
}
renderCatalog();
renderCompileStatus(store.snapshot());

document.querySelectorAll('a[data-stage]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();switchStage(a.dataset.stage);}));
updateStageUI();

function uploadPreviewParameter(gl,program,p,value=p.defaultValue){
  const location=gl.getUniformLocation(program,p.name);if(location===null)return;
  if(p.type==='BOOL')gl.uniform1i(location,value===true||String(value)==='true'?1:0);
  else if(p.type==='INT')gl.uniform1i(location,Number(value)||0);
  else if(p.type==='UINT')gl.uniform1ui(location,Number(value)||0);
  else if(/^VEC[234]$/.test(p.type)){const size=Number(p.type.slice(-1)),values=Array.isArray(value)?value:String(value).split(/[\s,]+/).filter(Boolean).map(Number);gl['uniform'+size+'fv'](location,Array.from({length:size},(_,i)=>Number(values[i]??values[0]??0)));}
  else gl.uniform1f(location,Number(value)||0);
}
function drawGeometryPreview(canvas,{count,selected,time,overrides}){
  if(!previewRenderer)throw new Error('当前浏览器不支持 WebGL2');
  const transform=currentVertexTransform(),g=transform.graph,fragment=currentFragmentGraph(),vertex=vertexStage(g),all={nodes:[...fragment.nodes,...g.nodes],links:[]};
  validateStageGraph(g,'vertex');validateRuntimeInputs(all);
  const params=graphInputs(all),uniforms=params.map(p=>'uniform '+glslType(p.type)+' '+p.name+';').join('\n');
  const source=`#version 300 es
precision highp float;
precision highp int;
in vec2 position;
out vec2 v_uv;
uniform float u_time;
uniform vec2 wf_preview_extent;
${uniforms}
${vertex.helpers}
mat2 wf_rotate(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
void main(){
 vec2 a_position=position;
 v_uv=vec2((gl_VertexID & 1)!=0?1.0:0.0,gl_VertexID>=2?1.0:0.0);
 ${vertex.lines}
 v_uv=${vertex.uv};
 vec2 local=wf_rotate(${Number(transform.rotation*Math.PI/180).toFixed(8)})*(${vertex.position}*vec2(${Number(transform.sx).toFixed(5)},${Number(transform.sy).toFixed(5)}))+vec2(${Number(transform.tx).toFixed(5)},${Number(transform.ty).toFixed(5)});
 gl_Position=vec4(local/wf_preview_extent,0.0,1.0);
}`;
  const fs=fragmentSource(fragment).replace('#version 420','#version 300 es\nprecision highp float;\nprecision highp int;'),{gl,surface}=previewRenderer;
  let program,buffer;
  try{
    program=compilePreviewProgram(gl,fs,source);buffer=gl.createBuffer();gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(transform.vertices.flat()),gl.STATIC_DRAW);
    const location=gl.getAttribLocation(program,'position');if(location>=0){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);}
    surface.width=canvas.width;surface.height=canvas.height;gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.clearColor(.04,.065,.1,1);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(gl.getUniformLocation(program,'u_time'),time);
    graphTextureInputs(all).forEach((p,i)=>{const n=all.nodes.find(n=>n.id===p.nodeId&&n.typeId==='input.texture'),t=previewTexture(gl,n);gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t.texture);gl.uniform1i(gl.getUniformLocation(program,p.name),i);gl.uniform2f(gl.getUniformLocation(program,textureAspectUniformName(p.name)),t.width,t.height);});
    const cols=Math.ceil(Math.sqrt(count*canvas.width/canvas.height)),rows=Math.ceil(count/cols),w=Math.floor(canvas.width/cols),h=Math.floor(canvas.height/rows),extent=Math.max(220,...transform.vertices.flat().map(Math.abs));
    gl.uniform2f(gl.getUniformLocation(program,'wf_preview_extent'),extent*Math.max(1,w/h),extent*Math.max(1,h/w));
    for(let i=0;i<count;i++){params.forEach(p=>uploadPreviewParameter(gl,program,p,i===selected-1&&p.name in overrides?overrides[p.name]:p.defaultValue));gl.viewport((i%cols)*w,Math.floor(i/cols)*h,w,h);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
    const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(surface,0,0);const index=Math.min(count,selected)-1;context.strokeStyle='#5ca8ff';context.lineWidth=2;context.strokeRect(index%cols*w+2,canvas.height-(Math.floor(index/cols)+1)*h+2,w-4,h-4);
  }finally{if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}
}
installGeometrySettings({getTransform:currentVertexTransform,setTransform:t=>{sessionStorage.setItem('workflow.vertexTransform',JSON.stringify(normalizeTransform(t)));store.graph.previewRevision=++store.previewRevision;store.emit();},getParameters:()=>graphInputs({nodes:[...currentFragmentGraph().nodes,...currentVertexTransform().graph.nodes]}),draw:drawGeometryPreview});

function renderConstructorContract(){
  const panel=document.querySelector('#constructor-contract');
  try{const all={nodes:[...currentFragmentGraph().nodes,...currentVertexTransform().graph.nodes]};validateRuntimeInputs(all);panel.textContent=constructionGuide(projectConfig(),graphInputs(all),graphTextureInputs(all));}catch(error){panel.textContent='参数接口无法生成：'+error.message;}
}

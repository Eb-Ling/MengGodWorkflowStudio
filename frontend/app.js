const catalog = [
  { typeId: "io.input", title: "输入", category: "输入输出", inputs: [], outputs: [{ name: "value", type: "FLOAT" }], properties: { uniform: "u_value", defaultValue: "0.0" } },
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
  {typeId:"noise.worley",title:"Worley 噪声",category:"噪声",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
  {typeId:"noise.turbulence",title:"湍流",category:"噪声",inputs:[{name:"uv",type:"VEC2"}],outputs:[{name:"value",type:"FLOAT"}],properties:{}},
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
  constructor() { this.listeners = new Set(); this.previewRevision = 0; this.reset(loadCurrentGraph()); }
  reset(graph = starterGraph()) { migrateBranchMetadata(graph); graph.previewRevision = ++this.previewRevision; this.graph = graph; this.emit(); }
  subscribe(listener) { this.listeners.add(listener); listener(this.snapshot()); return () => this.listeners.delete(listener); }
  snapshot() { return clone(this.graph); }
  emit() { this.listeners.forEach(listener => listener(this.snapshot())); }
  command(type, payload) {
    const g = this.graph;
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
    if (payload.node?.typeId === "io.output") g.outputNodeId = payload.node.id;
    resolveTypes(g); pruneInvalidLinks(g);
    if (type !== "MOVE_NODE") g.previewRevision = ++this.previewRevision;
    g.revision++; this.emit();
  }
  node(id) { return this.graph.nodes.find(n => n.id === id); }
  moveNodes(nodes) {
    const positions = new Map(nodes.map(node => [node.id, node]));
    if (!positions.size) return;
    this.graph.nodes.forEach(node => {
      const position = positions.get(node.id);
      if (position) Object.assign(node, { canvasX: position.x, canvasY: position.y });
    });
    this.graph.revision++;
    this.emit();
  }
}

const store = new GraphStore();
let lastGeneratedSources = null;
const ui = { selected: null, selectedNodes: new Set(), pendingWire: null, disconnectWire: null, drag: null, selectionBox: null, contextNodeId: null, backgroundPointer: null, catalogCollapsed: new Set(JSON.parse(localStorage.getItem("workflow.catalogCollapsed") || "[]")), view: { x: 0, y: 0, zoom: 1, pan: null } };
const previewClock = { enabled: sessionStorage.getItem("workflow.previewTimeEnabled") === "true", startedAt: performance.now(), lastFrameAt: 0, animationFrame: 0 };
const workflowBridge = (() => {
  const requestedPort=Number(new URLSearchParams(location.search).get("bridgePort"));
  let port = requestedPort || Number(localStorage.getItem("workflow.bridgePort") || 4174);
  if(requestedPort)localStorage.setItem("workflow.bridgePort",String(port));
  let cursor = 0;
  let pulling = false;
  const base = () => `http://127.0.0.1:${port}`;
  async function publish(graph) { try { await fetch(`${base()}/v1/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "active_editor_draft", graph, project: projectConfig(), vertexTransform: currentVertexTransform(), selection: [...ui.selectedNodes], view:{x:ui.view.x,y:ui.view.y,zoom:ui.view.zoom}, savedWorkflows: workflowLibrary().map(item=>({id:item.id,title:item.config.title,className:item.config.className,shaderDir:item.config.shaderDir,nodeCount:item.graph.nodes.length,linkCount:item.graph.links.length})), customNodes: JSON.parse(localStorage.getItem("workflow.customNodes")||"[]"), workflowNodes: workflowNodeLibrary().map(item=>({id:item.id,title:item.title,preset:!!item.preset,description:item.description||"",nodeCount:item.graph.nodes.length,linkCount:item.graph.links.length})), generatedSources: lastGeneratedSources, catalog: catalog.map(({typeId,title,category,inputs,outputs,properties})=>({typeId,title,category,inputs,outputs,properties})) }) }); } catch (_) {} }
  async function pull() {
    if(pulling)return;
    pulling=true;
    try {
      const response=await fetch(`${base()}/v1/commands?cursor=${cursor}`);
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
  async function acknowledge(requestId,ok,error="") { try { await fetch(`${base()}/v1/ack`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,ok,error,revision:store.snapshot().revision})}); } catch (_) {} }
  function setPort(value) { port = Math.max(1, Math.min(65535, Number(value) || 4174)); localStorage.setItem("workflow.bridgePort", String(port)); cursor = 0; }
  function url() { return base(); }
  return { publish, pull, setPort, url, port:()=>port };
})();
function applyBridgeAction(type, payload) {
  if (type === "SAVE_WORKFLOW") saveWorkflow();
  else if (type === "EXPORT_RUNTIME") exportRuntime(true);
  else if (type === "NEW_WORKFLOW") { const config=bridgeProjectConfig(payload);openWorkflow(config,starterGraph(),false);saveWorkflow(); }
  else if (type === "RESET_CURRENT_DRAFT") { store.reset(starterGraph());ui.selected=null;ui.selectedNodes.clear(); }
  else if (type === "LOAD_MING_GOD_EXAMPLE") loadMingGodExample(false);
  else if (type === "OPEN_WORKFLOW") { const item=workflowLibrary().find(entry=>entry.id===payload.id);if(!item)throw new Error(`未找到工作流：${payload.id}`);openWorkflow(item.config,item.graph,true,item.vertexTransform); }
  else if (type === "DELETE_WORKFLOW") { const existing=workflowLibrary().find(entry=>entry.id===payload.id);if(!existing)throw new Error(`未找到工作流：${payload.id}`);const remaining=workflowLibrary().filter(entry=>entry.id!==payload.id);localStorage.setItem("workflow.library",JSON.stringify(remaining));if(projectConfig().id===payload.id)openWorkflow(newWorkflowConfig(),starterGraph(),false);renderWorkflowLibrary(); }
  else if (type === "IMPORT_WORKFLOW_DATA") { const imported=validateImportedWorkflow(payload.workflow);openWorkflow(imported.project,imported.graph,false,imported.vertexTransform);saveWorkflow(); }
  else if (type === "SET_PROJECT_CONFIG") { const config={...projectConfig(),...bridgeProjectConfig(payload,projectConfig())};sessionStorage.setItem("workflow.projectConfig",JSON.stringify(config)); }
  else if (type === "SET_VERTEX_TRANSFORM") { const transform=bridgeVertexTransform(payload);sessionStorage.setItem("workflow.vertexTransform",JSON.stringify(transform));localStorage.setItem("workflow.vertexTransform",JSON.stringify(transform)); }
  else if (type === "SET_VIEW") { ui.view.x=Number(payload.x)||0;ui.view.y=Number(payload.y)||0;ui.view.zoom=Math.max(.35,Math.min(1.8,Number(payload.zoom)||1));updateView(); }
  else if (type === "SET_SELECTION") { const valid=new Set(store.snapshot().nodes.map(node=>node.id));ui.selectedNodes=new Set((payload.nodeIds||[]).filter(id=>valid.has(id)));ui.selected=[...ui.selectedNodes][0]||null;renderGraph(store.snapshot());renderInspector(store.snapshot()); }
  else if (type === "DELETE_SELECTED") { const ids=[...ui.selectedNodes];ui.selectedNodes.clear();ui.selected=null;ids.forEach(nodeId=>store.command("REMOVE_NODE",{nodeId})); }
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
function bridgeProjectConfig(payload={},base=newWorkflowConfig()){const resolution=previewResolution({...base,previewWidth:payload.previewWidth??base.previewWidth,previewHeight:payload.previewHeight??base.previewHeight});return {id:String(payload.id||base.id||`workflow_${Date.now()}`),title:String(payload.title||base.title||"Untitled Workflow"),className:String(payload.className||base.className||"GeneratedCombatLayerPlugin").replace(/[^A-Za-z0-9_]/g,"")||"GeneratedCombatLayerPlugin",shaderDir:String(payload.shaderDir||base.shaderDir||"data/shaders/generated"),previewWidth:resolution.width,previewHeight:resolution.height};}
function bridgeVertexTransform(payload={}){const fallback=defaultVertexTransform(),vertices=Array.isArray(payload.vertices)&&payload.vertices.length===4?payload.vertices.map(pair=>[Number(pair?.[0])||0,Number(pair?.[1])||0]):fallback.vertices;return {vertices,tx:Number(payload.tx)||0,ty:Number(payload.ty)||0,sx:Number(payload.sx)||1,sy:Number(payload.sy)||1,rotation:Number(payload.rotation)||0};}
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
const bridgePrompt = () => { const port=workflowBridge.port(),bridgeUrl=`http://127.0.0.1:${port}`,desktop=window.workflowDesktop||null,nodeConfig={command:"node",args:["/absolute/path/to/MengGodWorkflowStudio/ai-gateway/mcp-server.mjs"],env:{WORKFLOW_BRIDGE_URL:bridgeUrl}},desktopConfig=desktop?.executablePath&&desktop?.mcpServerPath?{command:desktop.executablePath,args:[desktop.mcpServerPath],env:{ELECTRON_RUN_AS_NODE:"1",WORKFLOW_BRIDGE_URL:bridgeUrl}}:null;return `# Workflow Shader MCP 接入说明

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

MCP 服务由 Codex、Claude Desktop 等客户端按需启动，因此 EXE 不会单独常驻一个 MCP 进程；EXE 自动启动的是页面桥接。连接完成后先调用 workflow_get_current、workflow_list_node_types 和 workflow_list_resources。写入操作使用 expectedRevision，完成后再次读取当前草稿验证 io.output.color，再调用 workflow_export_runtime。当前未保存草稿也可直接操作。`; };
async function checkBridge() { const status=document.querySelector("#bridge-status");workflowBridge.setPort(document.querySelector("#bridge-port").value);try { const response=await fetch(`${workflowBridge.url()}/health`);if(!response.ok)throw new Error(`HTTP ${response.status}`);await workflowBridge.publish(store.snapshot());status.textContent=`已连接：${workflowBridge.url()}（已同步当前编辑草稿）`;status.style.color="#74dfa4";}catch(error){status.textContent=`未连接：请先启动 ai-gateway/server.mjs（${workflowBridge.url()}）`;status.style.color="#ff9eaa";} }
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
    "texture.sample2d":"按 UV 坐标采样 SAMPLER2D，输出 RGBA（VEC4）。预览与导出都会保持纹理比例并对画布外区域透明处理。"
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
  catalog.filter(n => !compositeTypes.has(n.typeId) && (n.title.includes(filter) || n.category.includes(filter))).forEach(n => { if (!groups.has(n.category)) groups.set(n.category, []); groups.get(n.category).push(n); });
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
function renderWorkflowNodeCatalog(root){const nodes=workflowNodeLibrary(),section=document.createElement("section");section.className="catalog-group workflow-node-group";section.innerHTML='<div class="catalog-group-title static"><span>工作流节点</span><span class="catalog-chevron">▣</span></div>';const entries=document.createElement("div");entries.className="catalog-entries";nodes.forEach(item=>{const entry=document.createElement("div");entry.className=`catalog-node workflow-catalog-node${item.preset?"":" user-workflow-node"}`;entry.dataset.workflowNodeId=item.id;entry.draggable=true;entry.title=item.preset?(item.description||"拖到工作区展开子流程图"):`用户工作流节点：${item.description||"拖到工作区展开子流程图"}（右键删除）`;entry.innerHTML=`<span class="catalog-dot"></span><span>${item.title}</span>${item.preset?"":"<small>用户</small>"}`;entry.addEventListener("dragstart",event=>{event.dataTransfer.effectAllowed="copy";event.dataTransfer.setData("workflow-node-id",item.id);});if(!item.preset)entry.addEventListener("contextmenu",event=>deleteWorkflowNode(event,item));entries.append(entry);});section.append(entries);root.append(section);}
function addWorkflowNode(workflowNodeId,x,y){const workflow=workflowNodeLibrary().find(item=>item.id===workflowNodeId);if(!workflow)return;const source=clone(workflow.graph),minX=Math.min(...source.nodes.map(node=>node.canvasX)),minY=Math.min(...source.nodes.map(node=>node.canvasY)),ids=new Map();source.nodes.forEach(node=>ids.set(node.id,id("subgraph")));source.nodes.forEach(node=>{node.id=ids.get(node.id);node.canvasX=Math.round(x+node.canvasX-minX);node.canvasY=Math.round(y+node.canvasY-minY);store.command("ADD_NODE",{node});});source.links.forEach(link=>store.command("CONNECT",{link:{...link,fromNode:ids.get(link.fromNode),toNode:ids.get(link.toNode)}}));document.querySelector("#footer-message").textContent=`已展开工作流节点：${workflow.title}`;}
function saveSelectionAsWorkflowNode(requestedTitle=null){const graph=store.snapshot(),selected=graph.nodes.filter(node=>ui.selectedNodes.has(node.id));if(selected.length<2){document.querySelector("#footer-message").textContent="请先框选至少两个节点";return;}const links=graph.links.filter(link=>ui.selectedNodes.has(link.fromNode)&&ui.selectedNodes.has(link.toNode));const title=requestedTitle||window.prompt("工作流节点名称",`工作流节点 ${workflowNodeLibrary().length+1}`);if(!title)return;const custom={id:`subgraph_${Date.now()}`,title:title.trim()||"工作流节点",preset:false,description:"用户保存的组合节点",graph:{nodes:selected,links}};const items=workflowNodeLibrary().filter(item=>!item.preset);items.push(custom);localStorage.setItem("workflow.subgraphNodes",JSON.stringify(items));renderCatalog();document.querySelector("#footer-message").textContent=`已保存工作流节点：${custom.title}`;}
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
    element.innerHTML = `<header class="node-header"><span class="type-icon"></span><span>${node.title}</span><span class="node-id">${node.id}</span></header>${showPreview ? `<canvas class="node-preview" width="112" height="112" title="节点输出预览"></canvas>` : ""}<div class="node-body"></div>`;
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
function startDrag(event,nodeIds) { const nodes=[...new Set(nodeIds)].map(nodeId=>store.node(nodeId)).filter(Boolean).map(item=>({id:item.id,startX:item.canvasX,startY:item.canvasY}));if(!nodes.length)return;ui.drag={nodes,x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture?.(event.pointerId); }
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
    const options=isSplit?"<option>AUTO</option><option>VEC2</option><option>VEC3</option><option>VEC4</option>":isCombine?"<option>VEC2</option><option>VEC3</option><option>VEC4</option>":"<option>AUTO</option><option>BOOL</option><option>FLOAT</option><option>VEC2</option><option>VEC3</option><option>VEC4</option>";
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
  if(node.typeId==="logic.variable"){const inferred=variableBranchOwner(graph,node),field=document.createElement("div");field.className="field";field.innerHTML=`<label>控制流来源</label><div class="readonly">${inferred?(inferred.branch==="loop"?"FOR 循环体（由 value 输入来源自动推断）":`${inferred.branch.toUpperCase()} 分支（由 value 输入来源自动推断）`):"未连接到 If 或 For 内的节点"}</div><small class="type-hint">init 在控制块前初始化，value 的输入来源决定在哪个 If 分支或 For 循环体内写入。</small>`;root.append(field);}
  if (node.typeId === "input.texture") { const field=document.createElement("div");field.className="field texture-input-field";field.innerHTML=`<label>预览纹理</label><input type="file" accept="image/*"><small>仅用于工作流预览；导出后由构造器传入 SpriteAPI。</small>${node.properties.previewDataUrl?'<img class="texture-source-preview" alt="纹理预览">':''}`;const file=field.querySelector("input");file.addEventListener("change",event=>{const selected=event.target.files?.[0];if(!selected)return;const reader=new FileReader();reader.addEventListener("load",()=>store.command("SET_PROPERTY",{nodeId:node.id,key:"previewDataUrl",value:String(reader.result||"")}));reader.readAsDataURL(selected);});const image=field.querySelector("img");if(image)image.src=node.properties.previewDataUrl;root.append(field); }
  if (d.outputs.length) { const preview=document.createElement("div"); preview.className="field preview-toggle"; preview.innerHTML=`<label><input type="checkbox" ${node.properties.previewEnabled ? "checked" : ""}> 输出预览</label>`; preview.querySelector("input").addEventListener("change",event=>store.command("SET_PROPERTY",{nodeId:node.id,key:"previewEnabled",value:event.target.checked})); root.append(preview); }
  Object.entries(node.properties).filter(([key])=>!['previewEnabled','valueType','previewDataUrl'].includes(key)).forEach(([key, value]) => {
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
function openContextMenu(event,nodeId) { event.preventDefault();if(!ui.selectedNodes.has(nodeId))select(nodeId);ui.contextNodeId=nodeId;const menu=document.querySelector("#node-context-menu"),selected=[...ui.selectedNodes].map(id=>store.node(id)).filter(Boolean),allPreviewEnabled=selected.length>0&&selected.every(node=>node.properties.previewEnabled);menu.querySelector('[data-action="toggle-preview"]').textContent=allPreviewEnabled?"关闭选中预览":"开启选中预览";menu.querySelector('[data-action="disconnect"]').textContent=selected.length>1?"断开选中节点连线":"断开所有连线";menu.querySelector('[data-action="delete"]').textContent=selected.length>1?"删除选中节点":"删除节点";menu.style.left=`${event.clientX}px`;menu.style.top=`${event.clientY}px`;menu.hidden=false; }
function closeContextMenu(){document.querySelector("#node-context-menu").hidden=true;ui.contextNodeId=null;}
document.querySelector("#node-context-menu").addEventListener("click",event=>{const action=event.target.dataset.action,nodeId=ui.contextNodeId;if(!action||!nodeId)return;const ids=[...ui.selectedNodes];if(!ids.length)ids.push(nodeId);const graph=store.snapshot(),nodes=graph.nodes.filter(node=>ids.includes(node.id));if(action==="delete"){ui.selectedNodes.clear();ui.selected=null;ids.forEach(id=>store.command("REMOVE_NODE",{nodeId:id}));}if(action==="disconnect")graph.links.filter(link=>ids.includes(link.fromNode)||ids.includes(link.toNode)).forEach(link=>store.command("DISCONNECT",{link}));if(action==="toggle-preview"){const enabled=nodes.length>0&&nodes.every(node=>node.properties.previewEnabled);ids.forEach(id=>store.command("SET_PROPERTY",{nodeId:id,key:"previewEnabled",value:!enabled}));}if(action==="save-workflow-node")saveSelectionAsWorkflowNode();closeContextMenu();});
window.addEventListener("pointerdown",event=>{if(!event.target.closest("#node-context-menu"))closeContextMenu();});
function fallback(type) { return type === "BOOL" ? false : type === "ANY" || type === "FLOAT" ? 0 : type === "VEC2" ? [0, 0] : type === "VEC3" ? [0, 0, 0] : [0, 0, 0, 1]; }
function scalar(value) { return Array.isArray(value) ? value[0] : value; }
function vector(value, size) { const source=Array.isArray(value)?value:[value]; return Array.from({length:size},(_,i)=>source[i] ?? source[0] ?? 0); }
function combine(a,b,operator,type) { if(type === "ANY" || type === "FLOAT") return operator(scalar(a),scalar(b)); const size=Number(type.slice(-1)); const av=vector(a,size),bv=vector(b,size); return av.map((x,i)=>operator(x,bv[i])); }
function previewValue(graph, nodeId, socket, uv, memo = new Map(), stack = new Set()) {
  const cacheKey=`${nodeId}:${socket}:${uv[0].toFixed(3)}:${uv[1].toFixed(3)}`; if(memo.has(cacheKey)) return memo.get(cacheKey); if(stack.has(nodeId)) return { value: fallback("FLOAT"), type:"FLOAT" };
  const node=graph.nodes.find(n=>n.id===nodeId), d=node && nodeDef(node); if(!node || !d) return {value:0,type:"FLOAT"}; stack.add(nodeId);
  const input=(name)=>{ const port=d.inputs.find(p=>p.name===name), link=graph.links.find(l=>l.toNode===nodeId&&l.toSocket===name); return link ? previewValue(graph,link.fromNode,link.fromSocket,uv,memo,stack).value : fallback(port?.type||"FLOAT"); };
  let value=fallback(d.outputs[0]?.type||"FLOAT"), type=d.outputs[0]?.type||"FLOAT"; if(type === "ANY") type="FLOAT";
  if(node.typeId === "input.uv") value=uv;
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
  else if(node.typeId === "noise.value" || node.typeId === "noise.fbm") { const p=vector(input("uv"),2); const n=Math.sin(p[0]*127.1+p[1]*311.7)*43758.5453; value=n-Math.floor(n); type="FLOAT"; }
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
  const uniforms=graphInputs(graph).map(input=>`uniform float ${input.name};`).join("\n");
  const textures=graphTextureInputs(graph).map(input=>`uniform sampler2D ${input.name};`).join("\n");
  return `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
${uniforms}
${textures}
${textureSamplingFunctions(graph)}
${shaderLibrary()}
${customHelpers(graph)}
void main() {
${compiled.statements.join("\n")}
    fragColor = ${previewColorExpression(output.type === "ANY" ? "FLOAT" : output.type, expression)};
}`;
}
function compilePreviewProgram(gl, source) {
  const compile=(type, code)=>{const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||"GLSL 编译失败");return shader;};
  const vertex=compile(gl.VERTEX_SHADER,`#version 300 es
in vec2 position;
out vec2 v_uv;
void main() { v_uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`);
  const fragment=compile(gl.FRAGMENT_SHADER,source),program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||"GLSL 链接失败");return program;
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
      graphInputs(graph).forEach(input=>{const location=gl.getUniformLocation(program,input.name);if(location!==null){if(input.type==="BOOL")gl.uniform1i(location,input.defaultValue?1:0);else gl.uniform1f(location,input.defaultValue);}});
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
shell.addEventListener("pointerdown", e => { if ((e.button !== 0 && e.button !== 1) || (e.target !== shell && e.target !== graphTransform && e.target !== nodeLayer && e.target !== wireLayer)) return; e.preventDefault();if(e.button===0&&e.shiftKey){const start=toWorld(e.clientX,e.clientY),box=document.createElement("div");box.className="selection-box";graphTransform.append(box);ui.selectionBox={start,box};return;}if(e.button===0)ui.backgroundPointer={x:e.clientX,y:e.clientY};ui.view.pan={x:e.clientX,y:e.clientY,startX:ui.view.x,startY:ui.view.y};shell.classList.add("panning"); });
shell.addEventListener("wheel", e => { e.preventDefault(); const before=toWorld(e.clientX,e.clientY), factor=e.deltaY<0?1.12:1/1.12; ui.view.zoom=Math.max(.35,Math.min(1.8,ui.view.zoom*factor)); const rect=shell.getBoundingClientRect();ui.view.x=e.clientX-rect.left-before.x*ui.view.zoom;ui.view.y=e.clientY-rect.top-before.y*ui.view.zoom;updateView(); },{passive:false});
shell.addEventListener("dblclick", e => { if (e.target !== shell && e.target !== graphTransform) return; const p=toWorld(e.clientX,e.clientY); addNode("math.constant",p.x,p.y); });
window.addEventListener("pointermove", e => { if(ui.selectionBox){const end=toWorld(e.clientX,e.clientY),start=ui.selectionBox.start,left=Math.min(start.x,end.x),top=Math.min(start.y,end.y);Object.assign(ui.selectionBox.box.style,{left:`${left}px`,top:`${top}px`,width:`${Math.abs(end.x-start.x)}px`,height:`${Math.abs(end.y-start.y)}px`});return;}if (ui.view.pan) { ui.view.x=ui.view.pan.startX+e.clientX-ui.view.pan.x;ui.view.y=ui.view.pan.startY+e.clientY-ui.view.pan.y;updateView();return; } if (ui.drag) { const dx = (e.clientX - ui.drag.x)/ui.view.zoom, dy = (e.clientY - ui.drag.y)/ui.view.zoom;store.moveNodes(ui.drag.nodes.map(item=>({id:item.id,x:item.startX+dx,y:item.startY+dy}))); } const pending=ui.pendingWire||ui.disconnectWire; if (pending) { pending.x = e.clientX; pending.y = e.clientY; drawWires(store.snapshot()); } });
window.addEventListener("pointerup", e => { if(ui.selectionBox){const end=toWorld(e.clientX,e.clientY),start=ui.selectionBox.start,left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);ui.selectionBox.box.remove();ui.selectionBox=null;ui.selectedNodes.clear();store.snapshot().nodes.forEach(node=>{if(node.canvasX<right&&node.canvasX+206>left&&node.canvasY<bottom&&node.canvasY+150>top)ui.selectedNodes.add(node.id);});ui.selected=[...ui.selectedNodes][0]||null;renderGraph(store.snapshot());renderInspector(store.snapshot());return;}if(ui.view.pan){const backgroundPointer=ui.backgroundPointer;ui.view.pan=null;ui.backgroundPointer=null;shell.classList.remove("panning");if(backgroundPointer&&Math.hypot(e.clientX-backgroundPointer.x,e.clientY-backgroundPointer.y)<4){ui.selectedNodes.clear();ui.selected=null;renderGraph(store.snapshot());renderInspector(store.snapshot());}return;} ui.drag = null; const target = document.elementFromPoint(e.clientX, e.clientY); if(ui.disconnectWire){const link=ui.disconnectWire.link;store.command("DISCONNECT",{link});ui.disconnectWire=null;clearCompatible();return;} if (!ui.pendingWire) return; if (target?.classList.contains("port") && target.dataset.direction === "input" && compatible(ui.pendingWire.type,target.dataset.valueType)) store.command("CONNECT", { link: { fromNode: ui.pendingWire.fromNode, fromSocket: ui.pendingWire.fromSocket, toNode: target.dataset.nodeId, toSocket: target.dataset.socket } }); ui.pendingWire = null; clearCompatible(); drawWires(store.snapshot()); });
window.addEventListener("keydown", e => { if (e.key === "Delete" && ui.selectedNodes.size && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) { const ids=[...ui.selectedNodes];ui.selectedNodes.clear();ui.selected=null;ids.forEach(nodeId=>store.command("REMOVE_NODE", { nodeId }));renderInspector(store.snapshot()); } });
function projectConfig(){try{const raw=sessionStorage.getItem("workflow.projectConfig")||localStorage.getItem("workflow.projectConfig")||'{"id":"default","title":"Untitled Workflow","className":"GeneratedCombatLayerPlugin","shaderDir":"data/shaders/generated","previewWidth":1024,"previewHeight":1024}';if(!sessionStorage.getItem("workflow.projectConfig"))sessionStorage.setItem("workflow.projectConfig",raw);const config=JSON.parse(raw),resolution=previewResolution(config);return {...config,previewWidth:resolution.width,previewHeight:resolution.height};}catch(_){return {id:"default",title:"Untitled Workflow",className:"GeneratedCombatLayerPlugin",shaderDir:"data/shaders/generated",previewWidth:1024,previewHeight:1024};}}
function loadCurrentGraph(){try { const raw=sessionStorage.getItem("workflow.graph")||localStorage.getItem("workflow.graph")||"null";if(!sessionStorage.getItem("workflow.graph")&&raw!=="null")sessionStorage.setItem("workflow.graph",raw);const graph=JSON.parse(raw); return graph?.nodes && graph?.links ? graph : starterGraph(); } catch (_) { return starterGraph(); }}
function validateImportedWorkflow(value){
  if(!value||typeof value!=="object")throw new Error("根对象必须是 JSON 对象");
  if(Number(value.schemaVersion)!==1)throw new Error("schemaVersion 必须为 1");
  if(!value.project||typeof value.project!=="object")throw new Error("缺少 project 对象");
  const graph=value.graph;
  if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.links))throw new Error("graph 必须包含 nodes 和 links 数组");
  migrateBranchMetadata(graph);
  const ids=new Set(),types=new Set(catalog.map(node=>node.typeId));
  graph.nodes.forEach(node=>{
    if(!node.id||ids.has(node.id))throw new Error(`节点 ID 重复或为空：${node.id||"<empty>"}`);
    if(!types.has(node.typeId))throw new Error(`未知节点类型：${node.typeId}`);
    if(!Number.isFinite(Number(node.canvasX))||!Number.isFinite(Number(node.canvasY)))throw new Error(`节点坐标无效：${node.id}`);
    ids.add(node.id);
  });
  graph.links.forEach(link=>{
    const from=graph.nodes.find(node=>node.id===link.fromNode),to=graph.nodes.find(node=>node.id===link.toNode);
    if(!from||!to||!link.fromSocket||!link.toSocket)throw new Error("存在指向未知节点或端口不完整的连线");
    const fromPort=nodeDef(from)?.outputs.find(port=>port.name===link.fromSocket),toPort=nodeDef(to)?.inputs.find(port=>port.name===link.toSocket);
    if(!fromPort||!toPort)throw new Error(`连线引用了不存在的端口：${link.fromNode}.${link.fromSocket} -> ${link.toNode}.${link.toSocket}`);
    if(!compatible(fromPort.type,toPort.type))throw new Error(`连线类型不匹配：${typeLabel(fromPort.type)} 不能连接到 ${typeLabel(toPort.type)}`);
    if(isInvalidBranchConnection(graph,link))throw new Error("分支内部的输出只能连接同一分支节点，或通过变量节点带出。");
  });
  return {schemaVersion:1,project:bridgeProjectConfig(value.project,{...newWorkflowConfig(),title:"Imported Workflow"}),graph:clone(graph),vertexTransform:value.vertexTransform||defaultVertexTransform()};
}
function importWorkflowFile(file){const status=document.querySelector("#import-status");file.text().then(text=>{const imported=validateImportedWorkflow(JSON.parse(text));openWorkflow(imported.project,imported.graph,false,imported.vertexTransform);saveWorkflow();status.textContent=`导入成功：${imported.project.title}（${imported.graph.nodes.length} 节点，${imported.graph.links.length} 连线）`;document.querySelector("#footer-message").textContent=`已导入工作流：${imported.project.title}`;}).catch(error=>{status.textContent=`导入失败：${error.message||error}`;});}
function persistCurrentGraph(){sessionStorage.setItem("workflow.graph",JSON.stringify(store.snapshot()));}
function defaultVertexTransform(){return {vertices:[[-180,-90],[180,-90],[-180,90],[180,90]],tx:0,ty:0,sx:1,sy:1,rotation:0};}
function currentVertexTransform(){try{return {...defaultVertexTransform(),...JSON.parse(sessionStorage.getItem("workflow.vertexTransform")||localStorage.getItem("workflow.vertexTransform")||"null")};}catch(_){return defaultVertexTransform();}}
function workflowLibrary(){try{return JSON.parse(localStorage.getItem("workflow.library")||"[]");}catch(_){return[];}}
function newWorkflowConfig(){return {id:`workflow_${Date.now()}`,title:"Untitled Workflow",className:"GeneratedCombatLayerPlugin",shaderDir:"data/shaders/generated",previewWidth:1024,previewHeight:1024};}
function persistCurrentWorkflow(silent=true){const config=projectConfig(),id=String(config.id||"");if(!id)return;const library=workflowLibrary(),index=library.findIndex(item=>item.id===id);if(index<0)return;library[index]={id,config:clone(config),graph:store.snapshot(),vertexTransform:currentVertexTransform()};localStorage.setItem("workflow.library",JSON.stringify(library));sessionStorage.setItem("workflow.graph",JSON.stringify(store.snapshot()));if(!silent){renderWorkflowLibrary();document.querySelector("#footer-message").textContent=`已保存：${config.title}`;}}
function openWorkflow(config,graph,closeDialog=true,vertexTransform=null){persistCurrentWorkflow(true);const nextConfig=clone(config),nextGraph=clone(graph),transform=vertexTransform||defaultVertexTransform();sessionStorage.setItem("workflow.projectConfig",JSON.stringify(nextConfig));sessionStorage.setItem("workflow.vertexTransform",JSON.stringify(transform));localStorage.setItem("workflow.vertexTransform",JSON.stringify(transform));store.reset(nextGraph);ui.selected=null;ui.selectedNodes.clear();if(closeDialog)document.querySelector("#workflow-dialog").close();renderWorkflowLibrary();}
function loadMingGodExample(closeDialog=true){const config={id:`workflow_${Date.now()}`,title:"明神印记旋涡",className:"Meng_MingGodSignPlugin",shaderDir:"data/shaders/meng",previewWidth:1024,previewHeight:1024};openWorkflow(config,mingGodSignGraph(),closeDialog);saveWorkflow();document.querySelector("#footer-message").textContent="已创建并保存工作流：明神印记旋涡";}
function renderWorkflowLibrary(){
  const root=document.querySelector("#saved-workflows"),examples=document.querySelector("#example-workflows");if(!root)return;
  const library=workflowLibrary(),activeId=projectConfig().id;root.innerHTML=library.length?"":"<p class=\"readonly\">暂无保存的工作流。</p>";
  library.forEach(item=>{const row=document.createElement("div");row.className=`saved-workflow${item.id===activeId?" active":""}`;row.innerHTML=`<span class="saved-workflow-title">${item.config.title}<small>${item.config.shaderDir}</small></span><button data-open="${item.id}">打开</button><button data-delete="${item.id}" class="delete-workflow">删除</button>`;row.querySelector("[data-open]").addEventListener("click",()=>openWorkflow(item.config,item.graph,true,item.vertexTransform));row.querySelector("[data-delete]").addEventListener("click",()=>{const remaining=workflowLibrary().filter(entry=>entry.id!==item.id);localStorage.setItem("workflow.library",JSON.stringify(remaining));if(item.id===projectConfig().id){const config=newWorkflowConfig();openWorkflow(config,starterGraph(),false);}renderWorkflowLibrary();});root.append(row);});
  if(examples){examples.innerHTML="";const row=document.createElement("div");row.className="saved-workflow";row.innerHTML='<span class="saved-workflow-title">明神印记旋涡<small>Meng_MingGodSignPlugin</small></span><button data-open-example>载入</button>';row.querySelector("[data-open-example]").addEventListener("click",()=>loadMingGodExample());examples.append(row);}
}
function saveWorkflow(){const config=projectConfig(),graph=store.snapshot(),vertexTransform=currentVertexTransform(),id=config.id||`workflow_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;config.id=id;sessionStorage.setItem("workflow.projectConfig",JSON.stringify(config));sessionStorage.setItem("workflow.graph",JSON.stringify(graph));localStorage.setItem("workflow.vertexTransform",JSON.stringify(vertexTransform));const library=workflowLibrary().filter(item=>item.id!==id);library.push({id,config:clone(config),graph:clone(graph),vertexTransform:clone(vertexTransform)});localStorage.setItem("workflow.library",JSON.stringify(library));renderWorkflowLibrary();document.querySelector("#footer-message").textContent=`已保存：${config.title}`;}
function download(name,source){const blob=new Blob([source],{type:"text/plain;charset=utf-8"}),link=Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:name});link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
function zeroFor(type){const key=typeKey(type);if(key==="BOOL")return"false";if(key==="INT")return"0";if(key==="UINT")return"0u";if(key==="FLOAT")return"0.0";if(/^B?VEC[234]$/.test(key))return `${typeLabel(key)}(${key.startsWith("BVEC")?"false":"0"})`;if(/^U?IVEC[234]$/.test(key))return `${typeLabel(key)}(${key.startsWith("UVEC")?"0u":"0"})`;if(/^MAT[234]$/.test(key))return `${typeLabel(key)}(0.0)`;return"0.0";}
function constantExpression(node, type) {
  const raw=String(node.properties.value ?? "0").trim();
  const key=typeKey(type);if(key==="BOOL")return raw.toLowerCase()==="true"?"true":"false";
  const values=raw.split(/[\s,]+/).filter(Boolean).map(value=>Number(value)).map(value=>Number.isFinite(value)?value:0);
  const scalar=(values[0] ?? 0),count=Number((key.match(/[234]$/)||[])[0]||0),integer=key==="INT"||key==="UINT"||key.startsWith("IVEC")||key.startsWith("UVEC"),boolean=key.startsWith("BVEC");
  const component=value=>boolean?(Number(value)?"true":"false"):key==="UINT"||key.startsWith("UVEC")?`${Math.max(0,Math.trunc(value))}u`:integer?`${Math.trunc(value)}`:Number(value).toFixed(4);
  if(!count)return component(scalar);
  const parts=Array.from({length:count},(_,index)=>(values[index] ?? (values.length===1?values[0]:0)));
  return `${typeLabel(key)}(${parts.map(component).join(", ")})`;
}
function inputUniformName(node){const raw=String(node.properties.uniform||"u_value");return /^u_[A-Za-z0-9_]+$/.test(raw)?raw:"u_value";}
function graphInputs(graph){return graph.nodes.filter(node=>node.typeId==="io.input").map(node=>{const type=nodeDef(node).outputs[0]?.type||"FLOAT";return {name:inputUniformName(node),type,defaultValue:type==="BOOL"?String(node.properties.defaultValue).toLowerCase()==="true":Number(node.properties.defaultValue??0)||0};}).filter((item,index,all)=>all.findIndex(other=>other.name===item.name)===index);}
const JAVA_RESERVED_WORDS=new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null".split(" "));
function javaIdentifier(value,fallback="texture"){
  const name=String(value||fallback).replace(/[^A-Za-z0-9_]/g,"_").replace(/^[^A-Za-z_]+/,"")||fallback;
  return JAVA_RESERVED_WORDS.has(name)?`${name}_`:name;
}
function validJavaClassName(name){return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)&&!JAVA_RESERVED_WORDS.has(name);}
function graphTextureInputs(graph){const used=new Set();return graph.nodes.filter(node=>node.typeId==="input.texture").map(node=>{const base=javaIdentifier(node.properties.textureId,"texture");let parameter=base,index=2;while(used.has(parameter))parameter=`${base}${index++}`;used.add(parameter);return {name:inputUniformName(node),nodeId:node.id,textureId:String(node.properties.textureId||"texture"),parameter};}).filter((item,index,all)=>all.findIndex(other=>other.name===item.name)===index);}
function expressionFor(graph,nodeId,socket,cache=new Map()){
 const key=`${nodeId}:${socket}`;if(cache.has(key))return cache.get(key);const node=graph.nodes.find(n=>n.id===nodeId),d=node&&nodeDef(node);if(!node||!d)return"0.0";const input=name=>{const port=d.inputs.find(p=>p.name===name),link=graph.links.find(l=>l.toNode===nodeId&&l.toSocket===name);return link?expressionFor(graph,link.fromNode,link.fromSocket,cache):zeroFor(port?.type);};let e="0.0",id=node.typeId;
 if(id==="input.uv")e="v_uv";else if(id==="input.time")e="u_time";else if(id==="io.input"||id==="input.texture")e=inputUniformName(node);else if(id==="math.constant")e=constantExpression(node,d.outputs[0]?.type||node.properties.valueType||"FLOAT");else if(id==="logic.variable")e=`wf_var_${javaIdentifier(node.id)}`;else if(id==="vector.constant3")e=`vec3(${Number(node.properties.x||0).toFixed(4)}, ${Number(node.properties.y||0).toFixed(4)}, ${Number(node.properties.z||0).toFixed(4)})`;else if(id==="io.output")e=input("color");else if(id==="texture.sample2d"){const sampler=input("texture");e=`${textureSampleName(sampler)}(${sampler}, ${input("uv")})`;}else if(id==="vector.center")e=`(${input("uv")} - vec2(0.5))`;else if(id==="vector.scale2"||id==="vector.scale3")e=`(${input("value")} * ${input("scale")})`;else if(id==="vector.distance"||id==="vector.length")e=`length(${input("value")})`;else if(id==="vector.distance2")e=`distance(${input("a")},${input("b")})`;else if(id==="vector.normalize")e=`normalize(${input("value")})`;else if(id==="vector.dot"||id==="vector.cross"||id==="vector.reflect")e=`${id.slice(7)}(${input(id==="vector.reflect"?"incident":"a")},${input(id==="vector.reflect"?"normal":"b")})`;else if(id==="vector.rotate2d")e=`rot2(${input("angle")}) * ${input("value")}`;else if(["math.add","math.subtract","math.multiply"].includes(id))e=`(${input("a")} ${id==="math.add"?"+":id==="math.subtract"?"-":"*"} ${input("b")})`;else if(id==="math.divide")e=`(${input("a")} / max(abs(${input("b")}), 0.0001))`;else if(["math.min","math.max","math.mod","math.step"].includes(id))e=`${id.slice(5)}(${input(id==="math.step"?"edge":"a")},${input(id==="math.step"?"x":id==="math.mod"?"y":"b")})`;else if(["math.abs","math.fract","math.floor","math.ceil","math.sin","math.cos","math.tan","math.asin","math.acos","math.exp","math.log","math.sqrt","math.sign"].includes(id))e=`${id.slice(5)}(${input("x")})`;else if(id==="math.atan")e=`atan(${input("y")},${input("x")})`;else if(id==="math.pow")e=`pow(${input("base")},${input("exponent")})`;else if(id==="math.smoothstep")e=`smoothstep(${input("edge0")},${input("edge1")},${input("x")})`;else if(id==="math.mix")e=`mix(${input("a")},${input("b")},${input("t")})`;else if(id==="math.radians"||id==="math.degrees")e=`${id.slice(5)}(${input(id==="math.radians"?"degrees":"radians")})`;else if(id.startsWith("logic.")){const op={"logic.equal":"==","logic.notEqual":"!=","logic.greater":">","logic.greaterEqual":">=","logic.less":"<","logic.lessEqual":"<=","logic.and":"&&","logic.or":"||"}[id];e=id==="logic.not"?`(!${input("value")})`:op?`(${input("a")} ${op} ${input("b")})`:"false";}else if(id==="noise.value")e=`valueNoise(${input("uv")})`;else if(id==="noise.fbm")e=`fbmValue(${input("uv")})`;else if(id==="noise.simplex")e=`simplexNoise(${input("uv")})`;else if(id==="noise.fbmSimplex")e=`fbmSimplex(${input("uv")})`;else if(id==="noise.worley")e=`worleyNoise(${input("uv")})`;else if(id==="noise.fbmWorley")e=`fbmWorley(${input("uv")})`;else if(id==="noise.turbulence")e=`turbulence(${input("uv")})`;else if(id==="sdf.circle")e=`(length(${input("point")}) - ${input("radius")})`;else if(id==="sdf.box")e=`sdBox(${input("point")},${input("size")})`;else if(id==="sdf.segment")e=`segDist(${input("point")},${input("a")},${input("b")})`;else if(id==="sdf.lance")e=`sdLance(${input("point")},${input("baseX")},${input("tipX")},${input("maxR")})`;else if(id==="shape.lanceTaper")e=`lanceTaper(${input("t")})`;else if(id==="shape.xFade")e=`xFade(${input("point")},${input("baseX")},${input("tipX")})`;else if(id==="shape.fadeVertical"||id==="shape.fadeHorizontal")e=`smoothstep(${input("edge0")},${input("edge1")},${input("value")})`;else if(id==="curve.cubicBezier")e=`cubic(${input("p0")},${input("p1")},${input("p2")},${input("p3")},${input("t")})`;else if(id==="curve.quarticBezier")e=`bezier4(${input("p0")},${input("p1")},${input("p2")},${input("p3")},${input("p4")},${input("t")})`;else if(id.startsWith("custom.")){const source=String(d.properties.expression||"");e=source.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,(_,name)=>input(name));}
 if(id==="vector.split")e=`${input("value")}.${socket}`;
 if(id==="vector.combine"){const count={VEC2:2,VEC3:3,VEC4:4}[d.outputs[0]?.type]||2;e=`vec${count}(${["x","y","z","w"].slice(0,count).map(input).join(", ")})`;}
 if(id==="logic.for")e=`float(wf_loop_i_${javaIdentifier(node.id)})`;
 if(id==="vector.scale")e=`(${input("value")} * ${input("scale")})`;
 if(id==="vector.length")e=`length(${input("value")})`;
 if(id==="noise.turbulence")e=`turbulence(${input("uv")})`;
 if(id==="noise.turbulence3")e=`turbulence3(vec3(${input("x")}, ${input("y")}, ${input("z")}))`;
 cache.set(key,e);return e;
}
function shaderLibrary(){return `mat2 rot2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}\nfloat hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nvec2 hash2(vec2 p){return vec2(hash(p),hash(p+19.19));}\nfloat valueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}\nfloat fbmValue(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*valueNoise(p);p*=2.;a*=.5;}return v;}\nfloat simplexNoise(vec2 p){return valueNoise(p)*2.0-1.0;}\nfloat fbmSimplex(vec2 p){return fbmValue(p)*2.0-1.0;}\nfloat worleyNoise(vec2 p){vec2 i=floor(p),f=fract(p);float d=1.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 n=vec2(x,y),q=n+hash2(i+n)-f;d=min(d,length(q));}return d;}\nfloat fbmWorley(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*worleyNoise(p*6.);p*=2.;a*=.5;}return v;}\nfloat turbulence(vec2 p){return abs(fbmSimplex(p));}\nfloat sdBox(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}\nfloat segDist(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),.0001),0.,1.);return length(pa-ba*h);}\nfloat lanceTaper(float t){t=clamp(t,0.,1.);return smoothstep(0.,.08,t)*(1.-smoothstep(.15,1.,t));}\nfloat sdLance(vec2 p,float baseX,float tipX,float maxR){float t=clamp((p.x-baseX)/max(tipX-baseX,.0001),0.,1.);return abs(p.y)-maxR*lanceTaper(t);}\nfloat xFade(vec2 p,float baseX,float tipX){return smoothstep(baseX-8.,baseX+8.,p.x)*smoothstep(tipX+8.,tipX-8.,p.x);}\nvec2 cubic(vec2 p0,vec2 p1,vec2 p2,vec2 p3,float t){float u=1.-t;return u*u*u*p0+3.*u*u*t*p1+3.*u*t*t*p2+t*t*t*p3;}\nfloat bezier4(vec2 p0,vec2 p1,vec2 p2,vec2 p3,vec2 p4,float t){float u=1.-t;return (u*u*u*u*p0+4.*u*u*u*t*p1+6.*u*u*t*t*p2+4.*u*t*t*t*p3+t*t*t*t*p4).y;}\n`;}
const baseShaderLibrary = shaderLibrary;
// This is the same 3D simplex turbulence family used by Ming God.  Keeping it here makes a
// turbulence node preview show the spiral-coordinate structure, rather than a hash-like field.
shaderLibrary = () => `${baseShaderLibrary()}\nvec4 previewPermute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }\nfloat previewSimplex3(vec3 v) {\n    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);\n    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);\n    vec3 i = floor(v + dot(v, C.yyy));\n    vec3 x0 = v - i + dot(i, C.xxx);\n    vec3 g = step(x0.yzx, x0.xyz), l = 1.0 - g;\n    vec3 i1 = min(g.xyz, l.zxy), i2 = max(g.xyz, l.zxy);\n    vec3 x1 = x0 - i1 + C.xxx, x2 = x0 - i2 + C.yyy, x3 = x0 - D.yyy;\n    i = mod(i, 289.0);\n    vec4 p = previewPermute(previewPermute(previewPermute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));\n    float n = 0.142857142857; vec3 ns = n * D.wyz - D.xzx;\n    vec4 j = p - 49.0 * floor(p * ns.z * ns.z), x_ = floor(j * ns.z), y_ = floor(j - 7.0 * x_);\n    vec4 x = x_ * ns.x + ns.yyyy, y = y_ * ns.x + ns.yyyy, h = 1.0 - abs(x) - abs(y);\n    vec4 b0 = vec4(x.xy, y.xy), b1 = vec4(x.zw, y.zw);\n    vec4 s0 = floor(b0) * 2.0 + 1.0, s1 = floor(b1) * 2.0 + 1.0, sh = -step(h, vec4(0.0));\n    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy, a1 = b1.xzyw + s1.xzyw * sh.zzww;\n    vec3 p0 = vec3(a0.xy, h.x), p1 = vec3(a0.zw, h.y), p2 = vec3(a1.xy, h.z), p3 = vec3(a1.zw, h.w);\n    vec4 norm = 1.0 / vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3));\n    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;\n    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m *= m;\n    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));\n}\nfloat turbulence3(vec3 p) {\n    float value = 0.0, amplitude = 1.0, frequency = 1.0;\n    for (int i = 0; i < 6; i++) { value += amplitude * abs(previewSimplex3(p * frequency)); amplitude *= 0.5; frequency *= 2.0; }\n    return value * 0.5;\n}\n`;
function activeGraphNodeIds(graph) {
  const active=new Set(),visit=nodeId=>{if(active.has(nodeId))return;active.add(nodeId);graph.links.filter(link=>link.toNode===nodeId).forEach(link=>visit(link.fromNode));const node=graph.nodes.find(item=>item.id===nodeId);if(node?.typeId==="logic.variable"){const owner=variableBranchOwner(graph,node)?.ownerId,control=owner&&graph.nodes.find(item=>item.id===owner),input=control&&graph.links.find(link=>link.toNode===control.id&&link.toSocket===(control.typeId==="logic.for"?"count":"condition"));if(input)visit(input.fromNode);}};
  const finalNode=graphFinalNode(graph);if(finalNode)visit(finalNode.id);return active;
}
function extractShaderHelper(source,name) {
  const match=new RegExp(`(?:mat2|float|vec2|vec4)\\s+${name}\\s*\\(`).exec(source);if(!match)return "";const open=source.indexOf("{",match.index);let depth=0;for(let index=open;index<source.length;index++){if(source[index]==="{")depth++;if(source[index]==="}"&&!--depth)return source.slice(match.index,index+1);}return "";
}
function shaderLibraryFor(graph,active=activeGraphNodeIds(graph)) {
  const types=new Set(graph.nodes.filter(node=>active.has(node.id)).map(node=>node.typeId)),needed=new Set(),add=(...names)=>names.forEach(name=>needed.add(name));
  if(types.has("vector.rotate2d"))add("rot2");
  if(types.has("noise.value"))add("hash","valueNoise");
  if(types.has("noise.fbm"))add("hash","valueNoise","fbmValue");
  if(types.has("noise.simplex"))add("hash","valueNoise","simplexNoise");
  if(types.has("noise.fbmSimplex"))add("hash","valueNoise","fbmValue","fbmSimplex");
  if(types.has("noise.worley"))add("hash","hash2","worleyNoise");
  if(types.has("noise.fbmWorley"))add("hash","hash2","worleyNoise","fbmWorley");
  if(types.has("noise.turbulence"))add("hash","valueNoise","fbmValue","fbmSimplex","turbulence");
  if(types.has("noise.turbulence3"))add("previewPermute","previewSimplex3","turbulence3");
  if(types.has("sdf.box"))add("sdBox");if(types.has("sdf.segment"))add("segDist");if(types.has("sdf.lance"))add("lanceTaper","sdLance");if(types.has("shape.lanceTaper"))add("lanceTaper");if(types.has("shape.xFade"))add("xFade");if(types.has("curve.cubicBezier"))add("cubic");if(types.has("curve.quarticBezier"))add("bezier4");
  const source=shaderLibrary();return [...needed].map(name=>extractShaderHelper(source,name)).filter(Boolean).join("\n\n");
}
function mingGodSignFragmentSource(graph){const helpers=customHelpers(graph);return `#version 430

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform float u_duration;
uniform float u_progress;

vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = 1.0 / vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float turbulence(vec3 p) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
        value += amplitude * abs(snoise(p * frequency));
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value * 0.5;
}

${helpers}

void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 toCenter = 2.0 * (v_uv - center);
    float dist = length(toCenter);
    float angle = atan(toCenter.y, toCenter.x);
    float normalizedAngle = angle / (2.0 * 3.14159);
    float rotationOffset = u_time * 0.1;
    float contractionOffset = dist + u_time * 0.2;
    float combined = normalizedAngle + pow(dist, 0.36) - rotationOffset;
    float spiralValue = cos(combined * 3.14159 * 2.0);
    float fogNoise = pow(turbulence(vec3(spiralValue, contractionOffset, u_time * 0.1)), 0.5);
    float radialFadeValue = radialFade(dist);
    float innerFadeValue = innerFade(dist, u_time);
    vec3 color = vec3(1.0, 0.65, 0.75) * fogNoise * radialFadeValue * innerFadeValue;

    fragColor = vec4(color, max(1.0 - innerFadeValue, fogNoise * radialFadeValue * 0.8));
}
`;}
function customFunctionSource(definition) {
  const parameters=customParameters(definition);
  if(!parameters)return definition?.properties?.helperSource||"";
  const functionName=javaIdentifier(definition.properties?.functionName||customFunctionName(definition.title),"wf_custom_node");
  const signature=parameters.map(parameter=>`${parameter.qualifier} ${typeLabel(parameter.type)} ${parameter.name}`).join(", ");
  return `${definition.properties?.helperSource||""}\nvoid ${functionName}(${signature}) {\n${definition.properties?.code||""}\n}`;
}
function customHelpers(graph,active=null){return [...new Set(graph.nodes.filter(node=>node.typeId.startsWith("custom.")&&(!active||active.has(node.id))).map(node=>customFunctionSource(nodeDef(node))).filter(Boolean))].join("\n\n");}
function glslType(type){return typeLabel(type);}
function compileGraphExpression(graph,finalNode,socket){
  const refs=new Map(),statements=[],counters={},visiting=new Set(),initialized=new Set(),emittedControls=new Set(),sourceTypes=new Set(["input.uv","input.time","io.input","input.texture","logic.for"]);
  const inputLink=(node,name)=>graph.links.find(link=>link.toNode===node.id&&link.toSocket===name);
  const allocate=(type,prefix="")=>{
    const glsl=glslType(type),safe=glsl.replace(/[^A-Za-z0-9_]/g,"_"),counterKey=prefix?`${prefix}:${safe}`:safe;
    counters[counterKey]=(counters[counterKey]||0)+1;
    return prefix?`${prefix}_${safe}_${counters[counterKey]}`:`${safe}_${counters[counterKey]}`;
  };
  const initialExpression=node=>{const link=inputLink(node,"init");if(link)return expressionFor(graph,link.fromNode,link.fromSocket,refs);const type=nodeDef(node).outputs[0]?.type||"FLOAT";return type==="BOOL"?(String(node.properties.initialValue).toLowerCase()==="true"?"true":"false"):constantExpression({properties:{value:node.properties.initialValue}},type);};
  const indent=lines=>lines.map(line=>line.replace(/^    /,"        "));
  const ensureVariable=node=>{if(initialized.has(node.id))return;const owner=variableBranchOwner(graph,node),members=owner?graph.nodes.filter(item=>item.typeId==="logic.variable"&&variableBranchOwner(graph,item)?.ownerId===owner.ownerId):[node];members.forEach(member=>{if(initialized.has(member.id))return;const init=inputLink(member,"init");if(init)visit(init.fromNode,init.fromSocket);initialized.add(member.id);const type=glslType(nodeDef(member).outputs[0]?.type);statements.push(`    ${type} wf_var_${javaIdentifier(member.id)} = ${initialExpression(member)};`);refs.set(`${member.id}:value`, `wf_var_${javaIdentifier(member.id)}`);});if(!owner||emittedControls.has(owner.ownerId))return;const control=graph.nodes.find(item=>item.id===owner.ownerId),controlInput=inputLink(control,control.typeId==="logic.for"?"count":"condition");if(controlInput)visit(controlInput.fromNode,controlInput.fromSocket);const collect=branch=>{const start=statements.length;members.filter(member=>variableBranchOwner(graph,member)?.branch===branch).forEach(member=>{const value=inputLink(member,"value");if(value)visit(value.fromNode,value.fromSocket);});const declarations=statements.splice(start);const assignments=members.filter(member=>variableBranchOwner(graph,member)?.branch===branch).map(member=>{const value=inputLink(member,"value");return `        wf_var_${javaIdentifier(member.id)} = ${value?expressionFor(graph,value.fromNode,value.fromSocket,refs):initialExpression(member)};`;});return [...indent(declarations),...assignments].join("\n");};
    if(control.typeId==="logic.for"){const body=collect("loop"),count=controlInput?expressionFor(graph,controlInput.fromNode,controlInput.fromSocket,refs):"0.0",index=`wf_loop_i_${javaIdentifier(control.id)}`;statements.push(`    for (int ${index} = 0; ${index} < int(max(0.0, ${count})); ++${index}) {\n${body}\n    }`);}else{const yes=collect("true"),no=collect("false"),condition=controlInput?expressionFor(graph,controlInput.fromNode,controlInput.fromSocket,refs):"false";statements.push(`    if (${condition}) {\n${yes}\n    } else {\n${no}\n    }`);}emittedControls.add(owner.ownerId);};
  const emitCustom=(node,definition)=>{
    const parameters=customParameters(definition);if(!parameters)return false;
    const argumentsList=[];
    parameters.forEach(parameter=>{const link=inputLink(node,parameter.name),inputValue=link?visit(link.fromNode,link.fromSocket):zeroFor(parameter.type);if(parameter.qualifier==="in"){argumentsList.push(inputValue);return;}const local=allocate(parameter.type,"wf_custom");statements.push(`    ${glslType(parameter.type)} ${local} = ${parameter.qualifier==="inout"?inputValue:zeroFor(parameter.type)};`);argumentsList.push(local);refs.set(`${node.id}:${parameter.name}`,local);});
    statements.push(`    ${javaIdentifier(definition.properties?.functionName||customFunctionName(definition.title),"wf_custom_node")}(${argumentsList.join(", ")});`);
    return true;
  };
  const visit=(nodeId,outputSocket)=>{const key=`${nodeId}:${outputSocket}`;if(refs.has(key))return refs.get(key);if(visiting.has(key))return"0.0";const node=graph.nodes.find(item=>item.id===nodeId),definition=node&&nodeDef(node);if(!node||!definition)return"0.0";visiting.add(key);if(node.typeId==="logic.variable"){ensureVariable(node);visiting.delete(key);return refs.get(key)||`wf_var_${javaIdentifier(node.id)}`;}if(node.typeId.startsWith("custom.")&&customParameters(definition)){emitCustom(node,definition);visiting.delete(key);return refs.get(key)||zeroFor(definition.outputs.find(port=>port.name===outputSocket)?.type);}graph.links.filter(link=>link.toNode===nodeId).forEach(link=>visit(link.fromNode,link.fromSocket));const expression=expressionFor(graph,nodeId,outputSocket,refs);visiting.delete(key);if(sourceTypes.has(node.typeId)||node.typeId==="io.output"){refs.set(key,expression);return expression;}const outputType=definition.outputs.find(port=>port.name===outputSocket)?.type,name=allocate(outputType);statements.push(`    ${glslType(outputType)} ${name} = ${expression};`);refs.set(key,name);return name;};
  return {expression:visit(finalNode.id,socket),statements};
}
function branchVariableCode(graph){
  const variables=graph.nodes.filter(node=>node.typeId==="logic.variable");
  const initial=node=>{
    const link=graph.links.find(item=>item.toNode===node.id&&item.toSocket==="init");
    if(link)return expressionFor(graph,link.fromNode,link.fromSocket);
    const type=nodeDef(node).outputs[0]?.type||"FLOAT";
    if(type==="BOOL")return String(node.properties.initialValue).toLowerCase()==="true"?"true":"false";
    const value=Number(node.properties.initialValue);
    return Number.isFinite(value)?value.toFixed(4):zeroFor(type);
  };
  const declarations=variables.map(node=>`    ${glslType(nodeDef(node).outputs[0]?.type)} wf_var_${javaIdentifier(node.id)} = ${initial(node)};`);
  const blocks=graph.nodes.filter(node=>node.typeId==="logic.if").map(ifNode=>{
    const conditionLink=graph.links.find(link=>link.toNode===ifNode.id&&link.toSocket==="condition");
    const condition=conditionLink?expressionFor(graph,conditionLink.fromNode,conditionLink.fromSocket):"false";
    const members=variables.filter(node=>variableBranchOwner(graph,node)?.ownerId===ifNode.id);
    const assignment=branch=>members.filter(node=>variableBranchOwner(graph,node)?.branch===branch).map(node=>{
      const link=graph.links.find(item=>item.toNode===node.id&&item.toSocket==="value");
      return `        wf_var_${javaIdentifier(node.id)} = ${link?expressionFor(graph,link.fromNode,link.fromSocket):initial(node)};`;
    }).join("\n");
    return `    if (${condition}) {\n${assignment("true")}\n    } else {\n${assignment("false")}\n    }`;
  }).concat(graph.nodes.filter(node=>node.typeId==="logic.for").map(loopNode=>{const countLink=graph.links.find(link=>link.toNode===loopNode.id&&link.toSocket==="count"),count=countLink?expressionFor(graph,countLink.fromNode,countLink.fromSocket):"0.0",index=`wf_loop_i_${javaIdentifier(loopNode.id)}`,members=variables.filter(node=>variableBranchOwner(graph,node)?.ownerId===loopNode.id),assignment=members.map(node=>{const link=graph.links.find(item=>item.toNode===node.id&&item.toSocket==="value");return `        wf_var_${javaIdentifier(node.id)} = ${link?expressionFor(graph,link.fromNode,link.fromSocket):initial(node)};`;}).join("\n");return `    for (int ${index} = 0; ${index} < int(max(0.0, ${count})); ++${index}) {\n${assignment}\n    }`; }));
  return {declarations,blocks};
}
function graphFinalNode(graph){const explicit=graph.nodes.find(node=>node.id===graph.outputNodeId)||graph.nodes.find(node=>node.typeId==="io.output");if(explicit)return explicit;const outgoing=new Set(graph.links.map(link=>link.fromNode)),terminals=graph.nodes.filter(node=>nodeDef(node)?.outputs?.length&&!outgoing.has(node.id));return terminals.sort((a,b)=>b.canvasX-a.canvasX||b.canvasY-a.canvasY)[0]||graph.nodes[graph.nodes.length-1];}
function fragmentSource(graph){const active=activeGraphNodeIds(graph),uniforms=graphInputs(graph).map(input=>`uniform ${glslType(input.type)} ${input.name};`).join("\n"),textures=graphTextureInputs(graph).filter(input=>active.has(input.nodeId)).map(input=>`uniform sampler2D ${input.name};`).join("\n"),finalNode=graphFinalNode(graph),d=finalNode&&nodeDef(finalNode),socket=finalNode?.typeId==="io.output"?"color":d?.outputs[0]?.name||"value",compiled=finalNode?compileGraphExpression(graph,finalNode,socket):{expression:"0.0",statements:[]},type=finalNode?.typeId==="io.output"?"VEC4":d?.outputs[0]?.type||"FLOAT",color=type==="VEC4"?compiled.expression:type==="SAMPLER2D"?`${textureSampleName(compiled.expression)}(${compiled.expression}, v_uv)`:type==="VEC3"?`vec4(${compiled.expression}, 1.0)`:type==="VEC2"?`vec4(${compiled.expression} * 0.5 + 0.5, 0.5, 1.0)`:type==="BOOL"?`vec4(vec3(${compiled.expression}?1.0:0.0),1.0)`:`vec4(vec3(${compiled.expression}), 1.0)`;return `#version 420\nin vec2 v_uv;\nout vec4 fragColor;\nuniform float u_time;\n${uniforms}\n${textures}\n${textureSamplingFunctions({...graph,nodes:graph.nodes.filter(node=>active.has(node.id))})}\n\n${shaderLibraryFor(graph,active)}\n${customHelpers(graph,active)}\n\nvoid main() {\n${compiled.statements.join("\n")}\n    fragColor = ${color};\n}\n`;}
function vertexSource(transform=currentVertexTransform()){const sx=Number(transform.sx)||1,sy=Number(transform.sy)||1,tx=Number(transform.tx)||0,ty=Number(transform.ty)||0,radians=(Number(transform.rotation)||0)*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);return `#version 420
layout(location = 0) in vec2 a_position;

// BoxUtil is used only here for the game viewport-to-clip-space matrix.
layout(std140, binding = 0) uniform BUtilGlobalData {
    mat4 gameViewport;
    vec4 gameScreenBorder;
};

uniform mat4 modelMatrix;
uniform vec2 size;

out vec2 v_uv;

void main() {
    v_uv = (a_position + 1.0) * 0.5;
    vec4 resized = vec4(a_position * size * 0.5, 0.0, 1.0);
    vec2 workflowScale = vec2(${sx.toFixed(6)}, ${sy.toFixed(6)});
    mat2 workflowRotation = mat2(${c.toFixed(6)}, ${s.toFixed(6)}, -${s.toFixed(6)}, ${c.toFixed(6)});
    vec2 workflowTranslation = vec2(${tx.toFixed(6)}, ${ty.toFixed(6)});
    vec4 workflowPosition = vec4(workflowRotation * (resized.xy * workflowScale) + workflowTranslation, 0.0, 1.0);
    gl_Position = gameViewport * vec4((modelMatrix * workflowPosition).xy, 0.0, 1.0);
}
`;}
function pluginSource(config){return `package data.scripts;\n\nimport com.fs.starfarer.api.Global;\nimport com.fs.starfarer.api.combat.*;\nimport org.boxutil.manager.ShaderCore;\nimport org.boxutil.units.standard.ShaderProgram;\nimport org.boxutil.util.ShaderUtil;\nimport org.lwjgl.BufferUtils;\nimport org.lwjgl.opengl.*;\nimport org.lwjgl.util.vector.Vector2f;\nimport java.nio.FloatBuffer;\n\n/** Generated workflow renderer. Requires Starsector + BoxUtil. */\npublic final class ${config.className} extends BaseCombatLayeredRenderingPlugin {\n  private final Vector2f position=new Vector2f(); private final float[] vertices; private final CombatEngineLayers targetLayer;\n  private ShaderProgram program; private int vao,vbo; private FloatBuffer matrix; private float elapsed; private boolean expired;\n  public ${config.className}(float x0,float y0,float x1,float y1,float x2,float y2,float x3,float y3,CombatEngineLayers layer){ vertices=new float[]{x0,y0,x1,y1,x2,y2,x3,y3}; targetLayer=layer; }\n  public void setPosition(float x,float y){position.set(x,y);}\n  @Override public EnumSet<CombatEngineLayers> getActiveLayers(){return EnumSet.of(targetLayer);}\n  @Override public void init(CombatEntityAPI entity){super.init(entity);int id=ShaderUtil.createShaderVFFormPath(getClass().getName(),"${config.shaderDir}/${config.className}.vert","${config.shaderDir}/${config.className}.frag");if(id<=0){expired=true;return;}program=new ShaderProgram(id);program.location=new int[]{program.getUniformIndex("modelMatrix"),program.getUniformIndex("u_time")};program.uboLocation=new int[]{program.getUBOIndex("BUtilGlobalData",ShaderCore.getMatrixUBOBinding())};createVao();}\n  @Override public void advance(float amount){if(!Global.getCombatEngine().isPaused())elapsed+=amount;}\n  @Override public boolean isExpired(){return expired;}\n  @Override public float getRenderRadius(){return 10000f;}\n  @Override public void render(CombatEngineLayers layer,ViewportAPI viewport){if(expired||program==null)return;matrix=matrix(position.x,position.y,0f,matrix);int previous=GL11.glGetInteger(GL20.GL_CURRENT_PROGRAM);try{GL11.glEnable(GL11.GL_BLEND);GL14.glBlendFuncSeparate(GL11.GL_SRC_ALPHA,GL11.GL_ONE,GL11.GL_ONE,GL11.GL_ONE);GL30.glBindVertexArray(vao);program.active();GL20.glUniformMatrix4(program.location[0],false,matrix);GL20.glUniform1f(program.location[1],elapsed);GL11.glDrawArrays(GL11.GL_TRIANGLE_STRIP,0,4);program.close();}finally{GL20.glUseProgram(previous);GL30.glBindVertexArray(0);}}\n  @Override public void cleanup(){expired=true;if(vao>0)GL30.glDeleteVertexArrays(vao);if(vbo>0)GL15.glDeleteBuffers(vbo);if(program!=null)program.delete();}\n  private void createVao(){FloatBuffer data=BufferUtils.createFloatBuffer(16);for(int i=0;i<4;i++)data.put(vertices[i*2]).put(vertices[i*2+1]).put((i&1)==0?0f:1f).put(i<2?0f:1f);data.flip();vao=GL30.glGenVertexArrays();GL30.glBindVertexArray(vao);vbo=GL15.glGenBuffers();GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER,vbo);GL15.glBufferData(GL15.GL_ARRAY_BUFFER,data,GL15.GL_STATIC_DRAW);GL20.glVertexAttribPointer(0,2,GL11.GL_FLOAT,false,16,0);GL20.glEnableVertexAttribArray(0);GL20.glVertexAttribPointer(1,2,GL11.GL_FLOAT,false,16,8);GL20.glEnableVertexAttribArray(1);GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER,0);GL30.glBindVertexArray(0);}\n  private static FloatBuffer matrix(float x,float y,float angle,FloatBuffer out){if(out==null)out=BufferUtils.createFloatBuffer(16);float r=(float)Math.toRadians(angle),c=(float)Math.cos(r),s=(float)Math.sin(r);out.clear();out.put(c).put(s).put(0).put(0).put(-s).put(c).put(0).put(0).put(0).put(0).put(1).put(0).put(x).put(y).put(0).put(1).flip();return out;}\n}\n`;}
/* Legacy exporter retained only as historical source while the BoxUtil exporter below overrides it.
import com.fs.starfarer.api.combat.CombatEngineLayers;
import com.fs.starfarer.api.combat.CombatEntityAPI;
import com.fs.starfarer.api.combat.ViewportAPI;
import com.fs.starfarer.api.graphics.SpriteAPI;
import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.util.EnumSet;
import org.apache.log4j.Logger;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.GL11;
import org.lwjgl.opengl.GL13;
import org.lwjgl.opengl.GL15;
import org.lwjgl.opengl.GL20;
import org.lwjgl.opengl.GL30;
import org.lwjgl.util.vector.Vector2f;

/**
 * Generated by Workflow Shader Editor.
 *
 * <p>Runtime flow is aligned with Meng_MingGodSignPlugin: shader resources are
 * loaded directly from the mod, geometry is drawn through a VAO, and the current
 * GL attribute state is bracketed by glPushAttrib/glPopAttrib.</p>
 * <p>The vertex shader may use the BoxUtil BUtilGlobalData matrix UBO; Java does
 * not use BoxUtil runtime wrappers.</p>
 * /
public final class ${config.className} extends BaseCombatLayeredRenderingPlugin {

    private static final Logger LOG = Global.getLogger(${config.className}.class);

    private static final String VERTEX_SHADER = "${config.shaderDir}/${config.className}.vert";
    private static final String FRAGMENT_SHADER = "${config.shaderDir}/${config.className}.frag";

    private final Vector2f position = new Vector2f();
    private final CombatEngineLayers targetLayer;
    private final float width;
    private final float height;

    private int shaderProgram;
    private VaoData vao;
    private int modelMatrixLocation;
    private int timeLocation;
    private int sizeLocation;
${inputLocations}
    private float angle;
    private float elapsed;
    private boolean expired;
${inputFields}

    /**
     * Four explicit local-space vertices define the render bounds. The standard Meng
     * VAO is scaled to their axis-aligned bounds; arbitrary non-rectangular geometry
     * should use the workflow runtime mesh export added in a later mesh pass.
     * /
    public ${config.className}(
            float x0, float y0,
            float x1, float y1,
            float x2, float y2,
            float x3, float y3,
            CombatEngineLayers layer${constructorSuffix}) {
        this.targetLayer = layer;
        float minX = Math.min(Math.min(x0, x1), Math.min(x2, x3));
        float maxX = Math.max(Math.max(x0, x1), Math.max(x2, x3));
        float minY = Math.min(Math.min(y0, y1), Math.min(y2, y3));
        float maxY = Math.max(Math.max(y0, y1), Math.max(y2, y3));
        this.width = maxX - minX;
        this.height = maxY - minY;
${inputAssignments}
    }

    public void setPosition(float x, float y) {
        position.set(x, y);
    }

    public void setAngle(float degrees) {
        angle = degrees;
    }

    @Override
    public void init(CombatEntityAPI entity) {
        super.init(entity);
        try {
            shaderProgram = createShaderProgramFromFiles(
                    VERTEX_SHADER, FRAGMENT_SHADER, getClass().getSimpleName());
            if (shaderProgram <= 0) {
                throw new IllegalStateException("Shader compilation/linking failed");
            }

            int[] locations = getUniformLocations(
                    shaderProgram, "modelMatrix", "u_time", "size");
            modelMatrixLocation = locations[0];
            timeLocation = locations[1];
            sizeLocation = locations[2];
${inputLocationAssignments}
            vao = createUniversalRectVAO();
        } catch (Exception ex) {
            Global.getLogger(${config.className}.class).error("Generated workflow shader disabled", ex);
            expired = true;
        }
    }

    @Override
    public EnumSet<CombatEngineLayers> getActiveLayers() {
        return EnumSet.of(targetLayer);
    }

    @Override
    public void advance(float amount) {
        if (!Global.getCombatEngine().isPaused()) {
            elapsed += amount;
        }
    }

    @Override
    public float getRenderRadius() {
        return (float) Math.hypot(width * 0.5f, height * 0.5f);
    }

    @Override
    public boolean isExpired() {
        return expired;
    }

    @Override
    public void render(CombatEngineLayers layer, ViewportAPI viewport) {
        if (expired || shaderProgram <= 0 || vao == null || layer != targetLayer) {
            return;
        }

        GL11.glPushAttrib(GL11.GL_ALL_ATTRIB_BITS);
        try {
            GL11.glEnable(GL11.GL_BLEND);
            GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
            GL20.glUseProgram(shaderProgram);

            FloatBuffer modelMatrix = buildModelMatrix(
                    position.x, position.y, angle);
            GL20.glUniformMatrix4(modelMatrixLocation, false, modelMatrix);
            GL20.glUniform2f(sizeLocation, width, height);
            GL20.glUniform1f(timeLocation, elapsed);
${inputUploads}
            drawVAOQuad(vao.vaoId);

            GL20.glUseProgram(0);
        } finally {
            GL11.glPopAttrib();
        }
    }

    @Override
    public void cleanup() {
        expired = true;
        cleanupAll(shaderProgram, vao);
        shaderProgram = 0;
        vao = null;
    }

    // Self-contained extraction of the ShaderUtil methods used by Meng_MingGodSignPlugin.
    private static int createShaderProgramFromFiles(String vertPath, String fragPath, String logTag) {
        try {
            return createShaderProgram(
                    Global.getSettings().loadText(vertPath),
                    Global.getSettings().loadText(fragPath), logTag);
        } catch (Exception ex) {
            LOG.error("[" + logTag + "] Failed to load shader resources: "
                    + vertPath + ", " + fragPath, ex);
            return 0;
        }
    }

    private static int createShaderProgram(String vertexSource, String fragmentSource, String logTag) {
        int vertex = compileShader(vertexSource, GL20.GL_VERTEX_SHADER, logTag);
        int fragment = compileShader(fragmentSource, GL20.GL_FRAGMENT_SHADER, logTag);
        if (vertex == 0 || fragment == 0) {
            if (vertex != 0) GL20.glDeleteShader(vertex);
            if (fragment != 0) GL20.glDeleteShader(fragment);
            return 0;
        }

        int program = GL20.glCreateProgram();
        GL20.glAttachShader(program, vertex);
        GL20.glAttachShader(program, fragment);
        GL20.glBindAttribLocation(program, 0, "a_position");
        GL20.glLinkProgram(program);
        GL20.glDeleteShader(vertex);
        GL20.glDeleteShader(fragment);

        if (GL20.glGetProgrami(program, GL20.GL_LINK_STATUS) == 0) {
            LOG.error("[" + logTag + "] Shader program link failed: "
                    + GL20.glGetProgramInfoLog(program, 4096));
            GL20.glDeleteProgram(program);
            return 0;
        }
        return program;
    }

    private static int compileShader(String source, int type, String logTag) {
        int shader = GL20.glCreateShader(type);
        GL20.glShaderSource(shader, source);
        GL20.glCompileShader(shader);
        if (GL20.glGetShaderi(shader, GL20.GL_COMPILE_STATUS) == 0) {
            LOG.error("[" + logTag + "] Shader compile failed: "
                    + GL20.glGetShaderInfoLog(shader, 4096));
            GL20.glDeleteShader(shader);
            return 0;
        }
        return shader;
    }

    private static int[] getUniformLocations(int program, String... names) {
        int[] locations = new int[names.length];
        for (int i = 0; i < names.length; i++) {
            locations[i] = GL20.glGetUniformLocation(program, names[i]);
        }
        return locations;
    }

    private static VaoData createUniversalRectVAO() {
        ByteBuffer vertices = ByteBuffer.allocateDirect(8);
        vertices.put(new byte[] { -128, -128, 127, -128, -128, 127, 127, 127 });
        vertices.flip();

        int vaoId = GL30.glGenVertexArrays();
        GL30.glBindVertexArray(vaoId);
        int vboId = GL15.glGenBuffers();
        GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER, vboId);
        GL15.glBufferData(GL15.GL_ARRAY_BUFFER, vertices, GL15.GL_STATIC_DRAW);
        GL20.glVertexAttribPointer(0, 2, GL11.GL_BYTE, true, 2, 0);
        GL20.glEnableVertexAttribArray(0);
        GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER, 0);
        GL30.glBindVertexArray(0);
        return new VaoData(vaoId, vboId);
    }

    private static FloatBuffer buildModelMatrix(float x, float y, float angleDeg) {
        float radians = (float) Math.toRadians(angleDeg);
        float sine = (float) Math.sin(radians);
        float cosine = (float) Math.cos(radians);
        FloatBuffer matrix = BufferUtils.createFloatBuffer(16);
        matrix.put(cosine).put(sine).put(0f).put(0f);
        matrix.put(-sine).put(cosine).put(0f).put(0f);
        matrix.put(0f).put(0f).put(1f).put(0f);
        matrix.put(x).put(y).put(0f).put(1f);
        matrix.flip();
        return matrix;
    }

    private static void drawVAOQuad(int vaoId) {
        GL30.glBindVertexArray(vaoId);
        GL11.glDrawArrays(GL11.GL_TRIANGLE_STRIP, 0, 4);
        GL30.glBindVertexArray(0);
    }

    private static void cleanupAll(int program, VaoData vao) {
        if (program != 0) GL20.glDeleteProgram(program);
        if (vao != null) {
            if (vao.vaoId != 0) GL30.glDeleteVertexArrays(vao.vaoId);
            if (vao.vboId != 0) GL15.glDeleteBuffers(vao.vboId);
        }
    }

    private static final class VaoData {
        private final int vaoId;
        private final int vboId;

        private VaoData(int vaoId, int vboId) {
            this.vaoId = vaoId;
            this.vboId = vboId;
        }
    }
}
`;};
*/
// BoxUtil-native runtime template. This intentionally replaces the legacy self-contained
// exporter above: generated plugins must use the same ShaderProgram/UBO/default-quad path as
// the current MingGod renderers, rather than embedding a second shader utility implementation.
pluginSource = (config, graph = null) => {
  const inputs=graphInputs(graph || {nodes:[]}),textures=graphTextureInputs(graph || {nodes:[]});
  const key=input=>typeKey(input.type);
  const javaType=input=>({BOOL:"boolean",INT:"int",UINT:"int",FLOAT:"float",VEC2:"Vector2f",VEC3:"Vector3f",VEC4:"Vector4f"})[key(input)] || "float";
  const fields=[...inputs.map(input=>`    private final ${javaType(input)} ${input.name};`),...textures.map(input=>`    private final SpriteAPI ${input.parameter};`)].join("\n");
  const parameters=[...inputs.map(input=>`            ${javaType(input)} ${input.name}`),...textures.map(input=>`            SpriteAPI ${input.parameter}`)].join(",\n");
  const assignments=[...inputs.map(input=>`        this.${input.name} = ${input.name};`),...textures.map(input=>`        this.${input.parameter} = ${input.parameter};`)].join("\n");
  const locationFields=[...inputs.map(input=>`    private int ${input.name}Location;`),...textures.map(input=>`    private int ${input.name}Location;\n    private int ${textureAspectUniformName(input.name)}Location;`)].join("\n");
  const locationSetup=[...inputs.map(input=>`        ${input.name}Location = shaderProgram.getUniformIndex("${input.name}");`),...textures.map(input=>`        ${input.name}Location = shaderProgram.getUniformIndex("${input.name}");\n        ${textureAspectUniformName(input.name)}Location = shaderProgram.getUniformIndex("${textureAspectUniformName(input.name)}");`)].join("\n");
  const inputUploads=inputs.map(input=>{const type=key(input),guard=`${input.name}Location >= 0`;if(type==="BOOL")return `        if (${guard}) GL20.glUniform1i(${input.name}Location, ${input.name} ? 1 : 0);`;if(type==="INT")return `        if (${guard}) GL20.glUniform1i(${input.name}Location, ${input.name});`;if(type==="UINT")return `        if (${guard}) GL30.glUniform1ui(${input.name}Location, ${input.name});`;if(type==="VEC2")return `        if (${guard} && ${input.name} != null) GL20.glUniform2f(${input.name}Location, ${input.name}.x, ${input.name}.y);`;if(type==="VEC3")return `        if (${guard} && ${input.name} != null) GL20.glUniform3f(${input.name}Location, ${input.name}.x, ${input.name}.y, ${input.name}.z);`;if(type==="VEC4")return `        if (${guard} && ${input.name} != null) GL20.glUniform4f(${input.name}Location, ${input.name}.x, ${input.name}.y, ${input.name}.z, ${input.name}.w);`;return `        if (${guard}) GL20.glUniform1f(${input.name}Location, ${input.name});`;}).join("\n");
  const textureUploads=textures.map((input,index)=>`        if (${input.parameter} != null && ${input.name}Location >= 0) {
            GL13.glActiveTexture(GL13.GL_TEXTURE0 + ${index});
            GL11.glBindTexture(GL11.GL_TEXTURE_2D, ${input.parameter}.getTextureId());
            GL20.glUniform1i(${input.name}Location, ${index});
            if (${textureAspectUniformName(input.name)}Location >= 0) {
                GL20.glUniform2f(${textureAspectUniformName(input.name)}Location, ${input.parameter}.getWidth(), ${input.parameter}.getHeight());
            }
        }`).join("\n");
  const textureCleanup=textures.length?`        for (int textureUnit = 0; textureUnit < ${textures.length}; textureUnit++) {
            GL13.glActiveTexture(GL13.GL_TEXTURE0 + textureUnit);
            GL11.glBindTexture(GL11.GL_TEXTURE_2D, 0);
        }
        GL13.glActiveTexture(GL13.GL_TEXTURE0);`:"";
  const suffix=parameters?`,\n${parameters}`:"";
  return `package data.scripts;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.combat.*;
import com.fs.starfarer.api.graphics.SpriteAPI;
import java.util.EnumSet;
import org.boxutil.base.BaseTemporaryCleanupPlugin;
import org.boxutil.base.api.SimpleVAOAPI;
import org.boxutil.manager.CombatRenderingManager;
import org.boxutil.manager.ShaderCore;
import org.boxutil.units.standard.ShaderProgram;
import org.boxutil.util.CommonUtil;
import org.boxutil.util.ShaderUtil;
import org.boxutil.util.TransformUtil;
import org.lwjgl.opengl.GL11;
import org.lwjgl.opengl.GL13;
import org.lwjgl.opengl.GL20;
import org.lwjgl.opengl.GL30;
import org.lwjgl.util.vector.Matrix4f;
import org.lwjgl.util.vector.Vector2f;
import org.lwjgl.util.vector.Vector3f;
import org.lwjgl.util.vector.Vector4f;

/** Generated BoxUtil shader renderer. */
public final class ${config.className} implements CombatLayeredRenderingPlugin {

    private static final String VERTEX_SHADER = "${config.shaderDir}/${config.className}.vert";
    private static final String FRAGMENT_SHADER = "${config.shaderDir}/${config.className}.frag";

    private final CombatEngineLayers targetLayer;
    private final Vector2f position = new Vector2f();
    private final Vector2f renderPosition = new Vector2f();
    private final Matrix4f modelMatrix = new Matrix4f();
    private final float width;
    private final float height;
    private final float localCenterX;
    private final float localCenterY;
${fields}

    private ShaderProgram shaderProgram;
    private int modelMatrixLocation;
    private int sizeLocation;
    private int timeLocation;
${locationFields}
    private float angle;
    private float elapsed;
    private boolean expired;
    private boolean gpuResourcesReleased;

    /**
     * Vertex order is left-bottom, right-bottom, left-top, right-top. It must describe an
     * axis-aligned rectangle because BoxUtil's shared quad is scaled by its bounding extent.
     */
    public ${config.className}(
            float x0, float y0, float x1, float y1,
            float x2, float y2, float x3, float y3,
            CombatEngineLayers layer${suffix}) {
        targetLayer = layer;
        float minX = Math.min(Math.min(x0, x1), Math.min(x2, x3));
        float maxX = Math.max(Math.max(x0, x1), Math.max(x2, x3));
        float minY = Math.min(Math.min(y0, y1), Math.min(y2, y3));
        float maxY = Math.max(Math.max(y0, y1), Math.max(y2, y3));
        width = maxX - minX;
        height = maxY - minY;
        localCenterX = (minX + maxX) * 0.5f;
        localCenterY = (minY + maxY) * 0.5f;
${assignments}
    }

    public void setPosition(float x, float y) { position.set(x, y); }
    public void setAngle(float degrees) { angle = degrees; }
    public void markExpired() { expired = true; }

    @Override
    public void init(CombatEntityAPI entity) {
        createShaderProgram();
        if (shaderProgram != null) {
            CombatRenderingManager.addCleanupPlugin(new RendererCleanupPlugin(this));
        }
    }

    private void createShaderProgram() {
        int programId = ShaderUtil.createShaderVFFormPath(
                ${config.className}.class.getName(), VERTEX_SHADER, FRAGMENT_SHADER);
        if (programId <= 0) {
            expired = true;
            return;
        }
        shaderProgram = new ShaderProgram(programId);
        shaderProgram.location = new int[] {
                shaderProgram.getUniformIndex("modelMatrix"),
                shaderProgram.getUniformIndex("size"),
                shaderProgram.getUniformIndex("u_time")
        };
        shaderProgram.uboLocation = new int[] {
                shaderProgram.getUBOIndex("BUtilGlobalData", ShaderCore.getMatrixUBOBinding())
        };
        modelMatrixLocation = shaderProgram.location[0];
        sizeLocation = shaderProgram.location[1];
        timeLocation = shaderProgram.location[2];
${locationSetup}
    }

    @Override
    public void advance(float amount) {
        if (!Global.getCombatEngine().isPaused()) elapsed += amount;
    }

    @Override public boolean isExpired() { return expired; }
    @Override public EnumSet<CombatEngineLayers> getActiveLayers() { return EnumSet.of(targetLayer); }
    @Override
    public float getRenderRadius() {
        // position is the caller's local-space origin, not necessarily the quad center.
        return (float) Math.hypot(
                Math.abs(localCenterX) + width * 0.5f,
                Math.abs(localCenterY) + height * 0.5f);
    }

    @Override
    public void render(CombatEngineLayers layer, ViewportAPI viewport) {
        if (expired || layer != targetLayer || shaderProgram == null || width <= 0f || height <= 0f) return;
        SimpleVAOAPI quad = ShaderCore.getDefaultQuadObject();
        if (quad == null || !quad.isValid()) return;

        GL11.glPushAttrib(GL11.GL_ALL_ATTRIB_BITS);
        try {
            GL11.glEnable(GL11.GL_BLEND);
            GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
            shaderProgram.active();
            renderPosition.set(position.x + localCenterX, position.y + localCenterY);
            TransformUtil.createModelMatrixVanilla(renderPosition, angle, modelMatrix);
            GL20.glUniformMatrix4(modelMatrixLocation, false, CommonUtil.createFloatBuffer(modelMatrix));
            GL20.glUniform2f(sizeLocation, width, height);
            GL20.glUniform1f(timeLocation, elapsed);
${inputUploads}
${textureUploads}
            quad.glBind();
            try {
                quad.glDraw();
            } finally {
                quad.glReleaseBind();
            }
        } finally {
${textureCleanup}
            if (shaderProgram != null) shaderProgram.close();
            GL11.glPopAttrib();
        }
    }

    @Override public void cleanup() { expired = true; releaseGpuResources(); }

    private synchronized void releaseGpuResources() {
        if (gpuResourcesReleased) return;
        gpuResourcesReleased = true;
        if (shaderProgram != null) {
            shaderProgram.delete();
            shaderProgram = null;
        }
    }

    private static final class RendererCleanupPlugin extends BaseTemporaryCleanupPlugin {
        private final ${config.className} renderer;
        private RendererCleanupPlugin(${config.className} renderer) { this.renderer = renderer; }
        @Override public void cleanupCombatOnce() { renderer.releaseGpuResources(); }
    }
}
`;
};
function hasConnectedFragmentOutput(graph) { return graph.nodes.some(node=>node.typeId==="io.output"&&graph.links.some(link=>link.toNode===node.id&&link.toSocket==="color"&&graph.nodes.some(source=>source.id===link.fromNode))); }
function exportReadiness(graph, config=projectConfig()) {
  if(!hasConnectedFragmentOutput(graph)) return {ready:false, message:"未连接片段输出：请将结果连接到“片段输出”的 color 输入端口。"};
  try {
    if(!validJavaClassName(config.className)) throw new Error(`Java 类名无效：${config.className}。请使用非关键字的字母、数字或下划线名称，且不能以数字开头。`);
    validateGraphProperties(graph);
    validateRuntimeInputs(graph);
    return {ready:true, message:"片段输出已连接，参数校验通过，可导出运行文件。"};
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
  const supported=new Set(["BOOL","INT","UINT","FLOAT","VEC2","VEC3","VEC4"]),inputs=graphInputs(graph),textures=graphTextureInputs(graph),unsupported=inputs.filter(input=>!supported.has(typeKey(input.type)));
  if(unsupported.length)throw new Error(`当前 Java Plugin 的公共 uniform 参数不支持：${unsupported.map(input=>`${input.name}: ${typeLabel(input.type)}`).join("，")}。请改用 bool/int/uint/float/vec2/vec3/vec4，或先在工作流内部转换。`);
  const declarations=[];
  graph.nodes.filter(node=>node.typeId==="io.input").forEach(node=>declarations.push({name:inputUniformName(node),type:typeKey(nodeDef(node)?.outputs[0]?.type),source:node.title||node.id}));
  graph.nodes.filter(node=>node.typeId==="input.texture").forEach(node=>{
    const name=inputUniformName(node);declarations.push({name,type:"SAMPLER2D",source:node.title||node.id});declarations.push({name:textureAspectUniformName(name),type:"VEC2",source:`${node.title||node.id} 的纹理尺寸`});
  });
  const reserved=new Set(["u_time"]),byName=new Map();
  declarations.forEach(declaration=>{
    if(reserved.has(declaration.name))throw new Error(`uniform 名称 ${declaration.name} 由运行时保留，用于时间推进，不能作为自定义输入。`);
    const existing=byName.get(declaration.name);if(existing&&existing.type!==declaration.type)throw new Error(`uniform 名称冲突：${declaration.name} 同时声明为 ${typeLabel(existing.type)} 和 ${typeLabel(declaration.type)}。`);
    byName.set(declaration.name,declaration);
  });
}
function exportRuntime(strict=false){const config=projectConfig(),graph=store.snapshot(),readiness=renderCompileStatus(graph);if(!readiness.ready){const message=`导出失败：${readiness.message}`;document.querySelector("#footer-message").textContent=message;if(strict)throw new Error(message);return null;}saveWorkflow();lastGeneratedSources={java:{filename:`${config.className}.java`,content:pluginSource(config,graph)},vertex:{filename:`${config.className}.vert`,content:vertexSource()},fragment:{filename:`${config.className}.frag`,content:fragmentSource(graph)}};Object.values(lastGeneratedSources).forEach(file=>download(file.filename,file.content));workflowBridge.publish(graph);document.querySelector("#footer-message").textContent="已导出 Java + 顶点着色器 + 片段着色器";return lastGeneratedSources;}
document.querySelector("#node-search").addEventListener("input", e => renderCatalog(e.target.value)); document.querySelector("#new-graph").addEventListener("click", () => { ui.selected = null; store.reset(); });
document.querySelector("#add-demo").addEventListener("click", addDemo);document.querySelector("#save-workflow").addEventListener("click",saveWorkflow);document.querySelector("#export-runtime").addEventListener("click",exportRuntime);
document.querySelector("#import-workflow").addEventListener("click",()=>{document.querySelector("#import-status").textContent="尚未选择文件。";document.querySelector("#import-dialog").showModal();});
document.querySelector("#close-import-dialog").addEventListener("click",()=>document.querySelector("#import-dialog").close());
document.querySelector("#choose-workflow-file").addEventListener("click",()=>document.querySelector("#workflow-file-input").click());
document.querySelector("#workflow-file-input").addEventListener("change",event=>{const file=event.target.files?.[0];if(file)importWorkflowFile(file);event.target.value="";});
document.querySelector("#workflow-manager").addEventListener("click",()=>{const config=projectConfig(),resolution=previewResolution(config);document.querySelector("#workflow-title").value=config.title;document.querySelector("#plugin-class-name").value=config.className;document.querySelector("#shader-directory").value=config.shaderDir;document.querySelector("#preview-canvas-width").value=resolution.width;document.querySelector("#preview-canvas-height").value=resolution.height;document.querySelector("#bridge-port").value=workflowBridge.port();document.querySelector("#bridge-status").textContent="正在检测本地页面桥接…";checkBridge();renderWorkflowLibrary();document.querySelector("#workflow-dialog").showModal();});
document.querySelector("#bridge-port").addEventListener("change",event=>workflowBridge.setPort(event.target.value));
document.querySelector("#bridge-check").addEventListener("click",checkBridge);
const bridgePromptButton=document.querySelector("#bridge-copy-prompt");
bridgePromptButton.textContent="显示 MCP 配置与接入提示";
const bridgePromptBox=document.createElement("textarea");
bridgePromptBox.id="bridge-prompt"; bridgePromptBox.className="bridge-prompt"; bridgePromptBox.readOnly=true; bridgePromptBox.spellcheck=false;
bridgePromptBox.setAttribute("aria-label","MCP 配置与接入提示");
bridgePromptBox.placeholder="点击“显示 MCP 配置与接入提示”生成内容，可自行选择复制";
bridgePromptButton.parentElement.insertAdjacentElement("afterend",bridgePromptBox);
bridgePromptButton.addEventListener("click",()=>{bridgePromptBox.value=bridgePrompt();bridgePromptBox.focus();document.querySelector("#bridge-status").textContent="提示已显示；请按当前运行方式选择对应段落。";});
document.querySelector("#close-workflow-dialog").addEventListener("click",()=>document.querySelector("#workflow-dialog").close());
document.querySelector("#create-workflow").addEventListener("click",()=>{const config=bridgeProjectConfig({id:`workflow_${Date.now()}`,title:document.querySelector("#workflow-title").value||"Untitled Workflow",className:document.querySelector("#plugin-class-name").value,shaderDir:document.querySelector("#shader-directory").value,previewWidth:document.querySelector("#preview-canvas-width").value,previewHeight:document.querySelector("#preview-canvas-height").value});openWorkflow(config,starterGraph(),false);saveWorkflow();renderWorkflowLibrary();});
document.querySelector("#save-current-workflow").addEventListener("click",()=>{const config=bridgeProjectConfig({id:projectConfig().id,title:document.querySelector("#workflow-title").value,className:document.querySelector("#plugin-class-name").value,shaderDir:document.querySelector("#shader-directory").value,previewWidth:document.querySelector("#preview-canvas-width").value,previewHeight:document.querySelector("#preview-canvas-height").value},projectConfig());sessionStorage.setItem("workflow.projectConfig",JSON.stringify(config));store.graph.previewRevision=++store.previewRevision;store.emit();saveWorkflow();renderWorkflowLibrary();});
store.subscribe(graph => { sessionStorage.setItem("workflow.graph",JSON.stringify(graph)); document.querySelector("#revision").textContent = graph.revision; document.querySelector("#workflow-name").textContent=projectConfig().title; document.querySelector("#footer-message").textContent = `${graph.nodes.length} 节点 · ${graph.links.length} 连线`; renderGraph(graph); renderInspector(graph); renderCompileStatus(graph); workflowBridge.publish(graph); });
setInterval(() => workflowBridge.pull(), 250);
setInterval(() => workflowBridge.publish(store.snapshot()), 2000);
function addDemo() {
  const x=115,y=175; addNode("input.uv",x,y); addNode("vector.center",x+280,y); addNode("vector.length",x+560,y); const graph=store.snapshot();
  const uv=graph.nodes.filter(n=>n.typeId==="input.uv").slice(-1)[0], center=graph.nodes.filter(n=>n.typeId==="vector.center").slice(-1)[0], length=graph.nodes.filter(n=>n.typeId==="vector.length").slice(-1)[0];
  store.command("CONNECT",{link:{fromNode:uv.id,fromSocket:"uv",toNode:center.id,toSocket:"uv"}}); store.command("CONNECT",{link:{fromNode:center.id,fromSocket:"value",toNode:length.id,toSocket:"value"}});
}
renderCatalog();
renderCompileStatus(store.snapshot());

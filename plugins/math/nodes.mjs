/** 声明仅由本插件拥有，每次贡献时复制。 */
export const mathNodes = [
  {
    typeId: "studio.math.constant",
    title: "常量",
    category: "基础",
    inputs: [],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      value: "0.5",
      valueType: "AUTO",
    },
    dynamicKind: "output",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.add",
    title: "加法",
    category: "数学",
    inputs: [
      {
        name: "a",
        type: "FLOAT",
      },
      {
        name: "b",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.multiply",
    title: "乘法",
    category: "数学",
    inputs: [
      {
        name: "a",
        type: "FLOAT",
      },
      {
        name: "b",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.subtract",
    title: "减法",
    category: "数学",
    inputs: [
      {
        name: "a",
        type: "FLOAT",
      },
      {
        name: "b",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.divide",
    title: "除法",
    category: "数学",
    inputs: [
      {
        name: "a",
        type: "FLOAT",
      },
      {
        name: "b",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.clamp",
    title: "钳制",
    category: "数学",
    inputs: [
      {
        name: "value",
        type: "FLOAT",
      },
      {
        name: "min",
        type: "FLOAT",
      },
      {
        name: "max",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.sin",
    title: "正弦",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.cos",
    title: "余弦",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.split",
    title: "拆分向量",
    category: "向量",
    inputs: [
      {
        name: "value",
        type: "ANY",
      },
    ],
    outputs: [
      {
        name: "x",
        type: "FLOAT",
      },
      {
        name: "y",
        type: "FLOAT",
      },
      {
        name: "z",
        type: "FLOAT",
      },
      {
        name: "w",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "splitVector",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.combine",
    title: "组合向量",
    category: "向量",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
      {
        name: "y",
        type: "FLOAT",
      },
      {
        name: "z",
        type: "FLOAT",
      },
      {
        name: "w",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "VEC2",
      },
    ],
    properties: {
      valueType: "VEC2",
    },
    dynamicKind: "combineVector",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.scale",
    title: "向量缩放",
    category: "向量",
    inputs: [
      {
        name: "value",
        type: "ANY",
      },
      {
        name: "scale",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "ANY",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "scaleVector",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.length",
    title: "长度",
    category: "向量",
    inputs: [
      {
        name: "value",
        type: "VEC2",
      },
    ],
    outputs: [
      {
        name: "length",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "vectorInput",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.normalize",
    title: "归一化",
    category: "向量",
    inputs: [
      {
        name: "value",
        type: "VEC2",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "VEC2",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.center",
    title: "中心化 UV",
    category: "向量",
    inputs: [
      {
        name: "uv",
        type: "VEC2",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "VEC2",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.remap",
    title: "映射范围",
    category: "数学",
    inputs: [
      {
        name: "value",
        type: "FLOAT",
      },
      {
        name: "inMin",
        type: "FLOAT",
      },
      {
        name: "inMax",
        type: "FLOAT",
      },
      {
        name: "outMin",
        type: "FLOAT",
      },
      {
        name: "outMax",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.min",
    title: "最小值",
    category: "数学",
    inputs: [
      {
        name: "a",
        type: "FLOAT",
      },
      {
        name: "b",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.max",
    title: "最大值",
    category: "数学",
    inputs: [
      {
        name: "a",
        type: "FLOAT",
      },
      {
        name: "b",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.abs",
    title: "绝对值",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.fract",
    title: "小数部分",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.floor",
    title: "向下取整",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.pow",
    title: "幂",
    category: "数学",
    inputs: [
      {
        name: "base",
        type: "FLOAT",
      },
      {
        name: "exponent",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.smoothstep",
    title: "平滑阶梯",
    category: "数学",
    inputs: [
      {
        name: "edge0",
        type: "FLOAT",
      },
      {
        name: "edge1",
        type: "FLOAT",
      },
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.mix",
    title: "线性插值",
    category: "数学",
    inputs: [
      {
        name: "a",
        type: "FLOAT",
      },
      {
        name: "b",
        type: "FLOAT",
      },
      {
        name: "t",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "mix",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.dot",
    title: "点积",
    category: "向量",
    inputs: [
      {
        name: "a",
        type: "VEC2",
      },
      {
        name: "b",
        type: "VEC2",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.cross",
    title: "叉积",
    category: "向量",
    inputs: [
      {
        name: "a",
        type: "VEC3",
      },
      {
        name: "b",
        type: "VEC3",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "VEC3",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.reflect",
    title: "反射",
    category: "向量",
    inputs: [
      {
        name: "incident",
        type: "VEC2",
      },
      {
        name: "normal",
        type: "VEC2",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "VEC2",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.atan",
    title: "反正切 atan",
    category: "数学",
    inputs: [
      {
        name: "y",
        type: "FLOAT",
      },
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.tan",
    title: "正切",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.asin",
    title: "反正弦",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.acos",
    title: "反余弦",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.exp",
    title: "指数 exp",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.log",
    title: "自然对数",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.sqrt",
    title: "平方根",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.sign",
    title: "符号 sign",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.ceil",
    title: "向上取整",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.step",
    title: "阶梯 step",
    category: "数学",
    inputs: [
      {
        name: "edge",
        type: "FLOAT",
      },
      {
        name: "x",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.mod",
    title: "取模 mod",
    category: "数学",
    inputs: [
      {
        name: "x",
        type: "FLOAT",
      },
      {
        name: "y",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
    dynamicKind: "all",
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.radians",
    title: "角度转弧度",
    category: "数学",
    inputs: [
      {
        name: "degrees",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.degrees",
    title: "弧度转角度",
    category: "数学",
    inputs: [
      {
        name: "radians",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.distance2",
    title: "两点距离",
    category: "向量",
    inputs: [
      {
        name: "a",
        type: "VEC2",
      },
      {
        name: "b",
        type: "VEC2",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.math.vector.rotate2d",
    title: "二维旋转",
    category: "向量",
    inputs: [
      {
        name: "value",
        type: "VEC2",
      },
      {
        name: "angle",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "VEC2",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
];

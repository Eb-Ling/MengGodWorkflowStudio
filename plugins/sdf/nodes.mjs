/** 声明仅由本插件拥有，每次贡献时复制。 */
export const sdfNodes = [
  {
    typeId: "studio.sdf.circle",
    title: "圆形 SDF",
    category: "SDF",
    inputs: [
      {
        name: "point",
        type: "VEC2",
      },
      {
        name: "radius",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "distance",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.sdf.box",
    title: "矩形 SDF",
    category: "SDF",
    inputs: [
      {
        name: "point",
        type: "VEC2",
      },
      {
        name: "size",
        type: "VEC2",
      },
    ],
    outputs: [
      {
        name: "distance",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.sdf.segment",
    title: "线段距离",
    category: "SDF",
    inputs: [
      {
        name: "point",
        type: "VEC2",
      },
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
        name: "distance",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.sdf.lance",
    title: "光矛 SDF",
    category: "SDF",
    inputs: [
      {
        name: "point",
        type: "VEC2",
      },
      {
        name: "baseX",
        type: "FLOAT",
      },
      {
        name: "tipX",
        type: "FLOAT",
      },
      {
        name: "maxR",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "distance",
        type: "FLOAT",
      },
    ],
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.sdf.shape.lanceTaper",
    title: "光矛锥度",
    category: "形状",
    inputs: [
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
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
  {
    typeId: "studio.sdf.shape.xFade",
    title: "横向淡出",
    category: "形状",
    inputs: [
      {
        name: "point",
        type: "VEC2",
      },
      {
        name: "baseX",
        type: "FLOAT",
      },
      {
        name: "tipX",
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
    typeId: "studio.sdf.shape.fadeVertical",
    title: "纵向淡出",
    category: "形状",
    inputs: [
      {
        name: "value",
        type: "FLOAT",
      },
      {
        name: "edge0",
        type: "FLOAT",
      },
      {
        name: "edge1",
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
    typeId: "studio.sdf.shape.fadeHorizontal",
    title: "横向淡出",
    category: "形状",
    inputs: [
      {
        name: "value",
        type: "FLOAT",
      },
      {
        name: "edge0",
        type: "FLOAT",
      },
      {
        name: "edge1",
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
    typeId: "studio.sdf.curve.cubicBezier",
    title: "三阶贝塞尔",
    category: "曲线",
    inputs: [
      {
        name: "p0",
        type: "VEC2",
      },
      {
        name: "p1",
        type: "VEC2",
      },
      {
        name: "p2",
        type: "VEC2",
      },
      {
        name: "p3",
        type: "VEC2",
      },
      {
        name: "t",
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
  {
    typeId: "studio.sdf.curve.quarticBezier",
    title: "四阶贝塞尔 Y",
    category: "曲线",
    inputs: [
      {
        name: "p0",
        type: "VEC2",
      },
      {
        name: "p1",
        type: "VEC2",
      },
      {
        name: "p2",
        type: "VEC2",
      },
      {
        name: "p3",
        type: "VEC2",
      },
      {
        name: "p4",
        type: "VEC2",
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
    properties: {},
    stages: ["vertex", "fragment"],
    targets: ["glsl-es-300", "glsl-430"],
  },
];

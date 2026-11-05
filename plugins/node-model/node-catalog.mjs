const clone = structuredClone;
// 最小阶段/输入、控制流与用户 GLSL。算法插件通过 NodeApi 另行贡献。
const builtins = [
  {
    typeId: "input.position",
    title: "局部顶点坐标",
    category: "输入输出",
    inputs: [],
    outputs: [
      {
        name: "value",
        type: "VEC2",
      },
    ],
    properties: {},
    stage: "vertex",
  },
  {
    typeId: "vertex.output",
    title: "顶点输出",
    category: "输入输出",
    inputs: [
      {
        name: "position",
        type: "VEC2",
      },
      {
        name: "uv",
        type: "VEC2",
      },
    ],
    outputs: [],
    properties: {},
    stage: "vertex",
  },
  {
    typeId: "io.input",
    title: "输入",
    category: "输入输出",
    inputs: [],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {
      uniform: "u_value",
      defaultValue: "0.0",
      scope: "shared",
      valueType: "AUTO",
    },
    dynamicKind: "output",
  },
  {
    typeId: "input.texture",
    title: "纹理入口",
    category: "输入输出",
    inputs: [],
    outputs: [
      {
        name: "texture",
        type: "SAMPLER2D",
      },
    ],
    properties: {
      uniform: "u_texture",
      textureId: "texture",
      previewDataUrl: "",
    },
  },
  {
    typeId: "input.time",
    title: "时间 Time",
    category: "输入输出",
    inputs: [],
    outputs: [
      {
        name: "time",
        type: "FLOAT",
      },
    ],
    properties: {
      uniform: "u_time",
      defaultValue: "0.0",
      autoAdvance: true,
    },
  },
  {
    typeId: "io.output",
    title: "片段输出",
    category: "输入输出",
    inputs: [
      {
        name: "color",
        type: "VEC4",
      },
    ],
    outputs: [],
    properties: {},
  },
  {
    typeId: "texture.sample2d",
    title: "纹理采样",
    category: "纹理",
    inputs: [
      {
        name: "texture",
        type: "SAMPLER2D",
      },
      {
        name: "uv",
        type: "VEC2",
      },
    ],
    outputs: [
      {
        name: "rgba",
        type: "VEC4",
      },
    ],
    properties: {
      sampler: "u_texture",
    },
  },
  {
    typeId: "input.uv",
    title: "UV 坐标",
    category: "输入输出",
    inputs: [],
    outputs: [
      {
        name: "uv",
        type: "VEC2",
      },
    ],
    properties: {},
  },
  {
    typeId: "logic.if",
    title: "If 分支",
    category: "逻辑",
    inputs: [
      {
        name: "condition",
        type: "BOOL",
      },
    ],
    outputs: [],
    properties: {
      trueWidth: 430,
      trueHeight: 300,
      falseWidth: 430,
      falseHeight: 300,
    },
  },
  {
    typeId: "logic.for",
    title: "For 循环",
    category: "逻辑",
    inputs: [
      {
        name: "count",
        type: "FLOAT",
      },
    ],
    outputs: [
      {
        name: "i",
        type: "FLOAT",
      },
    ],
    properties: {
      width: 430,
      height: 300,
    },
  },
  {
    typeId: "logic.variable",
    title: "变量",
    category: "逻辑",
    inputs: [
      {
        name: "init",
        type: "ANY",
      },
      {
        name: "value",
        type: "ANY",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "ANY",
      },
    ],
    properties: {
      valueType: "FLOAT",
      initialValue: "0.0",
      name: "branchValue",
    },
    dynamicKind: "all",
  },
  {
    typeId: "logic.equal",
    title: "等于 ==",
    category: "逻辑",
    inputs: [
      {
        name: "a",
        type: "ANY",
      },
      {
        name: "b",
        type: "ANY",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "BOOL",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
  },
  {
    typeId: "logic.notEqual",
    title: "不等于 !=",
    category: "逻辑",
    inputs: [
      {
        name: "a",
        type: "ANY",
      },
      {
        name: "b",
        type: "ANY",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "BOOL",
      },
    ],
    properties: {
      valueType: "AUTO",
    },
  },
  {
    typeId: "logic.greater",
    title: "大于 >",
    category: "逻辑",
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
        type: "BOOL",
      },
    ],
    properties: {},
  },
  {
    typeId: "logic.greaterEqual",
    title: "大于等于 >=",
    category: "逻辑",
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
        type: "BOOL",
      },
    ],
    properties: {},
  },
  {
    typeId: "logic.less",
    title: "小于 <",
    category: "逻辑",
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
        type: "BOOL",
      },
    ],
    properties: {},
  },
  {
    typeId: "logic.lessEqual",
    title: "小于等于 <=",
    category: "逻辑",
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
        type: "BOOL",
      },
    ],
    properties: {},
  },
  {
    typeId: "logic.and",
    title: "逻辑与 &&",
    category: "逻辑",
    inputs: [
      {
        name: "a",
        type: "BOOL",
      },
      {
        name: "b",
        type: "BOOL",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "BOOL",
      },
    ],
    properties: {},
  },
  {
    typeId: "logic.or",
    title: "逻辑或 ||",
    category: "逻辑",
    inputs: [
      {
        name: "a",
        type: "BOOL",
      },
      {
        name: "b",
        type: "BOOL",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "BOOL",
      },
    ],
    properties: {},
  },
  {
    typeId: "logic.not",
    title: "逻辑非 !",
    category: "逻辑",
    inputs: [
      {
        name: "value",
        type: "BOOL",
      },
    ],
    outputs: [
      {
        name: "value",
        type: "BOOL",
      },
    ],
    properties: {},
  },
  {
    typeId: "custom.radialFade",
    title: "径向 Fade（自定义 GLSL）",
    category: "自定义 GLSL",
    inputs: [
      {
        name: "distance",
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
      sourceTargets: ["glsl-es-300", "glsl-430"],
      functionName: "wf_radial_fade",
      parameters: [
        {
          id: "distance",
          name: "distance",
          type: "float",
          qualifier: "in",
        },
        {
          id: "value",
          name: "value",
          type: "float",
          qualifier: "out",
        },
      ],
      code: "value = 1.0 - smoothstep(0.5, 1.0, distance);",
    },
  },
  {
    typeId: "custom.innerFade",
    title: "内环 Fade（自定义 GLSL）",
    category: "自定义 GLSL",
    inputs: [
      {
        name: "distance",
        type: "FLOAT",
      },
      {
        name: "time",
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
      sourceTargets: ["glsl-es-300", "glsl-430"],
      functionName: "wf_inner_fade",
      parameters: [
        {
          id: "distance",
          name: "distance",
          type: "float",
          qualifier: "in",
        },
        {
          id: "time",
          name: "time",
          type: "float",
          qualifier: "in",
        },
        {
          id: "value",
          name: "value",
          type: "float",
          qualifier: "out",
        },
      ],
      code: "float wave = 0.025 * sin(time * 3.0); value = smoothstep(0.25 + wave, 0.5 + wave, distance);",
    },
  },
];
export function createNodeCatalog({ overrides = {}, customNodes = [] } = {}) {
  return [
    ...builtins.map((n) => clone(overrides[n.typeId] || n)),
    ...clone(customNodes),
  ];
}

/** Noise 节点契约，节点定义和编译规则由同一插件拥有。 */
export const noiseNodes = [
  {
    typeId: "studio.noise.fbm",
    title: "分形噪声",
    category: "噪声",
    inputs: [
      {
        name: "uv",
        type: "VEC2",
      },
      {
        name: "octaves",
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
      scale: "4.0",
      octaves: "5",
    },
    propertySchema: {
      type: "object",
      properties: {
        scale: { anyOf: [{ type: "number", minimum: -10000, maximum: 10000 }, { type: "string", pattern: "^[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$" }] },
        octaves: { anyOf: [{ type: "number" }, { type: "string", pattern: "^[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$" }] },
      },
    },
  },
  {
    typeId: "studio.noise.value",
    title: "值噪声",
    category: "噪声",
    inputs: [
      {
        name: "uv",
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
  },
  {
    typeId: "studio.noise.simplex",
    title: "Simplex 噪声",
    category: "噪声",
    inputs: [
      {
        name: "uv",
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
  },
  {
    typeId: "studio.noise.perlin",
    title: "柏林噪声",
    category: "噪声",
    inputs: [
      {
        name: "uv",
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
  },
  {
    typeId: "studio.noise.worley",
    title: "Worley 噪声",
    category: "噪声",
    inputs: [
      {
        name: "uv",
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
  },
  {
    typeId: "studio.noise.turbulence",
    title: "湍流",
    category: "噪声",
    inputs: [
      {
        name: "uv",
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
  },
  {
    typeId: "studio.noise.turbulize",
    title: "噪声湍流化",
    category: "噪声",
    inputs: [
      {
        name: "noise",
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
  },
  {
    typeId: "studio.noise.turbulence3",
    title: "3D 湍流",
    category: "噪声",
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
    ],
    outputs: [
      {
        name: "value",
        type: "FLOAT",
      },
    ],
    properties: {},
  },
  {
    typeId: "studio.noise.fbmSimplex",
    title: "Simplex 分形噪声",
    category: "噪声",
    inputs: [
      {
        name: "uv",
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
  },
  {
    typeId: "studio.noise.fbmWorley",
    title: "Worley 分形噪声",
    category: "噪声",
    inputs: [
      {
        name: "uv",
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
  },
];

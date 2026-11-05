export function mingGodSignGraph() {
  const constant = (id, title, x, y, value) => ({
    id,
    typeId: "studio.math.constant",
    title,
    canvasX: x,
    canvasY: y,
    properties: {
      value: String(value),
      previewEnabled: false,
      valueType: "FLOAT",
    },
  });
  const uv = {
    id: "sign_uv",
    typeId: "input.uv",
    title: "UV 坐标",
    canvasX: 80,
    canvasY: 230,
    properties: { previewEnabled: true },
  };
  const time = {
    id: "sign_time",
    typeId: "input.time",
    title: "时间 Time",
    canvasX: 80,
    canvasY: 450,
    properties: {
      previewEnabled: true,
      uniform: "u_time",
      defaultValue: "0.0",
      autoAdvance: true,
    },
  };
  const duration = {
    id: "sign_duration",
    typeId: "io.input",
    title: "Duration 参数",
    canvasX: 80,
    canvasY: 560,
    properties: {
      uniform: "u_duration",
      defaultValue: "100.0",
      valueType: "FLOAT",
      previewEnabled: false,
    },
  };
  const progress = {
    id: "sign_progress",
    typeId: "io.input",
    title: "Progress 参数",
    canvasX: 80,
    canvasY: 670,
    properties: {
      uniform: "u_progress",
      defaultValue: "0.0",
      valueType: "FLOAT",
      previewEnabled: false,
    },
  };
  const center = {
    id: "sign_center",
    typeId: "studio.math.vector.center",
    title: "UV - 0.5",
    canvasX: 310,
    canvasY: 230,
    properties: { previewEnabled: true },
  };
  const two = constant("sign_two", "常量 2.0", 530, 100, 2.0);
  const toCenter = {
    id: "sign_to_center",
    typeId: "studio.math.vector.scale",
    title: "toCenter × 2",
    canvasX: 540,
    canvasY: 230,
    properties: { previewEnabled: true, valueType: "VEC2" },
  };
  const distance = {
    id: "sign_distance",
    typeId: "studio.math.vector.length",
    title: "径向距离 dist",
    canvasX: 780,
    canvasY: 230,
    properties: { previewEnabled: true, valueType: "VEC2" },
  };
  const toCenterSplit = {
    id: "sign_to_center_split",
    typeId: "studio.math.vector.split",
    title: "拆分 toCenter",
    canvasX: 780,
    canvasY: 430,
    properties: { previewEnabled: true, valueType: "VEC2" },
  };
  const angle = {
    id: "sign_angle",
    typeId: "studio.math.atan",
    title: "atan(y, x)",
    canvasX: 1020,
    canvasY: 430,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const exponent = constant("sign_exp", "常量 0.36", 1020, 120, 0.36),
    noiseExponent = constant("sign_noise_exp", "常量 0.5", 2700, 120, 0.5),
    timeFactor = constant("sign_time_factor", "常量 0.1", 1020, 650, 0.1),
    timeFactorFast = constant(
      "sign_time_factor_fast",
      "常量 0.2",
      1510,
      650,
      0.2,
    ),
    tau = constant("sign_tau", "常量 2PI", 1510, 120, 6.28318);
  const normalizedAngle = {
    id: "sign_normalized_angle",
    typeId: "studio.math.divide",
    title: "角度 / 2PI",
    canvasX: 1260,
    canvasY: 430,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const pow = {
    id: "sign_pow",
    typeId: "studio.math.pow",
    title: "pow(dist, 0.36)",
    canvasX: 1260,
    canvasY: 180,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const timeScale = {
    id: "sign_time_scale",
    typeId: "studio.math.multiply",
    title: "Time × 0.1",
    canvasX: 1010,
    canvasY: 500,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const subtract = {
    id: "sign_subtract",
    typeId: "studio.math.subtract",
    title: "径向 - 时间",
    canvasX: 1250,
    canvasY: 290,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const add = {
    id: "sign_add",
    typeId: "studio.math.add",
    title: "角度 + 径向",
    canvasX: 1490,
    canvasY: 290,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const scale = {
    id: "sign_scale",
    typeId: "studio.math.multiply",
    title: "乘以 2PI",
    canvasX: 1730,
    canvasY: 290,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const cosine = {
    id: "sign_cos",
    typeId: "studio.math.cos",
    title: "cos 旋涡",
    canvasX: 1970,
    canvasY: 290,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const contraction = {
    id: "sign_contraction",
    typeId: "studio.math.add",
    title: "距离 + Time×0.2",
    canvasX: 1730,
    canvasY: 510,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const timeFast = {
    id: "sign_time_fast",
    typeId: "studio.math.multiply",
    title: "Time × 0.2",
    canvasX: 1490,
    canvasY: 570,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const turbulence = {
    id: "sign_turbulence",
    typeId: "studio.noise.turbulence3",
    title: "3D 湍流",
    canvasX: 2210,
    canvasY: 290,
    properties: { previewEnabled: true },
  };
  const fog = {
    id: "sign_fog",
    typeId: "studio.math.pow",
    title: "pow(湍流, 0.5)",
    canvasX: 2450,
    canvasY: 290,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const radialFade = {
    id: "sign_radial_fade",
    typeId: "custom.radialFade",
    title: "径向 Fade（自定义 GLSL）",
    canvasX: 1970,
    canvasY: 700,
    properties: { previewEnabled: true },
  };
  const innerFade = {
    id: "sign_inner_fade",
    typeId: "custom.innerFade",
    title: "内环 Fade（自定义 GLSL）",
    canvasX: 2210,
    canvasY: 700,
    properties: { previewEnabled: true },
  };
  const colorConstant = {
    id: "sign_color_constant",
    typeId: "studio.math.constant",
    title: "颜色 (1.0, 0.65, 0.75)",
    canvasX: 2450,
    canvasY: 820,
    properties: {
      value: "1.0, 0.65, 0.75",
      valueType: "VEC3",
      previewEnabled: false,
    },
  };
  const colorFog = {
    id: "sign_color_fog",
    typeId: "studio.math.vector.scale",
    title: "颜色 × fog",
    canvasX: 2700,
    canvasY: 650,
    properties: { previewEnabled: true, valueType: "VEC3" },
  };
  const colorRadial = {
    id: "sign_color_radial",
    typeId: "studio.math.vector.scale",
    title: "颜色 × radialFade",
    canvasX: 2940,
    canvasY: 650,
    properties: { previewEnabled: true, valueType: "VEC3" },
  };
  const colorInner = {
    id: "sign_color_inner",
    typeId: "studio.math.vector.scale",
    title: "颜色 × innerFade",
    canvasX: 3180,
    canvasY: 650,
    properties: { previewEnabled: true, valueType: "VEC3" },
  };
  const one = constant("sign_one", "常量 1.0", 2450, 100, 1.0),
    alphaScale = constant("sign_alpha_scale", "常量 0.8", 2700, 100, 0.8);
  const alphaHole = {
    id: "sign_alpha_hole",
    typeId: "studio.math.subtract",
    title: "1.0 - innerFade",
    canvasX: 2700,
    canvasY: 250,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const alphaFog = {
    id: "sign_alpha_fog",
    typeId: "studio.math.multiply",
    title: "fog × radialFade",
    canvasX: 2940,
    canvasY: 250,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const alphaScaled = {
    id: "sign_alpha_scaled",
    typeId: "studio.math.multiply",
    title: "× 0.8",
    canvasX: 3180,
    canvasY: 250,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const alpha = {
    id: "sign_alpha",
    typeId: "studio.math.max",
    title: "max(alpha)",
    canvasX: 3420,
    canvasY: 250,
    properties: { previewEnabled: true, valueType: "FLOAT" },
  };
  const colorSplit = {
    id: "sign_color_split",
    typeId: "studio.math.vector.split",
    title: "拆分颜色",
    canvasX: 3420,
    canvasY: 650,
    properties: { previewEnabled: false, valueType: "VEC3" },
  };
  const combine = {
    id: "sign_combine",
    typeId: "studio.math.vector.combine",
    title: "组合 RGBA",
    canvasX: 3660,
    canvasY: 440,
    properties: { previewEnabled: true, valueType: "VEC4" },
  };
  const output = {
    id: "sign_output",
    typeId: "io.output",
    title: "片段输出",
    canvasX: 3900,
    canvasY: 440,
    properties: { previewEnabled: false },
  };
  return {
    schemaVersion: 1,
    projectId: "ming-god-sign-example",
    revision: 0,
    outputNodeId: output.id,
    nodes: [
      uv,
      time,
      duration,
      progress,
      center,
      two,
      toCenter,
      distance,
      toCenterSplit,
      angle,
      normalizedAngle,
      exponent,
      noiseExponent,
      timeFactor,
      timeFactorFast,
      tau,
      pow,
      timeScale,
      subtract,
      add,
      scale,
      cosine,
      timeFast,
      contraction,
      turbulence,
      fog,
      radialFade,
      innerFade,
      colorConstant,
      colorFog,
      colorRadial,
      colorInner,
      one,
      alphaScale,
      alphaHole,
      alphaFog,
      alphaScaled,
      alpha,
      colorSplit,
      combine,
      output,
    ],
    links: [
      { fromNode: uv.id, fromSocket: "uv", toNode: center.id, toSocket: "uv" },
      {
        fromNode: center.id,
        fromSocket: "value",
        toNode: toCenter.id,
        toSocket: "value",
      },
      {
        fromNode: two.id,
        fromSocket: "value",
        toNode: toCenter.id,
        toSocket: "scale",
      },
      {
        fromNode: toCenter.id,
        fromSocket: "value",
        toNode: distance.id,
        toSocket: "value",
      },
      {
        fromNode: toCenter.id,
        fromSocket: "value",
        toNode: toCenterSplit.id,
        toSocket: "value",
      },
      {
        fromNode: toCenterSplit.id,
        fromSocket: "y",
        toNode: angle.id,
        toSocket: "y",
      },
      {
        fromNode: toCenterSplit.id,
        fromSocket: "x",
        toNode: angle.id,
        toSocket: "x",
      },
      {
        fromNode: angle.id,
        fromSocket: "value",
        toNode: normalizedAngle.id,
        toSocket: "a",
      },
      {
        fromNode: tau.id,
        fromSocket: "value",
        toNode: normalizedAngle.id,
        toSocket: "b",
      },
      {
        fromNode: distance.id,
        fromSocket: "length",
        toNode: pow.id,
        toSocket: "base",
      },
      {
        fromNode: exponent.id,
        fromSocket: "value",
        toNode: pow.id,
        toSocket: "exponent",
      },
      {
        fromNode: time.id,
        fromSocket: "time",
        toNode: timeScale.id,
        toSocket: "a",
      },
      {
        fromNode: timeFactor.id,
        fromSocket: "value",
        toNode: timeScale.id,
        toSocket: "b",
      },
      {
        fromNode: pow.id,
        fromSocket: "value",
        toNode: subtract.id,
        toSocket: "a",
      },
      {
        fromNode: timeScale.id,
        fromSocket: "value",
        toNode: subtract.id,
        toSocket: "b",
      },
      {
        fromNode: normalizedAngle.id,
        fromSocket: "value",
        toNode: add.id,
        toSocket: "a",
      },
      {
        fromNode: subtract.id,
        fromSocket: "value",
        toNode: add.id,
        toSocket: "b",
      },
      {
        fromNode: add.id,
        fromSocket: "value",
        toNode: scale.id,
        toSocket: "a",
      },
      {
        fromNode: tau.id,
        fromSocket: "value",
        toNode: scale.id,
        toSocket: "b",
      },
      {
        fromNode: scale.id,
        fromSocket: "value",
        toNode: cosine.id,
        toSocket: "x",
      },
      {
        fromNode: time.id,
        fromSocket: "time",
        toNode: timeFast.id,
        toSocket: "a",
      },
      {
        fromNode: timeFactorFast.id,
        fromSocket: "value",
        toNode: timeFast.id,
        toSocket: "b",
      },
      {
        fromNode: distance.id,
        fromSocket: "length",
        toNode: contraction.id,
        toSocket: "a",
      },
      {
        fromNode: timeFast.id,
        fromSocket: "value",
        toNode: contraction.id,
        toSocket: "b",
      },
      {
        fromNode: cosine.id,
        fromSocket: "value",
        toNode: turbulence.id,
        toSocket: "x",
      },
      {
        fromNode: contraction.id,
        fromSocket: "value",
        toNode: turbulence.id,
        toSocket: "y",
      },
      {
        fromNode: timeScale.id,
        fromSocket: "value",
        toNode: turbulence.id,
        toSocket: "z",
      },
      {
        fromNode: turbulence.id,
        fromSocket: "value",
        toNode: fog.id,
        toSocket: "base",
      },
      {
        fromNode: noiseExponent.id,
        fromSocket: "value",
        toNode: fog.id,
        toSocket: "exponent",
      },
      {
        fromNode: distance.id,
        fromSocket: "length",
        toNode: radialFade.id,
        toSocket: "distance",
      },
      {
        fromNode: distance.id,
        fromSocket: "length",
        toNode: innerFade.id,
        toSocket: "distance",
      },
      {
        fromNode: time.id,
        fromSocket: "time",
        toNode: innerFade.id,
        toSocket: "time",
      },
      {
        fromNode: colorConstant.id,
        fromSocket: "value",
        toNode: colorFog.id,
        toSocket: "value",
      },
      {
        fromNode: fog.id,
        fromSocket: "value",
        toNode: colorFog.id,
        toSocket: "scale",
      },
      {
        fromNode: colorFog.id,
        fromSocket: "value",
        toNode: colorRadial.id,
        toSocket: "value",
      },
      {
        fromNode: radialFade.id,
        fromSocket: "value",
        toNode: colorRadial.id,
        toSocket: "scale",
      },
      {
        fromNode: colorRadial.id,
        fromSocket: "value",
        toNode: colorInner.id,
        toSocket: "value",
      },
      {
        fromNode: innerFade.id,
        fromSocket: "value",
        toNode: colorInner.id,
        toSocket: "scale",
      },
      {
        fromNode: one.id,
        fromSocket: "value",
        toNode: alphaHole.id,
        toSocket: "a",
      },
      {
        fromNode: innerFade.id,
        fromSocket: "value",
        toNode: alphaHole.id,
        toSocket: "b",
      },
      {
        fromNode: fog.id,
        fromSocket: "value",
        toNode: alphaFog.id,
        toSocket: "a",
      },
      {
        fromNode: radialFade.id,
        fromSocket: "value",
        toNode: alphaFog.id,
        toSocket: "b",
      },
      {
        fromNode: alphaFog.id,
        fromSocket: "value",
        toNode: alphaScaled.id,
        toSocket: "a",
      },
      {
        fromNode: alphaScale.id,
        fromSocket: "value",
        toNode: alphaScaled.id,
        toSocket: "b",
      },
      {
        fromNode: alphaHole.id,
        fromSocket: "value",
        toNode: alpha.id,
        toSocket: "a",
      },
      {
        fromNode: alphaScaled.id,
        fromSocket: "value",
        toNode: alpha.id,
        toSocket: "b",
      },
      {
        fromNode: colorInner.id,
        fromSocket: "value",
        toNode: colorSplit.id,
        toSocket: "value",
      },
      {
        fromNode: colorSplit.id,
        fromSocket: "x",
        toNode: combine.id,
        toSocket: "x",
      },
      {
        fromNode: colorSplit.id,
        fromSocket: "y",
        toNode: combine.id,
        toSocket: "y",
      },
      {
        fromNode: colorSplit.id,
        fromSocket: "z",
        toNode: combine.id,
        toSocket: "z",
      },
      {
        fromNode: alpha.id,
        fromSocket: "value",
        toNode: combine.id,
        toSocket: "w",
      },
      {
        fromNode: combine.id,
        fromSocket: "value",
        toNode: output.id,
        toSocket: "color",
      },
    ],
  };
}

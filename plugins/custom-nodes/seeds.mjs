/** 首次启用时加入的教学组件，使用与目录插件相同的函数协议。 */
const fade = (id, title, name, inputs, code) => ({
  typeId: "custom.glsl." + id,
  title,
  targets: ["glsl-es-300", "glsl-430"],
  glsl: {
    name,
    code,
    parameters: [
      ...inputs.map((name) => ({
        id: name,
        name,
        type: "FLOAT",
        qualifier: "in",
      })),
      { id: "value", name: "value", type: "FLOAT", qualifier: "out" },
    ],
  },
});
export const seeds = [
  fade(
    "radialFade",
    "径向 Fade（自定义 GLSL）",
    "wf_radial_fade",
    ["distance"],
    "value = 1.0 - smoothstep(0.5, 1.0, distance);",
  ),
  fade(
    "innerFade",
    "内环 Fade（自定义 GLSL）",
    "wf_inner_fade",
    ["distance", "time"],
    "float wave = 0.025 * sin(time * 3.0); value = smoothstep(0.25 + wave, 0.5 + wave, distance);",
  ),
];

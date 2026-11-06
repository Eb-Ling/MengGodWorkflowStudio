/** 节点说明由工作流能力拥有，返回纯文本，界面负责安全呈现。 */
export function createNodeDescription(typeLabel) {
  function portSummary(ports) {
    return ports?.length
      ? ports.map((port) => `${port.name}: ${typeLabel(port.type)}`).join("，")
      : "无";
  }
  function nodeDescription(definition) {
    const special = {
      "io.input":
        "声明一个外部传入的着色器参数，可参与顶点或片段工作流。具体调用格式由导出目标提供，defaultValue 用于编辑器预览。",
      "input.texture":
        "声明一个纹理 uniform。编辑器中的图片仅供预览，导出后的 Plugin 构造器需要由调用者传入对应 SpriteAPI。",
      "input.time":
        "提供着色器时间 uniform。导出运行时由 Plugin 的 advance(amount) 累积，预览时间开关只影响编辑器画面。",
      "input.uv": "提供标准化 UV 坐标，左下为 (0, 0)，右上为 (1, 1)。",
      "io.output":
        "片段着色器的最终出口。必须把一个 VEC4 连到 color，才可以导出运行文件。",
      "logic.if":
        "条件输入必须是 BOOL。TRUE 与 FALSE 框内的普通节点只能连接同一分支内的节点，不能直接跨出分支。若要把分支结果带到框外，先用变量节点：在 If 前通过 init 初始化，在分支内将结果连到变量的 value，再从变量输出继续连接。",
      "logic.for":
        "count 指定循环次数，i 输出只能连接到该循环框内节点。循环体若要向外带出结果，使用变量节点：init 在循环前初始化，value 在循环体内赋值，再使用变量输出。",
      "logic.variable":
        "valueType 决定变量数据类型。init 是控制块之前的初始化入口，未连接时使用 initialValue，value 是 If 分支或 For 循环内的赋值入口。变量输出是唯一允许从控制块内部带值到外部的通道。",
      "studio.math.vector.split":
        "将输入向量拆为分量出口。输入类型决定可用的 x/y/z/w 输出数量，VEC2 仅使用 x、y，VEC3 增加 z，VEC4 再增加 w。",
      "studio.math.vector.combine":
        "将多个 FLOAT 分量组合成向量。valueType 决定结果类型和生效入口数量：VEC2 使用 x/y，VEC3 使用 x/y/z，VEC4 使用 x/y/z/w。",
      "texture.sample2d":
        "按 UV 坐标采样 SAMPLER2D，输出 RGBA（VEC4）。预览与导出都会保持纹理比例并对画布外区域透明处理。",
    };
    if (special[definition.typeId]) return special[definition.typeId];
    if (definition.glsl)
      return "执行用户定义的 GLSL void 函数。参数表采用 GLSL 的 in、out、inout：in 只有输入端口，out 只有输出端口，inout 同时具有输入和输出端口。节点由所属插件提供。";
    const category =
      {
        数学: "对输入执行 GLSL 数学运算。",
        向量: "对标量或向量执行构造、分解或几何运算。",
        噪声: "从坐标生成程序化噪声值，通常输入 UV 或三维坐标，输出 FLOAT。",
        SDF: "计算有符号距离场，距离通常小于 0 表示形状内部。",
        曲线: "根据控制点和参数 t 计算曲线上的值。",
        形状: "用于构成可复用图形效果的计算。",
        逻辑: "执行布尔判断或控制流计算。",
        输入输出: "向工作流提供资源或输出最终片段颜色。",
      }[definition.category] || "执行此节点定义的计算。";
    return `${category} 输入：${portSummary(definition.inputs)}。输出：${portSummary(definition.outputs)}。`;
  }
  return nodeDescription;
}

// Java 浮点字面量格式只服务当前模板，不属于通用几何语义。
const javaNumber = (n) => {
  const value = String(Number(n));
  return /[.eE]/.test(value) ? value : value + ".0";
};
import {
  runtimeDependency,
  runtimePackage,
} from "../../packages/starsector-contract/runtime.mjs";
export const javaTypes = {
  BOOL: "boolean",
  INT: "int",
  UINT: "int",
  FLOAT: "float",
  VEC2: "Vector2f",
  VEC3: "Vector3f",
  VEC4: "Vector4f",
  SAMPLER2D: "SpriteAPI",
};
const components = (p) => Number(p.type.match(/^VEC([234])$/)?.[1] || 0);
const allParameters = (layout, textures) => [
  ...layout,
  ...textures.map((p) => ({ ...p, type: "SAMPLER2D", scope: "shared" })),
];
export const argumentType = (p) =>
  javaTypes[p.type] + (p.scope === "instance" ? "[]" : "");
export function constructorArguments(layout, textures, single = false) {
  return [
    { id: "layer", javaType: "CombatEngineLayers" },
    single
      ? { id: "position", javaType: "Vector2f" }
      : { id: "positions", javaType: "List<Vector2f>" },
    ...allParameters(layout, textures).map((p) => ({
      id: p.id,
      javaType: single ? javaTypes[p.type] : argumentType(p),
      scope: p.scope,
    })),
  ];
}
const signature = (layout, textures, single = false) =>
  constructorArguments(layout, textures, single)
    .map((p) => `${p.javaType} ${p.id}`)
    .join(", ");
function checks(p, value, name = p.id) {
  if (p.type === "FLOAT") return [`requireFinite(${value}, "${name}");`];
  if (components(p))
    return [
      `java.util.Objects.requireNonNull(${value}, "${name}");`,
      ...[..."xyzw".slice(0, components(p))].map(
        (c) => `requireFinite(${value}.${c}, "${name}.${c}");`,
      ),
    ];
  return p.type === "SAMPLER2D"
    ? [`java.util.Objects.requireNonNull(${value}, "${name}");`]
    : [];
}
const indent = (lines, spaces = 8) =>
  lines.map((line) => " ".repeat(spaces) + line).join("\n");
export function materialJava({ config, transform: t, layout, textures }) {
  const C = config.className,
    instance = layout.filter((p) => p.scope === "instance"),
    shared = layout.filter((p) => p.scope === "shared"),
    parameters = allParameters(layout, textures),
    slots = Math.max(1, instance.length);
  if (
    [
      "WorkflowRuntime",
      "GL20",
      "GL30",
      "CombatEngineLayers",
      "CombatEngineAPI",
      "BaseEveryFrameCombatPlugin",
      "Global",
      "String",
      "List",
      "Object",
      "IllegalArgumentException",
      "IllegalStateException",
      "java",
      ...Object.values(javaTypes),
    ].includes(C)
  )
    throw new Error("Java 类名与运行时类型冲突：" + C);
  if (parameters.length > 250)
    throw new Error("构造器最多支持 250 个节点与几何参数");
  const names = new Set(parameters.map((p) => p.id));
  const local = (base) => {
    while (names.has(base)) base += "_";
    names.add(base);
    return base;
  };
  const index = local("wf_index"),
    item = local("wf_instance");
  const fields = [
    ...shared.map((p) => `    private ${javaTypes[p.type]} shared_${p.id};`),
    ...textures.map((p) => `    private final SpriteAPI texture_${p.id};`),
  ];
  const validations = [
    "requirePositions(positions);",
    ...parameters
      .filter((p) => p.scope === "shared")
      .flatMap((p) => checks(p, p.id)),
    ...instance.map(
      (p) => `requireLength(${p.id}, positions.size(), "${p.id}");`,
    ),
    ...(instance.length
      ? [
          `for (int ${index} = 0; ${index} < positions.size(); ${index}++) {`,
          ...instance
            .flatMap((p) => checks(p, `${p.id}[${index}]`, p.id + " element"))
            .map((line) => "    " + line),
          "}",
        ]
      : []),
  ];
  const setters = layout
    .map((p) => {
      const handle = p.id === "wf_instance" ? "wf_instance_" : "wf_instance";
      const check = checks(p, p.id);
      if (p.scope === "shared")
        return `    /** 更新整批共用的 ${p.id} 参数，向量会复制保存。 */\n    public void set_${p.id}(${javaTypes[p.type]} ${p.id}) {\n${indent([...check, `shared_${p.id} = ${components(p) ? `new ${javaTypes[p.type]}(${p.id})` : p.id};`])}\n    }`;
      const writes = Array.from({ length: components(p) || 1 }, (_, i) => {
        const value = components(p)
          ? `${p.id}.${"xyzw"[i]}`
          : p.type === "BOOL"
            ? `${p.id} ? 1 : 0`
            : p.id;
        return `${["BOOL", "INT", "UINT"].includes(p.type) ? "putInt" : "putFloat"}(${handle}, ${p.slot * 16 + i * 4}, ${value});`;
      });
      return `    /** 更新指定实例的 ${p.id} 参数。 */\n    public void set_${p.id}(Instance ${handle}, ${javaTypes[p.type]} ${p.id}) {\n${indent([...check, ...writes])}\n    }`;
    })
    .join("\n\n");
  const uploads = shared.map((p) => {
    const loc = `uniform("${p.name}")`,
      v = `shared_${p.id}`;
    return p.type === "BOOL"
      ? `GL20.glUniform1i(${loc}, ${v} ? 1 : 0);`
      : p.type === "INT"
        ? `GL20.glUniform1i(${loc}, ${v});`
        : p.type === "UINT"
          ? `GL30.glUniform1ui(${loc}, ${v});`
          : p.type === "FLOAT"
            ? `GL20.glUniform1f(${loc}, ${v});`
            : `GL20.glUniform${components(p)}f(${loc}, ${[..."xyzw".slice(0, components(p))].map((c) => `${v}.${c}`).join(", ")});`;
  });
  return `package data.scripts;

import com.fs.starfarer.api.combat.CombatEngineLayers;
import com.fs.starfarer.api.graphics.SpriteAPI;
import ${runtimePackage(config.runtimePath)}.WorkflowRuntime;
import java.util.List;
import org.lwjgl.opengl.GL20;
import org.lwjgl.opengl.GL30;
import org.lwjgl.util.vector.*;

/** 每个 Vector2f 创建一个实例，复用依赖：${runtimePackage(config.runtimePath)}.WorkflowRuntime。 */
public final class ${C} extends WorkflowRuntime {
${fields.join("\n")}
    private final Instance[] configuredInstances;

    /** 批量入口：坐标使用世界坐标，每实例参数数组与坐标列表按下标对应。 */
    public ${C}(${signature(layout, textures)}) {
        super(layer, "${config.shaderDir}/${C}.vert", "${config.shaderDir}/${C}.frag",
            new float[]{${t.vertices
              .flat()
              .map((n) => javaNumber(n) + "f")
              .join(
                ", ",
              )}}, ${slots * 16}, ${textures.length}, ${config.blendMode === "additive"});
        requireApiVersion(${runtimeDependency.api});
${indent(validations)}
${indent([...shared.map((p) => `set_${p.id}(${p.id});`), ...textures.map((p) => `texture_${p.id} = ${p.id};`)])}
        configuredInstances = new Instance[positions.size()];
        for (int ${index} = 0; ${index} < positions.size(); ${index}++) {
            Instance ${item} = createInstance().setPosition(positions.get(${index}));
${indent(
  instance.map((p) => `set_${p.id}(${item}, ${p.id}[${index}]);`),
  12,
)}
            configuredInstances[${index}] = ${item};
        }
    }

    /** 单点入口：直接传入中心坐标及各参数，无需包装坐标或参数数组。 */
    public ${C}(${signature(layout, textures, true)}) {
        this(${["layer", "java.util.Collections.singletonList(position)", ...parameters.map((p) => (p.scope === "instance" ? `new ${javaTypes[p.type]}[]{${p.id}}` : p.id))].join(", ")});
    }

    /** 返回稳定的实例句柄，index 对应构造时的坐标顺序，单点入口使用 0。 */
    public Instance instance(int index) {
        if (isExpired()) throw new IllegalStateException("Effect has expired");
        return configuredInstances[index];
    }

    @Override protected void releaseInstanceReferences() {
        if (configuredInstances != null) java.util.Arrays.fill(configuredInstances, null);
    }

${setters}

    @Override protected void bindSharedParameters() {
${indent([...uploads, ...textures.map((p, i) => `bindTexture("${p.name}", ${i}, texture_${p.id});`)])}
    }
}
`;
}
function exampleValue(p) {
  const value = p.defaultValue;
  if (p.type === "SAMPLER2D")
    return `Global.getSettings().getSprite(${JSON.stringify(p.textureId || p.id)})`;
  if (p.type === "BOOL") return value ? "true" : "false";
  if (["INT", "UINT"].includes(p.type)) return String(Number(value || 0) | 0);
  if (components(p)) {
    const values = Array.isArray(value) ? value : [Number(value || 0)];
    return `new ${javaTypes[p.type]}(${Array.from({ length: components(p) }, (_, i) => javaNumber(Number(values[i] ?? (values.length === 1 ? values[0] : 0))) + "f").join(", ")})`;
  }
  return javaNumber(Number(value ?? 0)) + "f";
}
export function initExample(config, layout, textures, count = 8) {
  const parameters = allParameters(layout, textures),
    n = Math.max(1, Math.min(64, Math.trunc(count)));
  const args = [
    "CombatEngineLayers.BELOW_SHIPS_LAYER",
    n === 1
      ? "new Vector2f(100f, 100f)"
      : `java.util.Arrays.asList(\n${Array.from({ length: n }, (_, i) => `                new Vector2f(${100 + (i % 4) * 300}f, ${100 + Math.floor(i / 4) * 300}f)`).join(",\n")}\n            )`,
    ...parameters.map((p) =>
      p.scope === "instance" && n > 1
        ? `new ${javaTypes[p.type]}[] { ${Array.from({ length: n }, () => exampleValue(p)).join(", ")} }`
        : exampleValue(p),
    ),
  ];
  return `    @Override\n    public void init(CombatEngineAPI engine) {\n        engine.addLayeredRenderingPlugin(new ${config.className}(\n${args.map((arg) => "            " + arg).join(",\n")}\n        ));\n    }`;
}
export function constructionGuide(config, layout, textures) {
  return `首次导出会提示配置源码包路径并导出单个 WorkflowRuntime.java，之后复用，也可通过“运行依赖设置”随时修改路径。运行依赖更新后须重新导出并与特效一起编译。需要 Starsector 0.98a、BoxUtil 1.6.3、OpenGL 4.3 兼容上下文。
每次导出只有 1 个 Java + 2 个着色器。Java 源码必须编译进 mod_info.json 声明的 JAR，仅复制源码不会让游戏加载。
将 data/ 合并到 Mod 根目录，保留完整着色器目录，路径必须与 Java 构造器中的字符串一致。

单点构造器（坐标及每实例参数直接传单值）：
${config.className}(${signature(layout, textures, true)})
批量构造器：
${config.className}(${signature(layout, textures)})

单点传 Vector2f position，例如 ship.getLocation()。批量传 List<Vector2f> positions，每个向量创建一个实例，空列表创建空批次。
批量入口的“每实例变化”参数使用数组，第 i 项对应 positions.get(i)，长度等于 positions.size()。单点入口的这些参数直接传单值。
未勾选的节点参数整批共用，未勾选的几何值使用面板设置。参数名与节点／几何字段的参数 ID 一致。
列表、数组和向量在构造时读取为快照，后续修改原对象不会改变效果。

单点战斗入口 init 示例（复制到已有入口，无需增加示例文件）：
${initExample(config, layout, textures, 1)}

批量战斗入口 init 示例：
${initExample(config, layout, textures)}

跟随舰船：登记一次后，每帧调用 effect.instance(0).setPosition(ship.getLocation());
${layout.map((p) => `effect.set_${p.id}(${p.scope === "instance" ? "effect.instance(0), " : ""}value);`).join("\n")}
结束单个实例：effect.instance(0).remove(); 结束整批：effect.markExpired();
批次没有自动寿命，空批次保留资源以便复用，最终结束时请 markExpired。不要在 advanceInCombat 中每帧 new 并登记插件。
createInstance() 新增后需调用所有每实例参数 setter（包括颜色与波幅），否则参数从零开始。
已移除或已结束的实例不能继续更新。纹理整批共用，示例中的纹理 ID 需替换为 Mod 中实际资源。更新与绘制在战斗线程执行。
`;
}

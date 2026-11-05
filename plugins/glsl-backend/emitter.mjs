import { validateModule } from "../../packages/shader-ir/index.mjs";
const type = (t) =>
  ({ SAMPLER2D: "sampler2D", SAMPLER_CUBE: "samplerCube" })[t] ||
  (/^[A-Z][A-Z0-9_]*$/.test(t) ? t.toLowerCase() : t);
/** 唯一 GLSL 发射器，输入/输出可 JSON round-trip，不调用任何 JS 节点处理函数。 */
export function emitModule({ module, target }) {
  try {
    const m = validateModule(module, target),
      lines = [],
      sourceMap = [];
    let serial = 0;
    const write = (line, origin = null) => {
      lines.push(line);
      if (origin) sourceMap.push({ line: lines.length, ...origin });
    };
    const expression = (e, prefix, origin, locals = new Map()) => {
      const sub = (x) => expression(x, prefix, origin, locals);
      switch (e.kind) {
        case "literal":
          return e.type === "BOOL"
            ? String(e.value)
            : e.type === "UINT"
              ? e.value + "u"
              : e.type === "INT"
                ? String(e.value)
                : /[.eE]/.test(String(e.value))
                  ? String(e.value)
                  : e.value + ".0";
        case "symbol":
          return e.name;
        case "ref":
          return locals.get(e.name);
        case "member":
          return `(${sub(e.value)}).${e.field}`;
        case "index":
          return `${sub(e.value)}[${sub(e.index)}]`;
        case "unary":
          return `(${e.operator}${sub(e.value)})`;
        case "select":
          return `(${sub(e.condition)} ? ${sub(e.yes)} : ${sub(e.no)})`;
        case "binary":
          return `(${sub(e.left)} ${e.operator} ${sub(e.right)})`;
        case "call":
          return `${e.name}(${e.args.map(sub).join(", ")})`;
        case "swizzle":
          return `(${sub(e.args[0])}).${e.fields}`;
        case "block": {
          const local = new Map(locals);
          for (let i = 0; i < e.names.length; i++) {
            const v = e.args[i],
              code = expression(v, prefix, origin, local),
              n = "wf_ir_" + serial++;
            write(prefix + `${type(v.type)} ${n} = ${code};`, origin);
            local.set(e.names[i], n);
          }
          return expression(e.args.at(-1), prefix, origin, local);
        }
      }
    };
    const statements = (items, indent = "    ") => {
      for (const s of items) {
        const emit = (e) => expression(e, indent, s.origin);
        switch (s.kind) {
          case "declare": {
            const value = emit(s.value);
            write(indent + `${type(s.type)} ${s.name} = ${value};`, s.origin);
            break;
          }
          case "assign": {
            const value = emit(s.value);
            write(indent + `${emit(s.to)} = ${value};`, s.origin);
            break;
          }
          case "call":
            write(indent + emit(s.value) + ";", s.origin);
            break;
          case "return":
            write(
              indent + "return" + (s.value ? " " + emit(s.value) : "") + ";",
              s.origin,
            );
            break;
          case "if":
            write(indent + `if (${emit(s.condition)}) {`, s.origin);
            statements(s.yes, indent + "    ");
            if (s.no?.length) {
              write(indent + "} else {", s.origin);
              statements(s.no, indent + "    ");
            }
            write(indent + "}", s.origin);
            break;
          case "for":
            write(
              indent +
                `for (int ${s.index} = 0; ${s.index} < int(max(${emit(s.count)}, ${type(s.count.type)}(0))); ++${s.index}) {`,
              s.origin,
            );
            statements(s.body, indent + "    ");
            write(indent + "}", s.origin);
            break;
        }
      }
    };
    write(target === "glsl-430" ? "#version 430" : "#version 300 es");
    if (target === "glsl-es-300") {
      write("precision highp float;");
      write("precision highp int;");
    }
    for (const s of m.structs) {
      write("struct " + s.name + " {");
      for (const p of s.members) write(`    ${type(p.type)} ${p.name};`);
      write("};");
    }
    for (const r of m.resources) {
      const layout = [
          r.layout,
          r.binding !== undefined ? "binding=" + r.binding : null,
          r.location !== undefined ? "location=" + r.location : null,
        ].filter(Boolean),
        prefix = layout.length ? "layout(" + layout.join(", ") + ") " : "";
      if (["buffer", "uniformBlock"].includes(r.storage)) {
        write(
          prefix +
            (r.readonly ? "readonly " : "") +
            (r.storage === "uniformBlock" ? "uniform" : "buffer") +
            " " +
            r.name +
            " {",
          r.origin,
        );
        for (const p of r.members)
          write(
            `    ${type(p.type)} ${p.name}${p.array ? "[]" : ""};`,
            r.origin,
          );
        write("};");
      } else
        write(
          prefix +
            (r.flat ? "flat " : "") +
            r.storage +
            ` ${type(r.type)} ${r.name}` +
            (r.storage === "const"
              ? " = " + expression(r.value, "", r.origin)
              : "") +
            ";",
          r.origin,
        );
    }
    for (const f of m.functions) {
      if (f.raw && f.helpers)
        for (const line of f.helpers.split("\n")) write(line, f.origin);
      write(
        `${type(f.returns)} ${f.name}(${f.parameters.map((p) => `${p.qualifier || "in"} ${type(p.type)} ${p.name}`).join(", ")}) {`,
        f.origin,
      );
      if (f.raw)
        for (const line of f.code.split("\n")) write("    " + line, f.origin);
      else statements(f.body);
      write("}", f.origin);
    }
    write("void main() {");
    statements(m.body);
    write("}");
    return {
      ok: true,
      source: lines.join("\n") + "\n",
      diagnostics: [],
      reflection: { stage: m.stage, target, resources: m.resources },
      sourceMap,
    };
  } catch (error) {
    return {
      ok: false,
      source: "",
      diagnostics: [
        {
          code: error.code || "INVALID_SHADER_IR",
          message: error.message,
          ...(error.origin ? { origin: error.origin } : {}),
        },
      ],
      reflection: {},
      sourceMap: [],
    };
  }
}

<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import { readDeclaration } from "../../packages/plugin-sdk/declarative.mjs";
import {
  defaultDrawing,
  readDrawing,
} from "../../packages/plugin-sdk/drawing.mjs";
import type { Declaration } from "../../packages/plugin-sdk/declarative-types";
import {
  containerTypes,
  layoutRows,
  nodeAt,
  moveControl,
  removeControl,
  renameControl,
} from "./declaration-layout.mjs";
const props = defineProps<{
  modelValue: Declaration;
  controls: Record<string, Component>;
}>();
const emit = defineEmits<{ "update:modelValue": [value: Declaration] }>();
const error = ref(""),
  json = ref(""),
  addParent = ref(""),
  addType = ref("number");
const rows = computed(() => layoutRows(props.modelValue.tree));
const drawingDrafts = ref<Record<string, string>>({});
const simple = computed(() =>
  containerTypes.includes(props.modelValue.tree.type),
);
const fields = computed<any[]>(() =>
  rows.value
    .filter((r: any) => r.path.length)
    .map((r: any) => ({
      ...r.node,
      _path: r.path,
      _index: r.index,
      _count: r.parent.children.length,
    })),
);
const numberFields = computed(() =>
  fields.value
    .filter((n) => n.type === "number")
    .map((n) => ({ value: n.id, label: n.label || n.id })),
);
const textFields = computed(() =>
  fields.value
    .filter((n) => ["input", "textarea", "select"].includes(n.type))
    .map((n) => ({ value: n.id, label: n.label || n.id })),
);
const options = [
  { value: "number", label: "数值输入" },
  { value: "input", label: "文本输入" },
  { value: "textarea", label: "多行输入" },
  { value: "toggle", label: "开关" },
  { value: "select", label: "选择框" },
  { value: "text", label: "说明文字" },
  { value: "drawing", label: "二维绘图" },
  { value: "button", label: "操作按钮" },
  { value: "column", label: "纵向分组" },
  { value: "row", label: "横向分组" },
  { value: "panel", label: "面板分组" },
  { value: "disclosure", label: "折叠分组" },
];
const pathKey = (path: number[]) => path.join(".");
const parsePath = (key: string) =>
  key === "" ? [] : key.split(".").map(Number);
function parents(index?: number) {
  const source = index === undefined ? undefined : fields.value[index]._path;
  return rows.value
    .filter(
      (r: any) =>
        containerTypes.includes(r.node.type) &&
        (!source ||
          !(
            source.length <= r.path.length &&
            source.every((v: number, i: number) => v === r.path[i])
          )),
    )
    .map((r: any) => ({
      value: pathKey(r.path),
      label: r.path.length
        ? "　".repeat(r.path.length - 1) +
          (r.node.label || r.node.id) +
          "（" +
          r.node.id +
          "）"
        : "根布局",
    }));
}
function replace(fn: () => any) {
  try {
    emit("update:modelValue", fn());
    error.value = "";
    addParent.value = "";
  } catch (e) {
    error.value = String(e);
  }
}
function move(index: number, destination: string) {
  replace(() =>
    moveControl(
      JSON.parse(JSON.stringify(props.modelValue)),
      fields.value[index]._path,
      parsePath(destination),
    ),
  );
}
function rootLayout(value: string) {
  update((d) => {
    d.tree.type = value;
    delete d.tree.defaultExpanded;
    if (value === "disclosure") d.tree.defaultExpanded = false;
  });
}
function wrapRoot() {
  replace(() => {
    const d = structuredClone(JSON.parse(JSON.stringify(props.modelValue)));
    let id = "layoutRoot";
    while (rows.value.some((r: any) => r.node.id === id)) id += "_";
    d.tree = { id, type: "column", children: [d.tree] };
    return readDeclaration(d);
  });
}
const kinds = [
  { value: "summary", label: "读取工作流信息" },
  { value: "move", label: "移动节点" },
  { value: "rename", label: "重命名节点" },
  { value: "undo", label: "撤销" },
  { value: "redo", label: "重做" },
  { value: "stage", label: "切换着色器阶段" },
];
function update(fn: (d: any) => void) {
  try {
    const d = JSON.parse(JSON.stringify(props.modelValue));
    fn(d);
    emit("update:modelValue", d);
    error.value = "";
  } catch (e) {
    error.value = String(e);
  }
}
const action = (id: string): any =>
  props.modelValue.actions.find((a) => a.on === id);
function kind(id: string, value: string) {
  update((d) => {
    d.actions = d.actions.filter((a: any) => a.on !== id);
    d.actions.push({
      on: id,
      kind: value,
      ...(value === "move"
        ? { target: "selection-or-all", dx: 32, dy: 0 }
        : value === "rename"
          ? { target: "selection", title: "节点" }
          : value === "stage"
            ? { stage: "vertex" }
            : {}),
    });
  });
}
function changeAction(id: string, key: string, value: any) {
  update((d) => {
    const a = d.actions.find((a: any) => a.on === id);
    if (a) a[key] = value;
  });
}
function field(index: number, key: string, value: any) {
  update((d) => {
    nodeAt(d.tree, fields.value[index]._path)[key] = value;
  });
}
function rename(index: number, value: string) {
  replace(() =>
    renameControl(
      JSON.parse(JSON.stringify(props.modelValue)),
      fields.value[index]._path,
      value,
    ),
  );
}
function control(id: string, type: string) {
  return {
    id,
    type,
    label: id,
    ...(["number", "input", "textarea", "toggle", "select"].includes(type)
      ? {
          value:
            type === "number"
              ? 0
              : type === "toggle"
                ? false
                : type === "select"
                  ? "first"
                  : "",
        }
      : {}),
    ...(type === "text" ? { text: "说明文字" } : {}),
    ...(type === "textarea" ? { rows: 4 } : {}),
    ...(type === "drawing" ? { scene: defaultDrawing() } : {}),
    ...(containerTypes.includes(type) ? { children: [] } : {}),
    ...(type === "disclosure" ? { defaultExpanded: false } : {}),
    ...(type === "select"
      ? { options: [{ value: "first", label: "选项一" }] }
      : {}),
  };
}
function applyDrawing(index: number) {
  replace(() => {
    const d = JSON.parse(JSON.stringify(props.modelValue)),
      n = nodeAt(d.tree, fields.value[index]._path);
    n.scene = readDrawing(
      JSON.parse(drawingDrafts.value[n.id] ?? JSON.stringify(n.scene)),
    );
    return readDeclaration(d);
  });
}
function type(index: number, value: string) {
  update((d) => {
    const path = fields.value[index]._path,
      old = nodeAt(d.tree, path);
    if (old.children?.length && !containerTypes.includes(value))
      throw Error("请先移出分组内的控件，再改为非容器类型");
    nodeAt(d.tree, path.slice(0, -1)).children[path.at(-1)] = {
      ...control(old.id, value),
      label: old.label,
      ...(containerTypes.includes(value)
        ? { children: old.children || [] }
        : {}),
    };
    d.actions = d.actions.filter((a: any) => a.on !== old.id);
    if (value === "button") d.actions.push({ on: old.id, kind: "summary" });
  });
}
function add() {
  replace(() => {
    const d = JSON.parse(JSON.stringify(props.modelValue));
    let n = 1;
    while (rows.value.some((r: any) => r.node.id === "field" + n)) n++;
    nodeAt(d.tree, parsePath(addParent.value)).children.push(
      control("field" + n, addType.value),
    );
    if (addType.value === "button")
      d.actions.push({ on: "field" + n, kind: "summary" });
    return readDeclaration(d);
  });
}
function remove(index: number) {
  replace(() =>
    removeControl(
      JSON.parse(JSON.stringify(props.modelValue)),
      fields.value[index]._path,
    ),
  );
}
function reorder(index: number, delta: number) {
  replace(() => {
    const d = JSON.parse(JSON.stringify(props.modelValue)),
      path = fields.value[index]._path;
    const list = nodeAt(d.tree, path.slice(0, -1)).children,
      at = path.at(-1);
    if (at + delta < 0 || at + delta >= list.length)
      throw Error("已到当前分组边界");
    [list[at], list[at + delta]] = [list[at + delta], list[at]];
    return readDeclaration(d);
  });
}
function applyJson() {
  try {
    emit(
      "update:modelValue",
      readDeclaration(JSON.parse(json.value)) as Declaration,
    );
    error.value = "";
  } catch (e) {
    error.value = String(e);
  }
}
</script>
<template>
  <section class="declaration-editor" aria-label="无脚本面板配置">
    <p v-if="error" role="alert" class="declaration-error">{{ error }}</p>
    <p>
      只保存一个
      studio-plugin.json，无需入口脚本。按钮通过公开事务操作当前工作流。
    </p>
    <component :is="controls.UiField" label="面板标题" for="decl-title"
      ><component
        :is="controls.UiInput"
        id="decl-title"
        :model-value="modelValue.panel.title"
        @update:model-value="
          (v: unknown) => update((d) => (d.panel.title = String(v)))
        "
    /></component>
    <component :is="controls.UiField" label="显示方式" for="decl-placement">
      <component
        :is="controls.UiSelect"
        id="decl-placement"
        :model-value="modelValue.panel.placement || 'dock'"
        :options="[
          { value: 'dock', label: '工作区停靠面板' },
          { value: 'settings', label: '插件设置页' },
          { value: 'dialog', label: '独立工具窗口' },
        ]"
        @update:model-value="
          (v: unknown) => update((d) => (d.panel.placement = String(v)))
        "
      />
    </component>
    <p v-if="modelValue.panel.placement === 'dialog'">
      从“插件 → 插件设置”点击“打开窗口”使用工具，关闭后可再次打开。
    </p>
    <component
      v-if="
        !modelValue.panel.placement || modelValue.panel.placement === 'dock'
      "
      :is="controls.UiField"
      label="面板位置"
      for="decl-side"
      ><component
        :is="controls.UiSelect"
        id="decl-side"
        :model-value="modelValue.panel.side"
        :options="[
          { value: 'left', label: '左侧' },
          { value: 'right', label: '右侧' },
          { value: 'bottom', label: '底部' },
        ]"
        @update:model-value="
          (v: unknown) => update((d) => (d.panel.side = String(v)))
        "
    /></component>
    <div v-if="!simple">
      <p>
        当前只有一个根控件。转换为分组后，可在可视化编辑器添加和嵌套其他控件。
      </p>
      <component :is="controls.UiButton" @click="wrapRoot"
        >转换为分组布局</component
      >
    </div>
    <template v-else>
      <component :is="controls.UiField" label="根布局" for="decl-root-layout">
        <component
          :is="controls.UiSelect"
          id="decl-root-layout"
          :model-value="modelValue.tree.type"
          :options="options.filter((o) => containerTypes.includes(o.value))"
          @update:model-value="(v: unknown) => rootLayout(String(v))"
        />
      </component>
      <p>
        使用“所属分组”移动控件，上移、下移在同组内排序。分组可嵌套，按钮绑定会随控件
        ID 更新。
      </p>
      <component
        :is="controls.UiField"
        label="根分组标题（可选）"
        for="decl-root-label"
      >
        <component
          :is="controls.UiInput"
          id="decl-root-label"
          :model-value="modelValue.tree.label || ''"
          @update:model-value="
            (v: unknown) => update((d) => (d.tree.label = String(v)))
          "
        />
      </component>
      <component
        v-if="modelValue.tree.type === 'disclosure'"
        :is="controls.UiCheckbox"
        :model-value="!!modelValue.tree.defaultExpanded"
        @update:model-value="
          (v: unknown) => update((d) => (d.tree.defaultExpanded = !!v))
        "
        >默认展开根分组</component
      >
      <article
        v-for="(n, i) in fields"
        :key="i"
        class="declaration-control"
        :data-declaration-control="i"
        :data-control-id="n.id"
        :style="{ marginLeft: Math.min(n._path.length - 1, 6) * 12 + 'px' }"
      >
        <div class="declaration-row">
          <strong
            >{{ containerTypes.includes(n.type) ? "分组" : "控件" }}
            {{ i + 1 }} · {{ n.label || n.id }}</strong
          >
          <component
            :is="controls.UiButton"
            :disabled="n._index === 0"
            :aria-label="'上移控件 ' + n.id"
            @click="reorder(i, -1)"
            >上移</component
          >
          <component
            :is="controls.UiButton"
            :disabled="n._index === n._count - 1"
            :aria-label="'下移控件 ' + n.id"
            @click="reorder(i, 1)"
            >下移</component
          >
          <component
            :is="controls.UiButton"
            :aria-label="'移除控件 ' + n.id"
            @click="remove(i)"
            >移除</component
          >
        </div>
        <component
          :is="controls.UiField"
          label="所属分组"
          :for="'decl-parent-' + i"
        >
          <component
            :is="controls.UiSelect"
            :id="'decl-parent-' + i"
            :model-value="pathKey(n._path.slice(0, -1))"
            :options="parents(i)"
            @update:model-value="(v: unknown) => move(i, String(v))"
          />
        </component>
        <component :is="controls.UiField" label="控件 ID" :for="'decl-id-' + i"
          ><component
            :is="controls.UiInput"
            :id="'decl-id-' + i"
            :model-value="n.id"
            @update:model-value="(v: unknown) => rename(i, String(v))"
        /></component>
        <component
          :is="controls.UiField"
          label="控件类型"
          :for="'decl-type-' + i"
          ><component
            :is="controls.UiSelect"
            :id="'decl-type-' + i"
            :model-value="n.type"
            :options="options"
            @update:model-value="(v: unknown) => type(i, String(v))"
        /></component>
        <component
          :is="controls.UiField"
          label="显示文字"
          :for="'decl-label-' + i"
          ><component
            :is="controls.UiInput"
            :id="'decl-label-' + i"
            :model-value="n.label"
            @update:model-value="(v: unknown) => field(i, 'label', String(v))"
        /></component>
        <component
          v-if="n.type === 'number' || n.type === 'input'"
          :is="controls.UiField"
          label="初始值"
          :for="'decl-value-' + i"
          ><component
            :is="controls.UiInput"
            :id="'decl-value-' + i"
            :type="n.type === 'number' ? 'number' : 'text'"
            :model-value="String(n.value)"
            @update:model-value="
              (v: unknown) =>
                field(i, 'value', n.type === 'number' ? Number(v) : String(v))
            "
        /></component>
        <template v-if="n.type === 'textarea'">
          <component
            :is="controls.UiField"
            label="初始内容"
            :for="'decl-value-' + i"
          >
            <component
              :is="controls.UiTextarea"
              :id="'decl-value-' + i"
              :model-value="n.value"
              :rows="n.rows || 4"
              :maxlength="4000"
              @update:model-value="(v: unknown) => field(i, 'value', String(v))"
            />
          </component>
          <component
            :is="controls.UiField"
            label="显示行数"
            :for="'decl-rows-' + i"
          >
            <component
              :is="controls.UiInput"
              :id="'decl-rows-' + i"
              type="number"
              :min="2"
              :max="20"
              :model-value="String(n.rows || 4)"
              @update:model-value="(v: unknown) => field(i, 'rows', Number(v))"
            />
          </component>
        </template>
        <template v-if="n.type === 'drawing'">
          <component
            :is="controls.UiDrawingSurface"
            :scene="n.scene"
            :label="'绘图预览 ' + n.id"
          />
          <p>
            绘图内容不会执行代码。编辑尺寸、背景和图元后点击应用，坐标使用画布逻辑像素。
          </p>
          <component
            :is="controls.UiField"
            label="绘图场景 JSON"
            :for="'decl-drawing-' + i"
          >
            <component
              :is="controls.UiTextarea"
              :id="'decl-drawing-' + i"
              :rows="10"
              :model-value="
                drawingDrafts[n.id] ?? JSON.stringify(n.scene, null, 2)
              "
              @update:model-value="
                (v: unknown) => (drawingDrafts[n.id] = String(v))
              "
            />
          </component>
          <component
            :is="controls.UiButton"
            :aria-label="'应用绘图内容 ' + n.id"
            @click="applyDrawing(i)"
            >应用绘图内容</component
          >
        </template>
        <component
          v-if="n.type === 'disclosure'"
          :is="controls.UiCheckbox"
          :model-value="!!n.defaultExpanded"
          @update:model-value="(v: unknown) => field(i, 'defaultExpanded', !!v)"
          >默认展开分组</component
        >
        <component
          v-if="n.type === 'toggle'"
          :is="controls.UiCheckbox"
          :model-value="n.value"
          @update:model-value="(v: unknown) => field(i, 'value', !!v)"
          >默认开启</component
        >
        <component
          v-if="n.type === 'text'"
          :is="controls.UiTextarea"
          :model-value="n.text"
          aria-label="说明内容"
          @update:model-value="(v: unknown) => field(i, 'text', String(v))"
        />
        <template v-if="n.type === 'select'">
          <component
            :is="controls.UiField"
            label="选项（每行 值|显示文字）"
            :for="'decl-options-' + i"
            ><component
              :is="controls.UiTextarea"
              :id="'decl-options-' + i"
              :model-value="
                n.options.map((o: any) => o.value + '|' + o.label).join('\n')
              "
              @update:model-value="
                (v: unknown) =>
                  field(
                    i,
                    'options',
                    String(v)
                      .split('\n')
                      .map((line) => {
                        const at = line.indexOf('|');
                        return at < 0
                          ? { value: line, label: line }
                          : {
                              value: line.slice(0, at),
                              label: line.slice(at + 1),
                            };
                      }),
                  )
              "
          /></component>
          <component
            :is="controls.UiField"
            label="默认选项"
            :for="'decl-value-' + i"
            ><component
              :is="controls.UiInput"
              :id="'decl-value-' + i"
              :model-value="n.value"
              @update:model-value="
                (v: unknown) => field(i, 'value', String(v))
              "
          /></component>
        </template>
        <template v-if="n.type === 'button'">
          <component
            :is="controls.UiField"
            label="点击操作"
            :for="'decl-action-' + i"
            ><component
              :is="controls.UiSelect"
              :id="'decl-action-' + i"
              :model-value="action(n.id)?.kind || 'summary'"
              :options="kinds"
              @update:model-value="(v: unknown) => kind(n.id, String(v))"
          /></component>
          <component
            v-if="['move', 'rename'].includes(action(n.id)?.kind)"
            :is="controls.UiField"
            label="作用范围"
            :for="'decl-target-' + i"
            ><component
              :is="controls.UiSelect"
              :id="'decl-target-' + i"
              :model-value="action(n.id).target"
              :options="[
                { value: 'selection', label: '仅选中节点' },
                { value: 'all', label: '全部节点' },
                { value: 'selection-or-all', label: '选中节点，未选择时全部' },
              ]"
              @update:model-value="
                (v: unknown) => changeAction(n.id, 'target', String(v))
              "
          /></component>
          <template v-if="action(n.id)?.kind === 'move'">
            <div v-for="axis in ['dx', 'dy']" :key="axis">
              <component
                :is="controls.UiField"
                :label="axis === 'dx' ? '水平位移参数' : '垂直位移参数'"
                :for="'decl-bind-' + i + '-' + axis"
                ><component
                  :is="controls.UiSelect"
                  :id="'decl-bind-' + i + '-' + axis"
                  :model-value="action(n.id)[axis]?.control || ''"
                  :options="[{ value: '', label: '固定值' }, ...numberFields]"
                  @update:model-value="
                    (v: unknown) =>
                      changeAction(n.id, axis, v ? { control: String(v) } : 0)
                  "
              /></component>
              <component
                v-if="typeof action(n.id)[axis] === 'number'"
                :is="controls.UiInput"
                type="number"
                :aria-label="axis + ' 固定值'"
                :model-value="String(action(n.id)[axis])"
                @update:model-value="
                  (v: unknown) => changeAction(n.id, axis, Number(v))
                "
              />
            </div>
          </template>
          <template v-if="action(n.id)?.kind === 'rename'">
            <component
              :is="controls.UiField"
              label="名称参数"
              :for="'decl-name-bind-' + i"
              ><component
                :is="controls.UiSelect"
                :id="'decl-name-bind-' + i"
                :model-value="action(n.id).title?.control || ''"
                :options="[{ value: '', label: '固定名称' }, ...textFields]"
                @update:model-value="
                  (v: unknown) =>
                    changeAction(
                      n.id,
                      'title',
                      v ? { control: String(v) } : '节点',
                    )
                "
            /></component>
            <component
              v-if="typeof action(n.id).title === 'string'"
              :is="controls.UiInput"
              aria-label="固定名称"
              :model-value="action(n.id).title"
              @update:model-value="
                (v: unknown) => changeAction(n.id, 'title', String(v))
              "
            />
          </template>
          <component
            v-if="action(n.id)?.kind === 'stage'"
            :is="controls.UiSelect"
            aria-label="目的着色器阶段"
            :model-value="action(n.id).stage"
            :options="[
              { value: 'vertex', label: '顶点' },
              { value: 'fragment', label: '片段' },
            ]"
            @update:model-value="
              (v: unknown) => changeAction(n.id, 'stage', String(v))
            "
          />
        </template>
      </article>
      <div class="declaration-add">
        <component
          :is="controls.UiField"
          label="添加到分组"
          for="decl-add-parent"
          ><component
            :is="controls.UiSelect"
            id="decl-add-parent"
            v-model="addParent"
            :options="parents()"
        /></component>
        <component :is="controls.UiField" label="新控件类型" for="decl-add-type"
          ><component
            :is="controls.UiSelect"
            id="decl-add-type"
            v-model="addType"
            :options="options"
        /></component>
        <component
          :is="controls.UiButton"
          id="decl-add-control"
          :disabled="fields.length >= 249"
          @click="add"
          >添加控件</component
        >
      </div>
    </template>
    <details
      @toggle="
        (e: any) => {
          if (e.target.open) json = JSON.stringify(modelValue, null, 2);
        }
      "
    >
      <summary>完整 JSON 布局与动作</summary>
      <p>
        支持 row / column / panel / disclosure 嵌套容器及 textarea
        多行输入，应用前校验 ID、类型、按钮引用和操作范围。
      </p>
      <component
        :is="controls.UiTextarea"
        id="decl-json"
        v-model="json"
        :rows="15"
        aria-label="完整声明式配置"
      />
      <component :is="controls.UiButton" id="decl-apply-json" @click="applyJson"
        >校验并应用 JSON</component
      >
    </details>
  </section>
</template>
<style scoped>
.declaration-editor,
.declaration-control {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.declaration-control {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 12px;
}
.declaration-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.declaration-row strong {
  flex: 1;
}
.declaration-error {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--color-danger);
  background: var(--color-panel);
  color: var(--color-danger);
}
</style>

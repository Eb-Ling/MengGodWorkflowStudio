<script setup lang="ts">
import { ref, reactive, computed, watch, onBeforeUnmount, nextTick } from "vue";
const props = defineProps<{
    ui: any;
    workflow: any;
    snapshot: any;
    presentation: any;
    exporter: any;
    preview: any;
  }>(),
  { UiDialog, UiButton, UiInput, UiCheckbox } = props.ui.components;
const visible = ref(false),
  canvas = ref<HTMLCanvasElement>(),
  state = reactive({
    count: 8,
    selected: 1,
    time: 0,
    overrides: {} as Record<string, string>,
    values: {} as Record<string, string>,
    ids: {} as Record<string, string>,
    invalid: {} as Record<string, boolean>,
    status: "",
    signature: "",
    example: "",
    parameters: [] as any[],
    fields: [] as any[],
  });
let generation = 0,
  configurationGeneration = 0,
  view: any = null,
  live = true;
const snapshot = computed(() => props.snapshot.value),
  documentValue = () => {
    const s = snapshot.value;
    return {
      config: s.project,
      fragment: s.fragmentGraph,
      geometry: s.vertexTransform,
    };
  };
const guard = () => {
  const s = props.workflow.snapshot();
  return {
    documentId: s.project.id,
    documentToken: s.documentToken,
    stage: s.stage,
    expectedRevision: s.graph.revision,
    expectedDocumentRevision: s.documentRevision,
  };
};
async function write(transform: any, source = guard()) {
  const result = await props.workflow.execute({
    ...source,
    actions: [{ type: "SET_VERTEX_TRANSFORM", payload: transform }],
  });
  if (!result.ok) throw Error(result.error);
}
async function load() {
  const turn = ++configurationGeneration, source = guard();
  try {
    const result = await props.exporter.configuration( {geometry:snapshot.value.vertexTransform});
    if (!live || !visible.value || turn !== configurationGeneration || source.documentToken !== guard().documentToken || source.expectedDocumentRevision !== guard().expectedDocumentRevision) return;
    state.fields = result.fields;
    for (const f of result.fields) {
      state.values[f.key] = String(f.value);
      state.ids[f.key] = f.id;
    }
    state.parameters = props.presentation.snapshot().parameters;
  } catch (e: any) {
    if (live && turn === configurationGeneration) state.status = e.message;
  }
}
async function editField(edit: any) {
  const source = guard(), turn = configurationGeneration;
  const result = await props.exporter.configuration( {geometry:snapshot.value.vertexTransform, edit});
  if (!live || !visible.value || turn !== configurationGeneration) return;
  await write(result.geometry, source);
}
async function render() {
  if (!visible.value || !live) return;
  const turn = ++generation,
    doc = documentValue();
  state.status = "正在编译预览…";
  void Promise.resolve()
    .then(() =>
      props.exporter.guide( {
        document: doc,
        count: state.count,
      }),
    )
    .then((r: any) => {
      if (turn === generation && live) {
        state.signature = r.signature;
        state.example = r.example;
      }
    })
    .catch((e: any) => {
      if (turn === generation && live) {
        state.signature = "导出说明不可用：" + e.message;
        state.example = "";
      }
    });
  await nextTick();
  if (!canvas.value || turn !== generation || !live) return;
  try {
    view ||= props.preview.mount(canvas.value);
    const result = await view.render({
      document: doc,
      stage: snapshot.value.stage,
      width: 840,
      height: 300,
      time: state.time,
      geometry: {
        count: state.count,
        selected: state.selected,
        overrides: state.overrides,
      },
    });
    if (turn !== generation || !live) return;
    if (result.presented) {
      const cols = Math.ceil(Math.sqrt((state.count * 840) / 300)),
        rows = Math.ceil(state.count / cols),
        w = Math.floor(840 / cols),
        h = Math.floor(300 / rows),
        i = state.selected - 1,
        ctx = canvas.value.getContext("2d")!;
      ctx.strokeStyle = "#5ca8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        (i % cols) * w + 2,
        300 - (Math.floor(i / cols) + 1) * h + 2,
        w - 4,
        h - 4,
      );
    }
    state.status =
      "同一顶点与片段图的 WebGL2 预览，导出后由 Plugin 自动创建实例并使用 SSBO 绘制。";
  } catch (e: any) {
    if (turn === generation && live) {
      state.status = "检查失败：" + e.message;
    }
  }
}
async function change(f: any) {
  try {
    const value = Number(state.values[f.key]);
    if (!state.values[f.key] || !Number.isFinite(value))
      throw Error(f.label + "必须为有限数");
    await editField({field:f.key, value});
  } catch (e: any) {
    state.status = e.message;
  }
}
async function variation(f: any, enabled: boolean) {
  try {
    await editField({field:f.key, enabled, id:state.ids[f.key]});
    state.invalid[f.key] = false;
  } catch (e: any) {
    state.invalid[f.key] = true;
    state.status = e.message;
  }
}
async function id(f: any) {
  await variation(
    f,
    !!snapshot.value.vertexTransform.instanceInputs[f.key]?.enabled,
  );
}
async function scope(p: any, enabled: boolean) {
  try {
    const t = structuredClone(snapshot.value.vertexTransform);
    t.parameterModes[p.name] = enabled ? "instance" : "shared";
    await write(t);
  } catch (e: any) {
    state.status = e.message;
  }
}
function previewNumber(key: "count" | "selected" | "time", event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.value || !Number.isFinite(input.valueAsNumber)) {
    state.status = "预览参数必须为有限数";
    return;
  }
  state[key] =
    key === "count"
      ? Math.max(1, Math.min(64, Math.trunc(input.valueAsNumber)))
      : key === "selected"
        ? Math.max(1, Math.min(state.count, Math.trunc(input.valueAsNumber)))
        : input.valueAsNumber;
  state.selected = Math.min(state.count, state.selected);
  input.value = String(state[key]);
  void render();
}
function close() {
  visible.value = false;
  generation++;
  configurationGeneration++;
  view?.dispose();
  view = null;
}
watch(
  () => [
    snapshot.value.documentRevision,
    snapshot.value.documentToken,
    snapshot.value.stage,
  ],
  (next, old) => {
    if (next[1] !== old?.[1] || next[2] !== old?.[2]) close();
    else if (visible.value) {
      load();
      void render();
    }
  },
);
const stop = props.exporter.subscribe(() => {
  if (visible.value) { void load(); void render(); }
});
onBeforeUnmount(() => {
  live = false;
  close();
  stop();
});
async function hd(event: MouseEvent) {
  event.preventDefault();
  try {
    await view?.open({
      width: 840,
      height: 300,
      time: state.time,
      geometry: {
        count: state.count,
        selected: state.selected,
        overrides: state.overrides,
      },
    });
  } catch (e: any) {
    state.status = e.message;
  }
}
</script>
<template>
  <UiButton
    v-if="snapshot.stage === 'vertex'"
    id="vertex-settings"
    variant="ghost"
    @click="
      visible = true;
      load();
      render();
    "
    >几何设置</UiButton
  ><UiDialog
    id="geometry-dialog"
    class="geometry-dialog"
    title="顶点几何与实例预览"
    close-label="关闭几何设置"
    :visible="visible"
    @close="close"
    ><p class="geometry-help">
      单点直接传 Vector2f position（例如 ship.getLocation()）。批量传
      List&lt;Vector2f&gt; positions，每个向量创建一个实例。
      批量入口中“每实例变化”的参数使用数组，按坐标下标对应，单点入口直接传单值。
      几何参数未勾选时使用面板值，节点输入未勾选时整批共用。
    </p>
    <div class="geometry-fields">
      <div v-for="f in state.fields" :key="f.key" class="geometry-field">
        <label :for="'geometry-' + f.key">{{ f.label }}</label
        ><UiInput
          :id="'geometry-' + f.key"
          v-model="state.values[f.key]"
          type="number"
          step="any"
          :aria-label="f.label"
          @change="change(f)"
        /><UiCheckbox
          class="geometry-variation"
          :model-value="
            !!snapshot.vertexTransform.instanceInputs[f.key]?.enabled
          "
          :aria-label="f.label + ' 每实例变化'"
          @update:model-value="variation(f, $event)"
          >每实例变化</UiCheckbox
        ><UiInput
          v-if="snapshot.vertexTransform.instanceInputs[f.key]?.enabled"
          v-model="state.ids[f.key]"
          :aria-label="f.label + ' 参数 ID'"
          :aria-invalid="state.invalid[f.key]"
          @change="id(f)"
        />
      </div>
      <div
        v-for="p in [
          { key: 'count', id: 'preview-count', label: '预览实例数' },
          { key: 'selected', id: 'preview-selected', label: '参数作用的实例' },
          { key: 'time', id: 'preview-time', label: '预览时间' },
        ]"
        :key="p.key"
        class="geometry-field"
      >
        <label :for="p.id">{{ p.label }}</label
        ><UiInput
          :id="p.id"
          type="number"
          step="any"
          :model-value="String(state[p.key as 'count' | 'selected' | 'time'])"
          :aria-label="p.label"
          @change="
            previewNumber(p.key as 'count' | 'selected' | 'time', $event)
          "
        />
      </div>
      <div v-for="p in state.parameters" :key="p.name" class="geometry-field">
        <label :for="'preview-param-' + p.name">{{ p.id }}（节点预览值）</label
        ><UiInput
          :id="'preview-param-' + p.name"
          :model-value="state.overrides[p.name] ?? String(p.defaultValue)"
          :data-preview-param="p.name"
          @update:model-value="state.overrides[p.name] = $event"
          @change="render"
        /><UiCheckbox
          class="geometry-variation"
          :model-value="p.scope === 'instance'"
          :aria-label="p.id + ' 每实例变化'"
          @update:model-value="scope(p, $event)"
          >每实例变化</UiCheckbox
        >
      </div>
      <section class="instance-coordinate-guide" aria-label="导出实例坐标格式">
        <strong>导出构造器：直接传坐标和参数</strong>
        <pre class="constructor-signature">{{ state.signature }}</pre>
        <p class="instance-coordinate-count">
          当前预览 {{ state.count }} 个实例。要在 Mod 中创建
          {{ state.count }} 个实例，{{ state.count === 1
            ? '直接传入一个 Vector2f 及各参数单值。'
            : `传入包含 ${state.count} 个 Vector2f 的列表，勾选的参数数组也传 ${state.count} 项。` }}
        </p>
        <details>
          <summary>查看可直接使用的 init 示例</summary>
          <pre class="init-example">{{ state.example }}</pre>
        </details>
        <p>
          批量入口的变化数组长度必须等于 positions.size()。
          坐标是战斗世界坐标，角度单位为度。预览网格的位置和数量只用于展示。
        </p>
      </section>
    </div>
    <canvas ref="canvas" width="840" height="300" @contextmenu="hd" /><output>{{
      state.status
    }}</output></UiDialog
  >
</template>

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { zipBytes } from "../frontend/export/zip.js";
import { pluginManifestDraft } from "../packages/plugin-sdk/plugin-manifest.mjs";

/** 可独立解压运行的 SDK/测试包，不打包 Studio、Vue、业务插件或 Electron 二进制。 */
export async function pluginDevkitBytes() {
  const files = [];
  async function walk(folder) {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const filename = path.posix.join(folder, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else
        files.push({
          filename,
          content: new Uint8Array(await fs.readFile(filename)),
        });
    }
  }
  for (const folder of [
    "plugin-sdk",
    "kernel",
    "plugin-runtime",
    "extension-host",
    "plugin-testkit",
  ])
    await walk("packages/" + folder);
  // 仓储只复用这一公开读取端口，独立包不带安装登记、HTTP 或桌面适配。
  files.push({
    filename: "packages/native-host/plugin-files.mjs",
    content: await fs.readFile("packages/native-host/plugin-files.mjs", "utf8"),
  });
  files.push({
    filename: "README.md",
    content: (await fs.readFile("build/devkit-readme.md", "utf8")).replace("](../docs/PLUGIN_API_V1.md)", "](docs/PLUGIN_API_V1.md)"),
  });
  files.push({
    filename: "docs/PLUGIN_API_V1.md",
    content: (await fs.readFile("docs/PLUGIN_API_V1.md", "utf8")).replace(
      /\]\(\.\.\/([^()#\s]+)(#[^()\s]+)?\)/g,
      "](https://github.com/Eb-Ling/MengGodWorkflowStudio/blob/v1.0.0/$1$2)",
    ).replaceAll("](ARCHITECTURE_V1.md)", "](https://github.com/Eb-Ling/MengGodWorkflowStudio/blob/v1.0.0/docs/ARCHITECTURE_V1.md)"),
  });
  const add = (folder, manifest, source) => {
    files.push({
      filename: "examples/" + folder + "/studio-plugin.json",
      content: JSON.stringify(manifest, null, 2),
    });
    if (source)
      files.push({
        filename: "examples/" + folder + "/index.mjs",
        content: source,
      });
  };
  const node = pluginManifestDraft("kit-node");
  files.push({ filename: "examples/sdk-effect/README.md", content: await fs.readFile("build/examples/sdk-effect/README.md", "utf8") });
  files.push({ filename: "examples/sdk-effect/probes.mjs", content: await fs.readFile("build/examples/sdk-effect/probes.mjs", "utf8") });
  for (const folder of [
    "minimal-node",
    "glsl-node",
    "minimal-panel",
    "minimal-editor-panel",
    "sdk-effect",
  ])
    add(
      folder,
      JSON.parse(
        await fs.readFile(
          "build/examples/" + folder + "/studio-plugin.json",
          "utf8",
        ),
      ),
      await fs.readFile("build/examples/" + folder + "/index.mjs", "utf8"),
    );
  add(
    "native-window",
    JSON.parse(
      await fs.readFile(
        "build/examples/native-window/studio-plugin.json",
        "utf8",
      ),
    ),
    await fs.readFile("build/examples/native-window/index.mjs", "utf8"),
  );
  add(
    "node",
    node,
    `import {ir} from '@workflow/plugin-sdk/ir';
export const plugin={activate(c){
  const typeId=c.pluginId+'.value';
  c.api('workflow.nodes').register({nodes:[{typeId,title:'测试包数值',category:'本地插件',inputs:[],outputs:[{name:'value',type:'FLOAT'}],properties:{},stages:['vertex','fragment'],targets:['glsl-es-300','glsl-430']}],compilers:['glsl-es-300','glsl-430'].map(target=>({typeId,target,compile:()=>ir.literal('FLOAT',2)}))});
}};`,
  );
  const provider = {
    ...pluginManifestDraft("kit-provider", "index.mjs", "extension"),
    requiredApis: {},
    capabilities: [],
    activationEvents: ["onApi:local.kit-provider.value"],
    providesApis: {
      "local.kit-provider.value": {
        version: "1.0.0",
        methods: {
          read: {
            arguments: { type: "array", maxItems: 0 },
            returns: { type: "number" },
          },
        },
      },
    },
  };
  add(
    "provider",
    provider,
    `export const plugin={activate(c){c.provide(c.pluginId+'.value',{read:()=>42});}};`,
  );
  const consumer = {
    ...pluginManifestDraft("kit-consumer", "index.mjs", "extension"),
    requiredApis: {
      "local.kit-provider.value": "^1.0.0",
      "studio.extension-ui": "^1.0.0",
    },
    capabilities: ["extension.ui"],
  };
  add(
    "consumer",
    consumer,
    `export const plugin={async activate(c){
  const value=await c.api('local.kit-provider.value').read();if(value!==42)throw Error('提供者结果不符');
  await c.api('studio.extension-ui').create({id:c.pluginId+'.panel',title:'独立 API 测试',placement:'settings',tree:{id:'value',type:'text',text:'提供者返回：'+value}});
}};`,
  );
  add("visual", pluginManifestDraft("kit-visual", undefined, "declarative"));
  add(
    "drawing",
    {
      ...pluginManifestDraft("kit-drawing", "index.mjs", "extension"),
      name: "教学：二维交互绘图",
      requiredApis: { "studio.extension-ui": "^1.0.0" },
      capabilities: ["extension.ui"],
    },
    `import {defaultDrawing} from '@workflow/plugin-sdk/drawing';
// 场景只是数据，渲染由公共 UiDrawingSurface 完成，不获取 DOM 或 Canvas 上下文。
export const plugin={async activate(c){
  const ui=c.api('studio.extension-ui'), id=c.pluginId+'.panel';
  let scene=defaultDrawing(), status='点击画布读取坐标，Enter/空格选择中心。', after=0, revision=0, busy=false, live=true, timer;
  const tree=()=>({id:'root',type:'column',children:[
    {id:'plot',type:'drawing',label:'交互绘图',interactive:true,scene},
    {id:'status',type:'text',text:status},
    {id:'reset',type:'button',label:'恢复绘图'},
    {id:'clear',type:'button',label:'清空绘图'}
  ]});
  c.onDispose(()=>{live=false;clearInterval(timer);});
  revision=(await ui.create({id,title:'教学：二维交互绘图',placement:'dialog',tree:tree()})).revision;
  timer=setInterval(async()=>{
    if(!live||busy)return;busy=true;
    try{
      const batch=await ui.events({after});after=batch.cursor;let changed=false;
      for(const e of batch.events){
        if(e.panelId!==id||e.revision!==revision)continue;
        if(e.controlId==='plot'&&e.type==='point'){status='位置：'+Math.round(e.value.x)+', '+Math.round(e.value.y);changed=true;}
        if(e.controlId==='reset'&&e.type==='click'){scene=defaultDrawing();status='已恢复绘图';changed=true;}
        if(e.controlId==='clear'&&e.type==='click'){scene={width:480,height:240,background:'#151a22',commands:[]};status='已清空绘图';changed=true;}
      }
      if(live&&changed)revision=(await ui.update({id,tree:tree()})).revision;
    }catch(e){if(live)throw e;}finally{busy=false;}
  },100);
}};`,
  );
  const probes = ["glsl-es-300", "glsl-430"].flatMap((target) =>
    ["vertex", "fragment"].map((stage) => ({
      kind: "compile",
      pluginId: node.id,
      typeId: node.id + ".value",
      target,
      context: {
        node: { id: "value", typeId: node.id + ".value", properties: {} },
        socket: "value",
        stage,
      },
      expected: { kind: "literal", type: "FLOAT", value: 2 },
    })),
  );
  files.push({
    filename: "examples/fixtures.json",
    content: JSON.stringify(
      { seed: 20261103, cycles: 3, restartPasses: 1, settleMs: 100, probes },
      null,
      2,
    ),
  });
  files.sort((a, b) => a.filename.localeCompare(b.filename));
  const hashes = Object.fromEntries(
    files.map((f) => [
      f.filename,
      createHash("sha256").update(f.content).digest("hex"),
    ]),
  );
  files.push({
    filename: "manifest.sha256.json",
    content: JSON.stringify({ version: "1.0.0", files: hashes }, null, 2),
  });
  return zipBytes(files);
}

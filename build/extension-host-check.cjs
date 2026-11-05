// 开发者集成夹具：测试真实 Electron 隔离边界，不冒充用户操作路径。
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const {
  createExtensionRunner,
} = require("../packages/extension-host/electron-runner.cjs");
const {
  pluginManifestDraft,
} = require("../packages/plugin-sdk/plugin-manifest.mjs");
const output = process.argv.find((s) => s.startsWith("--result="))?.slice(9);
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  const results = [];
  let active;
  try {
    const manifest = pluginManifestDraft("sandbox-test");
    const source = `import {ir} from '@workflow/plugin-sdk/ir';
      export const plugin={async activate(c){
        if(typeof process!=='undefined'||typeof require!=='undefined'||window.workflowDesktop)throw Error('platform leak');
        try{await fetch('https://example.com/');throw Error('network leak');}catch(e){if(e.message==='network leak')throw e;}
        try{await import('file:///C:/Windows/win.ini');throw Error('file leak');}catch(e){if(e.message==='file leak')throw e;}
        c.api('workflow.nodes').register({nodes:[{typeId:c.pluginId+'.double',title:'Double',inputs:[],outputs:[{name:'value',type:'FLOAT'}]}],compilers:[{typeId:c.pluginId+'.double',target:'glsl-es-300',compile:()=>ir.literal('FLOAT',2)}]});
      }};`;
    active = await createExtensionRunner(
      { manifest, files: { "index.mjs": source } },
      { timeoutMs: 10000 },
    );
    assert.equal(active.contribution.nodes[0].typeId, manifest.id + ".double");
    assert.deepEqual(
      await active.request("compile", {
        typeId: manifest.id + ".double",
        target: "glsl-es-300",
        context: {},
      }),
      { kind: "literal", type: "FLOAT", value: 2 },
    );
    await active.dispose();
    active = null;
    results.push(
      "SDK import, compile, no Node/Studio bridge, network/file blocked, dispose",
    );
    await assert.rejects(
      createExtensionRunner(
        {
          manifest,
          files: {
            "index.mjs": "export const plugin={activate(){while(true){}}};",
          },
        },
        { timeoutMs: 1500 },
      ),
      /超时/,
    );
    results.push("activation hang stopped");
    active = await createExtensionRunner(
      {
        manifest,
        files: {
          "index.mjs": `export const plugin={activate(c){c.api('workflow.nodes').register({nodes:[],compilers:[{typeId:c.pluginId+'.hang',target:'glsl-es-300',compile(){while(true){}}}]});}};`,
        },
      },
      { timeoutMs: 1500 },
    );
    await assert.rejects(
      active.request("compile", {
        typeId: manifest.id + ".hang",
        target: "glsl-es-300",
        context: {},
      }),
      /超时/,
    );
    await active.dispose();
    active = null;
    results.push("compile hang stopped");
    assert.equal(BrowserWindow.getAllWindows().length, 0);
    results.push("no surviving extension windows");
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify({ ok: true, results }, null, 2));
    app.exit(0);
  } catch (e) {
    active?.destroy();
    await fs.writeFile(
      output,
      JSON.stringify({ ok: false, error: e.stack, results }, null, 2),
    );
    app.exit(1);
  }
});

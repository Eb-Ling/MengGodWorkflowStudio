// 开发者故障注入：真实 Electron 沙箱/IPC，不计为桌面或 MCP 用户路径。
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const {
  createExtensionRunner,
} = require("../packages/extension-host/electron-runner.cjs");
const output = process.argv.find((s) => s.startsWith("--result="))?.slice(9),
  results = [];
let active;
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  try {
    const { pluginManifestDraft } =
      await import("../packages/plugin-sdk/plugin-manifest.mjs");
    const manifest = pluginManifestDraft("host-test", "index.mjs", "extension");
    manifest.providesApis = {
      [manifest.id + ".api"]: {
        version: "1.0.0",
        methods: {
          value: { arguments: { type: "array" }, returns: { type: "number" } },
        },
      },
    };
    const source = `export const plugin={async activate(c){
    if(typeof process!=='undefined'||typeof require!=='undefined'||window.workflowDesktop)throw Error('platform leak');
    for(const url of ['https://example.com/','file:///C:/Windows/win.ini']){let failed=false;try{await fetch(url);}catch{failed=true;}if(!failed)throw Error('forbidden network/file');}
    let denied=false;try{await window.pluginRuntime.call({api:'platform.browser',method:'fetch',args:[]});}catch{denied=true;}if(!denied)throw Error('raw bridge bypass');
    await window.pluginRuntime.call({api:'workflow.editor',method:'snapshot',args:[],generation:'victim',requestId:999});
    const s=await c.api('workflow.editor').snapshot();c.provide(c.pluginId+'.api',{value:()=>s.value+1});
  }};`;
    for (let i = 0; i < 3; i++) {
      active = await createExtensionRunner(
        { manifest, files: { "index.mjs": source } },
        {
          timeoutMs: 6000,
          onApiCall: async (request) => {
            assert.equal(request.api, "workflow.editor");
            assert.equal(request.method, "snapshot");
            assert.deepEqual(Object.keys(request).sort(), [
              "api",
              "args",
              "method",
            ]);
            return { value: 41 };
          },
        },
      );
      assert.equal(
        await active.request("invoke", {
          api: manifest.id + ".api",
          method: "value",
          args: [],
        }),
        42,
      );
      await active.dispose();
      active = null;
    }
    results.push(
      "three real sandbox cycles: async public API, provided JSON API, raw bridge/Node/network/file denied, no windows retained",
    );
    assert.equal(BrowserWindow.getAllWindows().length, 0);
    // 新增放置方式仍经真实隔离进程、同一个远程白名单与消费者作用域。
    const { createExtensionUiService } = await import('../plugins/extension-ui/service.mjs');
    const mounted = new Map(), cleanup = [];
    const uiService = createExtensionUiService(p=>{mounted.set(p.id,p);return {dispose(){mounted.delete(p.id);}};},x=>x);
    const ui = uiService.scoped(manifest.id,f=>cleanup.push(f));
    active = await createExtensionRunner({manifest:{...manifest,providesApis:{}},files:{'index.mjs':`export const plugin={async activate(c){
      const ui=c.api('studio.extension-ui');
      for(const placement of ['settings','dialog']) {
        const id=c.pluginId+'.'+placement;
        await ui.create({id,title:placement,placement,tree:{id:'group',type:'disclosure',children:[{id:'notes',type:'textarea',value:'sandbox',rows:4}]}});
        let rejected=false;try{await ui.update({id,tree:{id:'notes',type:'textarea',value:'bad',rows:21}});}catch{rejected=true;}
        if(!rejected)throw Error('invalid textarea crossed boundary');
        await ui.update({id,tree:{id:'group',type:'disclosure',children:[{id:'notes',type:'textarea',value:'updated',rows:6}]}});
      }
    }};`}}, {onApiCall:async request=>{
      assert.equal(request.api,'studio.extension-ui');
      return ui[request.method](...request.args);
    }});
    assert.deepEqual([...mounted.values()].map(p=>p.placement),['settings','dialog']);
    for(const p of mounted.values()) {
      assert.equal(p.model.tree.type,'disclosure');assert.equal(p.model.tree.children[0].value,'updated');assert.equal(p.model.revision,2);
    }
    await active.dispose();active=null;
    for(const stop of cleanup)stop();uiService.dispose();assert.equal(mounted.size,0);
    results.push('nested disclosure/textarea create and update cross real sandbox RPC; invalid rows rejected atomically; settings/dialog scoped cleanup removes all contributions');
    const plain = {
      ...manifest,
      providesApis: {},
      requiredApis: {},
      capabilities: [],
    };
    await assert.rejects(
      createExtensionRunner(
        {
          manifest: plain,
          files: {
            "index.mjs": "export const plugin={activate(){while(true){}}};",
          },
        },
        { timeoutMs: 1000 },
      ),
      /超时/,
    );
    results.push("activation hang terminated");
    let fault;
    const failure = new Promise((r) => (fault = r));
    active = await createExtensionRunner(
      {
        manifest: plain,
        files: {
          "index.mjs":
            "export const plugin={activate(){setTimeout(()=>{while(true){}},100)}};",
        },
      },
      { timeoutMs: 1000, onFault: fault },
    );
    const reason = await Promise.race([
      failure,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(Error("heartbeat did not stop idle hang")),
          6000,
        ),
      ),
    ]);
    assert.match(reason, /超时/);
    active.destroy();
    active = null;
    results.push(
      "idle timer hang detected by heartbeat; unrelated host remains responsive",
    );
    active = await createExtensionRunner(
      {
        manifest: plain,
        files: {
          "index.mjs":
            "export const plugin={activate(c){c.onDispose(()=>{while(true){}})}};",
        },
      },
      { timeoutMs: 1000 },
    );
    await assert.rejects(active.dispose(), /超时/);
    active = null;
    results.push("cleanup hang terminated");
    assert.equal(BrowserWindow.getAllWindows().length, 0);
    let reportFault;
    const thrown = new Promise((resolve) => (reportFault = resolve));
    active = await createExtensionRunner(
      {
        manifest: plain,
        files: {
          "index.mjs":
            "export const plugin={activate(){setTimeout(()=>{throw Error('fixture failure')},50)}};",
        },
      },
      { timeoutMs: 1000, onFault: reportFault },
    );
    assert.match(
      await Promise.race([
        thrown,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(Error("uncaught error was not reported")),
            3000,
          ),
        ),
      ]),
      /fixture failure/,
    );
    active.destroy();
    active = null;
    assert.equal(BrowserWindow.getAllWindows().length, 0);
    results.push("uncaught timer exception reported and renderer removed");
    active = await createExtensionRunner({manifest:plain,files:{"index.mjs":"export const plugin={activate(c){c.onDispose(()=>{throw Error('cleanup fixture failure')})}};"}});
    await assert.rejects(active.dispose(), /cleanup fixture failure/);
    active=null;
    assert.equal(BrowserWindow.getAllWindows().length,0);
    results.push("cleanup callback error is reported and renderer still destroyed");
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify({ ok: true, results }, null, 2));
    app.exit(0);
  } catch (error) {
    active?.destroy();
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(
      output,
      JSON.stringify({ ok: false, error: error.stack, results }, null, 2),
    );
    app.exit(1);
  }
});

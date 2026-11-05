import { reactive } from "vue";
import { createEditorClient } from "./editor-client.mjs";
import { connectionGuide } from "./connection-guide.mjs";
export function createMcpSession({ workflow, preview, plugins, extensionUi, platform }: any) {
  const model = reactive({
    port: new URL(platform.baseUrl).port || "4174",
    status: "正在自动连接工作区。",
    prompt: "",
    configuration: "",
    busy: true,
    mode: "write" as "read" | "write",
  });
  const create = () =>
    createEditorClient({
      workflow,
      preview,
      plugins,
      extensionUi,
      platform,
      port: Number(model.port),
      status: (message: string) => {
        model.status = message;
      },
    });
  let client = create(),
    live = true;
  const ready = Promise.resolve(platform.desktop?.mcpStatus?.())
    .then((saved: any) => {
      if (live && saved) model.mode = saved.mode;
    })
    .catch((error: Error) => {
      if (live) model.status = error.message;
    })
    .finally(() => {
      model.busy = false;
    });
  const dispose = async () => {
    live = false;
    await client.dispose();
  };
  async function run(task: () => Promise<void>) {
    if (!live || model.busy) return;
    model.busy = true;
    try {
      await ready;
      await task();
    } catch (error) {
      if (live) model.status = String(error);
    } finally {
      model.busy = false;
    }
  }
  const actions = {
    setMode(value: string) {
      if (!["read", "write"].includes(value)) throw Error("未知接入权限");
      model.mode = value as "read" | "write";
      model.prompt = "";
      model.configuration = "";
    },
    activate: () =>
      run(async () => {
        await client.activate();
      }),
    selfTest: () =>
      run(async () => {
        await client.activate();
        if (!platform.desktop) throw new Error("MCP 自检仅在桌面 EXE 中可用");
        const result = await platform.desktop.testMcp();
        if (
          result.requiredTools.some(
            (name: string) => !result.tools.includes(name),
          )
        )
          throw new Error("MCP 工具列表不完整");
        if (live)
          model.status = `MCP 本机自检通过，${result.toolCount} 个工具，当前草稿读取成功。`;
      }),
    showConfig: () =>
      run(async () => {
        const guide = await connectionGuide(model.mode, platform.desktop);
        if (live) {
          model.prompt = guide.prompt;
          model.configuration = guide.configuration;
          model.status = "接入配置已就绪，同一权限的现有配置可继续使用。";
        }
      }),
    copyGuide: () =>
      run(async () => {
        const guide = await connectionGuide(model.mode, platform.desktop);
        if (!live) return;
        model.prompt = guide.prompt;
        model.configuration = guide.configuration;
        await platform.desktop.copyText(guide.prompt);
        if (live)
          model.status =
            "已复制，请粘贴给 AI 完成首次配置。以后只需告诉 AI 工作流名称或 ID。";
      }),
    revoke: () =>
      run(async () => {
        await platform.desktop?.revokeMcp();
        if (live) {
          model.prompt = "";
          model.configuration = "";
          model.status = "外部接入已撤销，编辑器仍可正常使用。";
        }
      }),
  };

  return { model, actions, dispose };
}

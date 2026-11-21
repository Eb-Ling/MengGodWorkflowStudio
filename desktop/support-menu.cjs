const os = require("node:os");

const issuesUrl = "https://github.com/Eb-Ling/MengGodWorkflowStudio/issues";

/** 仅使用版本和系统信息生成公开反馈链接，不读取工作流、日志或接入凭据。 */
function feedbackUrl(kind, version, environment) {
  const bug = kind === "bug";
  const url = new URL(issuesUrl + "/new");
  url.searchParams.set("title", bug ? "[问题反馈] " : "[功能建议] ");
  const fields = bug
    ? [
        "### 遇到的问题\n请描述哪里无法正常使用。",
        "### 重现步骤\n1. 打开哪个页面或工作流\n2. 执行什么操作\n3. 出现什么问题",
        "### 预期结果\n你希望看到什么。",
        "### 实际结果\n实际发生了什么。",
        "### 截图或相关报错\n可将截图拖入这里。MCP 问题请附工具名称和报错，不要粘贴接入密钥。",
      ]
    : [
        "### 想完成的事情\n请描述你的使用场景。",
        "### 当前遇到的限制\n现有操作哪里不方便。",
        "### 希望怎样改进\n可以附上示意图或操作示例。",
      ];
  url.searchParams.set("body", [
    "### 使用环境\n软件版本：" + version + "\n系统：" + environment,
    ...fields,
  ].join("\n\n"));
  return url.toString();
}

/** 原生帮助菜单，通过固定地址打开浏览器，反馈由用户在 GitHub 确认提交。 */
function supportMenuItems({ app, shell, dialog, clipboard }) {
  const environment = `${os.type()} ${os.release()} ${process.arch}`;
  async function open(url) {
    try {
      await shell.openExternal(url);
    } catch {
      const { response } = await dialog.showMessageBox({
        type: "error",
        title: "无法打开反馈页面",
        message: "请复制链接，在浏览器中打开。",
        detail: "登录 GitHub 后即可填写反馈，也可以查看已有问题的处理进度。",
        buttons: ["复制反馈链接", "关闭"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (response === 0) clipboard.writeText(url);
    }
  }
  return [
    { label: "问题反馈…", click: () => open(feedbackUrl("bug", app.getVersion(), environment)) },
    { label: "功能建议…", click: () => open(feedbackUrl("feature", app.getVersion(), environment)) },
    { label: "查看已有反馈", click: () => open(issuesUrl) },
  ];
}

module.exports = { feedbackUrl, supportMenuItems };

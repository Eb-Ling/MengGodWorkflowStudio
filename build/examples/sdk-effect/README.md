# 双阶段特效扩展 v1.0

这是一个可直接选择目录加载的独立教学插件。只需要 `studio-plugin.json` 和 `index.mjs`，无需修改 Studio 源码。

1. 在插件中心选择本目录，审阅声明后保存并加载。需要让 AI 登记时，勾选允许并选择“仅授权，稍后登记”。
2. 顶点阶段添加“教学坐标缩放”，把位置输出连接它的 value 输入，再把它的 value 输出连接顶点输出的 position。
3. 片段阶段添加“教学蓝色”，把 color 连接颜色输出。预览得到缩小一半的蓝色正方形。
4. 在插件设置中展开“教学：双阶段特效扩展”，可从接入指南新增颜色节点，这个操作支持撤销。
5. 配置并导出一次公共 Java 依赖，再导出特效的一个 Java 和两个着色器。单点入口使用 Vector2f。

插件通过 workflow.nodes 成对登记节点与两个 GLSL 目标规则，通过 studio.extension-ui 创建面板，通过 workflow.editor.addNode 操作当前阶段。停用后内核回收贡献与定时器，原工作流保留节点和连线。重新启用后可继续预览和导出。

AI 的标准流程是先列出工作流并按用户指定目标选择，再读取摘要。使用 workflow_list_authorized_plugins 找到用户指定的插件，用返回的 id 和 authorizationId 登记。不能从任意路径加载，内容变化后需要用户重新审阅。移除登记保留源码和单独授予的授权，用户可以在插件中心撤销 AI 登记授权。

节点定义和编译规则均为教学用途，最终游戏表现仍需在游戏内验证。

独立开发包可生成两个阶段和两个目标的八个 IR 探针，在三轮启停前后核对共 48 次编译结果。下面命令在开发包根目录执行，最后一个路径替换为本机 Electron。

```sh
node examples/sdk-effect/probes.mjs > probes.json
node packages/plugin-testkit/cli.mjs smoke examples/sdk-effect --fixtures probes.json --electron "path/to/electron.exe"
```

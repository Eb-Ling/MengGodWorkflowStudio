# 1.1.0 验证记录

日期：2026-11-01。环境：Windows、Node 24.22.1、JDK 17.0.20.1、Starsector 0.98a API、BoxUtil 1.6.3、LWJGL 2，离屏驱动报告 OpenGL 4.3.0 NVIDIA 582.05。

## 已完成的分轮检查

| 轮次 | 覆盖 | 结果 |
|---|---|---|
| 编译契约 | 7 项 Node 测试：旧变换迁移、零缩放、任意四边形、顶点循环和缺失连接、类型边界、参数布局、路径拒绝、ZIP 结构 | 全部通过 |
| 浏览器与旧导出 | 10 组旧导出：纯色、共享参数、单纹理、Tint、关键字纹理名、双纹理、自定义 out/inout、If、For；非法输入拒绝 | 全部通过 |
| 新编辑流程 | 每实例作用域、顶点连线、时间节点、9 实例预览、选中实例参数覆盖、保存后往返页面、重载工作流、ZIP 下载、内置波动示例 | 全部通过，无页面异常 |
| 原生 GPU | 实际 JAR 编译所有生成 Java、共享运行时和 Java graph 兼容层；14 组 shader 使用 Pbuffer 上下文编译并链接 | 全部通过 |
| GPU 行为 | 独立实例红／绿像素、实例间空隙、异常恢复 program/VAO/VBO、SSBO 的绑定与 offset/size、纹理单元、混合及深度 | 全部通过 |
| 运行时生命周期 | 实际 WorkflowBatch 延迟创建、20 实例上传、静止数据复用、移除、暂停、战斗结束、双重 cleanup、保留外部 UBO | 全部通过 |
| 桌面产物 | 打包源码与源目录一致、Electron 内置 Node 启动 stdio MCP、28 个工具、顶点 graph schema | 通过 |

生命周期测试使用真实 GL 和实际运行时类；战斗状态与 ViewportAPI 使用 Java 动态代理，战斗清理登记由测试钩子记录。没有将这些测试表述为完整游戏战斗测试。

本轮修复了页面切换后已完成 MCP 命令重放的问题；测试现在覆盖顶点页面往返后的草稿一致性。资源初始化不再放在 init，状态恢复不再把 program/VAO 简单归零，原型运行时不再依赖另一个 Mod 的私有类。

## 可复现命令

在仓库根目录执行：

```powershell
npm install
npm test
npm run test:browser
& ./build/verify-native.ps1 -GameRoot E:\StarSector -JdkHome <JDK17目录>
```

浏览器测试默认用 Edge；可通过 BROWSER_CHANNEL 选择已安装渠道，通过 TEST_PORT 改用空闲端口。PLAYWRIGHT_MODULE 可指向已有 Playwright 安装，测试无需更改用户浏览器或已保存草稿。

产物在 build/verification/（被 Git 忽略）：Java、shader、导出 ZIP、截图和 classes。离屏上下文需要可用的 OpenGL 4.3 驱动，不能把浏览器 WebGL2 当作 SSBO 的验证后端。

桌面正常构建仍用 build-desktop.ps1。本环境没有全局 npm，因此使用已安装 Electron 与 @electron/asar 离线打包：

```powershell
node build/package-offline.mjs
```

产物目录为 release/MengGod-Workflow-Studio-1.1.0-win-x64；需整体分发和保留资源目录，不能只复制 EXE。本轮生成了对应 ZIP，未发布 GitHub Release。

## 游戏内人工验收（尚未执行）

按照[标准化渲染教程的验证方案](https://1847905557.github.io/StarsectorNihilismGuidance/chapter20/section3/#验证方案)继续观察：

1. 导入内置“实例波动四边形”，导出并编译到测试 Mod；在一场战斗只登记一个批次。
2. 创建若干实例，改变位置、角度、缩放、颜色和波幅；移动、缩放视口，观察世界坐标与透明度。
3. 暂停／恢复战斗；实例跟随舰船时由调用方更新位置，并在死亡／离场时 remove。通用渲染器本身不绑定特定舰船。
4. 结束并重新进入战斗，核对清理；连续调用同一批次 cleanup 两次。
5. 对照舰船 Sprite、HUD、其他 Mod 效果是否有纹理、混合或位置污染。

任意顶点变形目前禁用 CPU 半径裁剪；大量不可见实例、不同材质批次之间的透明顺序和实际帧耗时需在游戏场景观察。未承诺 GPU 粒子模拟或自动跨材质合批。

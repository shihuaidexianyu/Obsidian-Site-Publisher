# `apps/obsidian-plugin`

这个包只负责 Obsidian 侧的事情：

- 注册命令
- 展示设置页
- 展示问题与日志摘要
- 调用外部 `publisher-cli`

它不负责：

- 解析 vault
- 诊断规则
- staging
- Quartz 构建细节
- deploy 逻辑本身

## 当前行为

插件当前会：

- 使用官方 `obsidian` API 注册真实插件入口
- 通过 `loadData()` / `saveData()` 持久化设置
- 注册 4 个命令：
  - `站点发布：检查问题`
  - `站点发布：构建`
  - `站点发布：启动预览`
  - `站点发布：发布`
- 创建状态栏项，显示最近一次任务状态和运行中进度
- 提供中文设置页
- 提供问题视图和日志摘要视图
- 通过外部 CLI 子进程执行任务，而不是在 Obsidian 渲染进程里直接跑构建链路

## 安装产物

在仓库根目录执行：

```bash
corepack pnpm build:obsidian-plugin
```

可安装插件会生成到：

```text
.obsidian-plugin-build/obsidian-site-publisher/
```

需要复制到 Obsidian 的文件只有：

- `main.js`
- `manifest.json`
- `versions.json`

目标目录：

```text
<你的Vault>/.obsidian/plugins/obsidian-site-publisher/
```

## 依赖的外部 CLI

这个插件不会把 CLI 打包进插件目录。

你需要单独准备 `publisher-cli`：

```bash
corepack pnpm build
```

常见入口路径：

```text
<repo>/apps/publisher-cli/dist/main.js
```

然后在插件设置中填写：

- `CLI 可执行文件路径`

在 Windows 上，一个常见例子是：

```text
C:\Users\<用户名>\path\to\Obsidian Site Publisher\apps\publisher-cli\dist\main.js
```

如果系统 `PATH` 里已经有 `publisher-cli`，也可以不填。

## 设置项

插件设置页当前支持：

- 发布模式
- 发布根目录
- 只包含这些路径
- 排除这些路径
- 输出目录
- CLI 可执行文件路径
- CLI 日志目录
- 预览端口
- 部署目标
- 部署仓库地址
- 部署分支
- 部署提交信息
- Quartz 功能开关

## 日志

插件里只显示轻量日志摘要。

完整日志在：

```text
<vault>/.osp/logs/
```

如果 `CLI 日志目录` 留空，也会默认写到这里。

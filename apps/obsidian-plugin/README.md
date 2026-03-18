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

推荐通过发行包安装，而不是手工拼装插件目录。

在仓库根目录执行：

```bash
corepack pnpm build:release
```

会生成：

- 插件包：`.release/v<version>/artifacts/obsidian-site-publisher-plugin-<version>.zip`
- 跨平台 CLI 包：`.release/v<version>/artifacts/publisher-cli-portable-<version>.zip`

插件安装目录仍然是：

```text
<你的Vault>/.obsidian/plugins/obsidian-site-publisher/
```

插件包中需要复制的文件仍然只有：

- `main.js`
- `manifest.json`
- `versions.json`

## 依赖的外部 CLI

这个插件不会把 CLI 打包进插件目录。

CLI 建议单独安装，然后在插件设置中填写：

- `CLI 可执行文件路径`

不同平台推荐选择的入口：

- Windows：`publisher-cli.cmd`
- macOS：`publisher-cli`
- Linux：`publisher-cli`

CLI 包当前依赖本机 Node.js 20+。

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

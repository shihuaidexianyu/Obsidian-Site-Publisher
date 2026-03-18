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

- 当前平台的一体化插件包：`.release/v<version>/artifacts/obsidian-site-publisher-<platform>-<arch>-<version>.zip`

插件安装目录仍然是：

```text
<你的Vault>/.obsidian/plugins/obsidian-site-publisher/
```

插件包解压后，整个 `obsidian-site-publisher/` 目录都应复制进去。目录中通常包含：

- `main.js`
- `manifest.json`
- `versions.json`
- `bin/publisher-cli(.exe)`
- `bin/runtime/app/`

## 依赖的外部 CLI

通过 `build:release` 生成的一体化插件包，已经把平台对应的原生 CLI 一起放进插件目录。

默认情况下，插件会按以下顺序查找 CLI：

1. 设置页中手动填写的 `CLI 可执行文件路径`
2. 插件目录下的 `bin/publisher-cli(.exe)`
3. 系统 `PATH` 中的 `publisher-cli`

因此，对最终用户来说，通常不需要额外安装 CLI，也不需要本机预装 Node.js。

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

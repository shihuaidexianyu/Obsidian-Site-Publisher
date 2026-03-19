# Obsidian Site Publisher

[English](README.md) | [简体中文](README.zh-CN.md)

用于将 Obsidian vault 中选定的一部分内容发布为静态网站。

Obsidian Site Publisher 由三层组成：

- Obsidian 插件：负责设置、命令和状态展示
- 独立 `publisher-cli`：负责 `scan / build / preview / deploy`
- 基于 Quartz 的构建链路：由 `@osp/core` 统一编排

## 功能特性

- 扫描真实 Obsidian vault 并生成标准化 manifest
- 在构建前诊断常见发布问题
- 通过 `frontmatter`、`folder`、`publishRoot`、`includeGlobs`、`excludeGlobs` 选择公开内容
- 只为 Quartz 准备需要的笔记和资源
- 用 Quartz 进行构建和预览
- 发布到本地目录、Git 分支或 GitHub Pages
- 在 Obsidian 内触发完整流程，同时避免在渲染进程里直接跑构建

## 当前状态

当前仓库已经可以作为第一版公开试用。

v1 支持：

- Markdown 笔记
- frontmatter / Properties
- Obsidian 官方 wikilink、markdown link、embed、heading、block reference
- 官方附件目录规则
- 官方 `.canvas` / `.base` 的识别与报告

v1 明确不支持：

- Dataview
- Templater
- Excalidraw
- 社区插件语法兼容
- 网页端反向编辑 vault

## 架构

项目保持严格的编排边界：

1. `@osp/parser` 负责扫描 vault 并生成 manifest
2. `@osp/diagnostics` 负责产出结构化问题
3. `@osp/staging` 负责准备 Quartz 工作区
4. `@osp/builder-adapter-quartz` 负责构建和预览
5. `@osp/deploy-adapters` 负责发布构建结果
6. `@osp/core` 是唯一允许串起整条链路的包
7. `apps/publisher-cli` 将这条链路暴露为独立程序
8. `apps/obsidian-plugin` 保持为外部 CLI 的轻量 UI 壳层

更多说明：

- [架构索引](docs/architecture/README.md)
- [系统总览](docs/architecture/system-overview.md)
- [模块边界](docs/architecture/module-boundaries.md)
- [ADR](docs/adr)

## 依赖要求

### 面向最终用户

使用发行包时，需要：

- Obsidian 桌面版
- 本地文件系统中的 vault
- Git，仅在使用 Git 类部署目标时需要

使用一体化发行包时，不需要额外安装 Node.js。

### 面向开发者

从源码构建时，需要：

- Node.js 20+
- `corepack`
- `pnpm`
- Git

## 安装方式

支持两种安装方式。

### 方式 A：通过发行包安装

适合普通用户。

发行包会包含：

- Obsidian 插件文件
- 打包好的原生 CLI
- CLI 运行所需的 runtime 文件

解压后目录通常类似：

```text
obsidian-site-publisher/
  main.js
  manifest.json
  versions.json
  bin/
    publisher-cli(.exe)
    runtime/
```

安装步骤：

1. 从 Releases 下载当前平台对应的压缩包
2. 解压压缩包
3. 将整个 `obsidian-site-publisher/` 目录复制到：

```text
<Vault>/.obsidian/plugins/
```

4. 打开 Obsidian 并启用插件

默认情况下，插件会优先使用 `bin/` 目录中的内置 CLI，因此通常不需要再手动配置 CLI 路径。

### 方式 B：从源码安装

适合开发和调试。

1. 安装依赖：

```bash
corepack pnpm install
```

2. 构建工作区：

```bash
corepack pnpm build
```

3. 构建 Obsidian 插件：

```bash
corepack pnpm build:obsidian-plugin
```

4. 将以下目录中的文件：

```text
.obsidian-plugin-build/obsidian-site-publisher/
```

复制到：

```text
<Vault>/.obsidian/plugins/obsidian-site-publisher/
```

5. 在插件设置中将 `CLI 可执行文件路径` 指向：

```text
<repo>/apps/publisher-cli/dist/main.js
```

## 使用方式

### 在 Obsidian 插件中使用

插件提供以下命令：

- `站点发布：检查问题`
- `站点发布：构建`
- `站点发布：启动预览`
- `站点发布：发布`

推荐流程：

1. 选择发布模式
2. 使用 `publishRoot`、`includeGlobs`、`excludeGlobs` 缩小公开范围
3. 先运行“检查问题”
4. 再运行“构建”或“启动预览”
5. 最后运行“发布”

### 在 CLI 中使用

常用命令：

```bash
publisher-cli scan --vault-root /path/to/vault
publisher-cli build --vault-root /path/to/vault
publisher-cli preview --vault-root /path/to/vault
publisher-cli deploy --vault-root /path/to/vault
```

也可以显式传入配置文件：

```bash
publisher-cli build --config ./publisher.config.json
```

常用参数：

- `--json`
- `--log-dir`
- `--preview-port`
- `--quartz-package-root`

## 配置说明

主要配置项：

- `publishMode`
- `publishRoot`
- `includeGlobs`
- `excludeGlobs`
- `outputDir`
- `deployTarget`
- `deployOutputDir`
- `deployRepositoryUrl`
- `deployBranch`
- `deployCommitMessage`
- `strictMode`

示例：

```json
{
  "vaultRoot": "./my-vault",
  "publishMode": "folder",
  "publishRoot": "Public",
  "includeGlobs": ["Notes/**"],
  "excludeGlobs": ["Diary/**", "**/.obsidian/**", "**/.osp/**"],
  "outputDir": "./my-vault/.osp/dist",
  "builder": "quartz",
  "deployTarget": "github-pages",
  "deployRepositoryUrl": "https://github.com/example/example.github.io",
  "deployBranch": "main",
  "deployCommitMessage": "Deploy static site",
  "enableSearch": true,
  "enableBacklinks": true,
  "enableGraph": true,
  "strictMode": false
}
```

## 日志与输出

默认目录如下：

- 工作区与预览文件：`<vault>/.osp/`
- CLI 日志：`<vault>/.osp/logs/`
- 构建产物：`<vault>/.osp/build/dist/`

插件侧边栏只显示轻量摘要，完整日志请查看 CLI 生成的日志文件。

## 发布方式

### 在本地构建发行包

在当前机器上构建当前平台对应的发行包：

```bash
corepack pnpm build:release
```

生成文件位于：

```text
.release/v<version>/artifacts/
```

### 通过云端创建 GitHub Release

仓库已经包含 GitHub Actions 工作流：[`.github/workflows/build-release.yml`](.github/workflows/build-release.yml)。

可以通过两种方式触发：

1. 推送版本标签：

```bash
git tag v0.1.0
git push origin v0.1.0
```

2. 在 GitHub Actions 中手动运行 workflow，并填写 `release_tag`，例如 `v0.1.0`。

当使用 `v*` 标签或手动填写 `release_tag` 触发时，workflow 会：

- 在 Windows、macOS、Linux 上构建发行包
- 自动创建 GitHub Release
- 将生成的 `.zip` 文件上传到 Release assets

## 开发命令

常用命令：

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm check
corepack pnpm build:obsidian-plugin
corepack pnpm build:release
```

测试输入：

- 可复现 fixture：[`fixtures/`](fixtures/)
- 真实 smoke vault：`test_vault/hw`

## 仓库结构

```text
apps/
  obsidian-plugin/
  publisher-cli/
packages/
  builder-adapter-quartz/
  core/
  deploy-adapters/
  diagnostics/
  parser/
  shared/
  staging/
docs/
  adr/
  architecture/
  prompts/
fixtures/
test_vault/
```

## 文档入口

- [English README](README.md)
- [插件说明](apps/obsidian-plugin/README.md)
- [架构索引](docs/architecture/README.md)
- [工程规则](docs/prompts/engineering-rules.md)
- [任务模板](docs/prompts/task-template.md)
- [路线图](todo.md)

## 已知限制

- v1 只识别并报告 `.canvas` / `.base`，不渲染它们
- 某些在公式中混入 Markdown 风格语法的内容，仍可能触发 Quartz/KaTeX warning
- 社区插件语法明确不在支持范围内

## 许可证

仓库当前还没有单独提供许可证文件。

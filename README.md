# Obsidian Site Publisher

Obsidian Site Publisher 用于将 Obsidian vault 中的一部分官方语法笔记发布为静态网站。

当前架构如下：

- `publisher-cli` 是独立程序，负责 `scan / build / preview / deploy`
- Obsidian 插件负责设置、命令、进度提示、问题展示和调用外部 CLI
- Quartz 是默认静态站点构建器

## 功能概览

当前版本支持：

- 扫描真实 vault，识别笔记、资源、`.canvas`、`.base`
- 诊断常见问题，例如 broken links、missing assets、duplicate slug
- 根据 `frontmatter / folder / publishRoot / includeGlobs / excludeGlobs` 选择发布范围
- 生成 staging workspace 并构建 Quartz 站点
- 在 Obsidian 中执行“检查问题 / 构建 / 预览 / 发布”
- 发布到本地目录、Git 分支或 GitHub Pages 仓库

## 支持范围

第一版仅面向 Obsidian 官方能力。

支持：

- Markdown 笔记
- Frontmatter / Properties
- 官方 wikilink / markdown link / embeds
- 官方附件目录规则
- 官方 `.canvas` / `.base` 的识别和报告

暂不支持：

- Dataview
- Templater
- Excalidraw
- 其他社区插件语法
- 网页端反向编辑 Obsidian 笔记

## 安装

当前推荐的安装方式是：先构建 CLI，再构建插件，最后在 Obsidian 中将插件指向 CLI。

### 环境要求

- Obsidian
- Node.js 20+
- `corepack`
- Git

### 1. 安装依赖

在仓库根目录执行：

```bash
corepack pnpm install
```

### 2. 构建 CLI

```bash
corepack pnpm build
```

构建完成后，CLI 入口位于：

- `apps/publisher-cli/dist/main.js`

包中声明的命令名为 `publisher-cli`。

### 3. 构建 Obsidian 插件

```bash
corepack pnpm build:obsidian-plugin
```

插件产物将生成到：

- `.obsidian-plugin-build/obsidian-site-publisher/`

其中包含：

- `main.js`
- `manifest.json`
- `versions.json`

### 4. 安装到 Obsidian

将上述 3 个文件复制到以下目录：

```text
<你的Vault>/.obsidian/plugins/obsidian-site-publisher/
```

然后在 Obsidian 中：

1. 打开 `设置 -> 社区插件`
2. 启用社区插件
3. 启用 `站点发布`

### 5. 配置外部 CLI

启用插件后，在插件设置页中填写：

- `CLI 可执行文件路径`

Windows 常见示例：

```text
C:\Users\<你的用户名>\path\to\Obsidian Site Publisher\apps\publisher-cli\dist\main.js
```

如果系统 `PATH` 中已经可直接找到 `publisher-cli`，该项可以留空。

## 使用方式

插件启用并配置完成后，可以在 Obsidian 命令面板中使用：

- `站点发布：检查问题`
- `站点发布：构建`
- `站点发布：启动预览`
- `站点发布：发布`

插件设置页支持以下配置：

- 发布模式
- 发布根目录
- 只包含这些路径
- 排除这些路径
- 输出目录
- 预览端口
- 部署目标
- 部署仓库地址
- 部署分支
- 提交信息

常见用法：

- 使用 `Folder` 模式发布某个目录
- 使用“只包含这些路径”精确纳入需要展示的文件夹
- 使用“排除这些路径”隐藏日记、草稿或私有目录

## 输出与日志

默认情况下：

- 构建/预览工作目录位于 `<vault>/.osp/`
- CLI 日志位于 `<vault>/.osp/logs/`
- 构建产物通常位于 `<vault>/.osp/build/dist/`

插件侧边栏仅显示轻量摘要，完整构建日志请查看 `.osp/logs`。

## 常见问题

### 插件里只看到“检查问题”，看不到构建或发布

通常表示 Obsidian 仍在加载旧版插件文件。请重新覆盖：

- `main.js`
- `manifest.json`
- `versions.json`

然后完全重启 Obsidian。

### 构建时报 `EMPTY_PUBLISH_SLICE`

表示当前配置没有选中任何笔记。建议检查：

- 发布模式是否正确
- `publishRoot` 是否过窄
- `includeGlobs / excludeGlobs` 是否排除了全部内容
- `frontmatter` 模式下是否至少有一篇笔记包含 `publish: true`

### Obsidian 中正常显示，但网页中的数学公式报错

项目会在 staging 阶段做一小部分数学兼容归一化，例如：

- `($$ ... $$)` -> `$...$`
- `\(...\)` -> `$...$`
- `\[...\]` -> `$$ ... $$`

如果公式中直接混用中文、标题或粗体等 Markdown 语法，Quartz/KaTeX 仍可能给出告警。

## 部署配置示例

本地导出：

```json
{
  "deployTarget": "local-export",
  "deployOutputDir": "./published-site"
}
```

Git 分支部署：

```json
{
  "deployTarget": "git-branch",
  "deployBranch": "gh-pages",
  "deployCommitMessage": "Deploy static site"
}
```

GitHub Pages：

```json
{
  "deployTarget": "github-pages",
  "deployRepositoryUrl": "https://github.com/<user>/<user>.github.io",
  "deployBranch": "main",
  "deployCommitMessage": "Deploy static site"
}
```

## 仓库结构

- `apps/obsidian-plugin`：Obsidian 插件
- `apps/publisher-cli`：独立 CLI
- `packages/*`：核心能力、适配器和共享类型
- `fixtures/*`：回归测试样例
- `docs/adr`：架构决策记录
- `docs/prompts`：工程规则和协作约束

## 开发说明

相关文档：

- [工程规则](docs/prompts/engineering-rules.md)
- [任务模板](docs/prompts/task-template.md)
- [插件说明](apps/obsidian-plugin/README.md)
- [路线图](todo.md)

真实 smoke-test vault：

- `test_vault/hw`

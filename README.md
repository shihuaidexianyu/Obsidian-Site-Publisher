# Obsidian Site Publisher

把 Obsidian vault 中的一部分官方语法笔记发布为静态网站。

这个项目现在的设计是：

- `publisher-cli` 是独立程序，负责 `scan / build / preview / deploy`
- Obsidian 插件只负责设置、命令、进度、问题展示和调用外部 CLI
- Quartz 作为默认静态站点构建器

## 当前能力

目前已经支持：

- 扫描真实 vault，识别笔记、资源、`.canvas`、`.base`
- 诊断常见问题，例如 broken links、missing assets、duplicate slug
- 根据 `frontmatter / folder / publishRoot / includeGlobs / excludeGlobs` 选择发布范围
- 生成 staging workspace，并构建 Quartz 站点
- 在 Obsidian 里执行 `检查问题 / 构建 / 预览 / 发布`
- 发布到：
  - 本地导出目录
  - Git 分支
  - GitHub Pages 仓库

## 支持范围

第一版只面向 Obsidian 官方能力。

支持：

- Markdown 笔记
- Frontmatter / Properties
- 官方 wikilink / markdown link / embeds
- 官方附件目录规则
- 官方 `.canvas` / `.base` 的识别和报告

不支持：

- Dataview
- Templater
- Excalidraw
- 其他社区插件语法
- 在网页端反向编辑 Obsidian 笔记

## 从零安装

如果你要把这个插件给另一个人从头安装，当前最稳的方式是：先构建 CLI，再构建插件，再在 Obsidian 里把插件指向 CLI。

### 1. 准备环境

建议准备：

- Obsidian
- Node.js 20+
- `corepack`
- Git

### 2. 获取项目并安装依赖

在仓库根目录执行：

```bash
corepack pnpm install
```

### 3. 构建 CLI

```bash
corepack pnpm build
```

构建完成后，CLI 入口在：

- `apps/publisher-cli/dist/main.js`

如果你想直接在终端里调用，也可以自己把它包装成系统命令，包里声明的命令名是 `publisher-cli`。

### 4. 构建 Obsidian 插件

```bash
corepack pnpm build:obsidian-plugin
```

插件产物会生成到：

- `.obsidian-plugin-build/obsidian-site-publisher/`

里面会有：

- `main.js`
- `manifest.json`
- `versions.json`

### 5. 安装到 Obsidian

把上面 3 个文件复制到你的 vault 目录：

```text
<你的Vault>/.obsidian/plugins/obsidian-site-publisher/
```

然后：

1. 打开 Obsidian
2. 进入 `设置 -> 社区插件`
3. 如果还没开启社区插件，先开启
4. 启用 `站点发布`

### 6. 在插件设置里绑定 CLI

启用插件后，进入插件设置页，找到：

- `CLI 可执行文件路径`

推荐直接填你本机构建出来的 CLI 路径，例如 Windows：

```text
C:\Users\<你的用户名>\path\to\Obsidian Site Publisher\apps\publisher-cli\dist\main.js
```

如果你已经把 `publisher-cli` 放进系统 `PATH`，也可以留空，让插件自己查找。

### 7. 配置发布范围

插件设置页里可以直接配置：

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

常见做法是：

- 用 `Folder` 模式发布某个目录
- 用 `只包含这些路径` 精确纳入要展示的文件夹
- 用 `排除这些路径` 隐藏 `日记/草稿/私有目录`

### 8. 开始使用

插件启用并配置好 CLI 后，可以在命令面板里使用：

- `站点发布：检查问题`
- `站点发布：构建`
- `站点发布：启动预览`
- `站点发布：发布`

## 日志和输出

默认情况下：

- 构建/预览工作目录在 `<vault>/.osp/`
- CLI 日志在 `<vault>/.osp/logs/`
- 构建产物通常在 `<vault>/.osp/build/dist/`

插件侧边栏只保留轻量摘要，完整构建日志请看 `.osp/logs`。

## 常见问题

### 1. 插件里只看到“检查问题”，看不到构建/发布

通常是 Obsidian 还在加载旧版插件文件。请重新覆盖：

- `main.js`
- `manifest.json`
- `versions.json`

然后完全重启 Obsidian。

### 2. 构建时报 `EMPTY_PUBLISH_SLICE`

说明当前配置没有选中任何笔记。请检查：

- 发布模式是不是选对了
- `publishRoot` 是否过窄
- `includeGlobs / excludeGlobs` 是否把内容都排掉了
- `frontmatter` 模式下是否至少有一篇笔记带 `publish: true`

### 3. Obsidian 正常、网页里数学公式报错

项目现在会在 staging 时做一小部分数学兼容归一化，例如：

- `($$ ... $$)` -> `$...$`
- `\(...\)` -> `$...$`
- `\[...\]` -> `$$ ... $$`

但如果公式里直接混中文、标题、粗体等 Markdown 语法，Quartz/KaTeX 仍可能告警。

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

主要工程规则在：

- [docs/prompts/engineering-rules.md](/c:/Users/exqin/Desktop/Obsidian%20Site%20Publisher/docs/prompts/engineering-rules.md)
- [docs/prompts/task-template.md](/c:/Users/exqin/Desktop/Obsidian%20Site%20Publisher/docs/prompts/task-template.md)

真实 smoke-test vault：

- `test_vault/hw`

路线图：

- [todo.md](/c:/Users/exqin/Desktop/Obsidian%20Site%20Publisher/todo.md)

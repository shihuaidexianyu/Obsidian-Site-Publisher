import type { PublisherConfig } from "@osp/shared";

import type { PluginCommand, PluginCommandDefinition, PluginCommandResult } from "./plugin-shell.js";

export type PluginHost = {
  registerCommand(definition: PluginCommandDefinition, callback: () => Promise<void>): void;
  setStatus(message: string): void;
  showNotice(message: string): void;
  revealIssueListView(): Promise<void>;
  revealBuildLogView(): Promise<void>;
  refreshViews(): void;
};

type PluginCommandRunner = {
  getCommandDefinitions(): PluginCommandDefinition[];
  runCommand(command: PluginCommand, config: PublisherConfig): Promise<PluginCommandResult>;
};

export class PluginCommandController {
  public constructor(
    private readonly shell: PluginCommandRunner,
    private readonly host: PluginHost,
    private readonly getConfig: () => PublisherConfig
  ) {}

  public registerCommands(): void {
    for (const definition of this.shell.getCommandDefinitions()) {
      this.host.registerCommand(definition, async () => {
        await this.runCommand(definition.command);
      });
    }
  }

  public async runCommand(command: PluginCommand): Promise<void> {
    try {
      const result = await this.shell.runCommand(command, this.getConfig());

      this.host.setStatus(createStatusBarMessage(result));
      this.host.showNotice(result.statusMessage);
      await this.syncViews(result);
    } catch (error) {
      const message = formatPluginCommandError(command, error);

      this.host.setStatus(createErrorStatusBarMessage(command));
      this.host.showNotice(message);
      this.host.refreshViews();
    }
  }

  private async syncViews(result: PluginCommandResult): Promise<void> {
    if (result.command === "issues") {
      await this.host.revealIssueListView();
    }

    if (result.command === "build" || result.command === "publish") {
      await this.host.revealIssueListView();
    }

    this.host.refreshViews();
  }
}

function formatPluginCommandError(command: PluginCommand, error: unknown): string {
  const commandLabel = command === "preview"
    ? "预览"
    : command === "build"
      ? "构建"
      : command === "publish"
        ? "发布"
        : "检查问题";

  if (error instanceof Error) {
    return `${commandLabel}失败：${error.message}`;
  }

  return `${commandLabel}失败：发生了未知错误。`;
}

function createStatusBarMessage(result: PluginCommandResult): string {
  switch (result.command) {
    case "preview":
      return "站点发布：预览已启动";
    case "build":
      return result.result.success ? "站点发布：构建完成" : "站点发布：构建失败";
    case "publish":
      if (!result.build.success) {
        return "站点发布：发布已停止";
      }

      return result.deploy?.success === false ? "站点发布：发布失败" : "站点发布：发布完成";
    case "issues":
      return "站点发布：检查完成";
  }
}

function createErrorStatusBarMessage(command: PluginCommand): string {
  const commandLabel = command === "preview"
    ? "预览"
    : command === "build"
      ? "构建"
      : command === "publish"
        ? "发布"
        : "检查";

  return `站点发布：${commandLabel}失败`;
}

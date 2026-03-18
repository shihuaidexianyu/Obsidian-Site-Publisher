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

      this.host.setStatus(result.statusMessage);
      this.host.showNotice(result.statusMessage);
      await this.syncViews(result);
    } catch (error) {
      const message = formatPluginCommandError(command, error);

      this.host.setStatus(message);
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
      await this.host.revealBuildLogView();
    }

    this.host.refreshViews();
  }
}

function formatPluginCommandError(command: PluginCommand, error: unknown): string {
  if (error instanceof Error) {
    return `${command} failed: ${error.message}`;
  }

  return `${command} failed with an unknown error.`;
}

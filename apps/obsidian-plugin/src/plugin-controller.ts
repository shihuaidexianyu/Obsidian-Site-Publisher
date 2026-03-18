import type { PublisherConfig } from "@osp/shared";

import type { PluginCommand, PluginCommandDefinition, PluginCommandResult } from "./plugin-shell.js";

export type PluginHost = {
  registerCommand(definition: PluginCommandDefinition, callback: () => Promise<void>): void;
  setStatus(message: string): void;
  showNotice(message: string): void;
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
    const result = await this.shell.runCommand(command, this.getConfig());

    this.host.setStatus(result.statusMessage);
    this.host.showNotice(result.statusMessage);
  }
}

import path from "node:path";

import { FileSystemAdapter, Notice, Plugin, type WorkspaceLeaf } from "obsidian";

import { createExternalCliBackendFactory } from "./external-cli.js";
import { PluginCommandController } from "./plugin-controller.js";
import { PublisherPluginSettingTab } from "./plugin-settings-tab.js";
import {
  BuildLogView,
  BUILD_LOG_VIEW_TYPE,
  CONTROL_PANEL_VIEW_ICON,
  CONTROL_PANEL_VIEW_TYPE,
  IssueListView,
  ISSUE_LIST_VIEW_TYPE,
  PublisherControlView
} from "./plugin-views.js";
import { pluginManifest, PublisherPluginShell } from "./plugin-shell.js";
import { loadPluginSettings, savePluginSettings, type PublisherPluginSettings } from "./settings.js";

export { pluginManifest } from "./plugin-shell.js";
export * from "./external-cli.js";
export * from "./plugin-controller.js";
export * from "./plugin-settings-tab.js";
export * from "./plugin-shell.js";
export * from "./plugin-view-model.js";
export * from "./plugin-views.js";
export * from "./settings.js";

export default class ObsidianSitePublisherPlugin extends Plugin {
  private shell = new PublisherPluginShell();
  private settings: PublisherPluginSettings = {
    config: this.shell.createInitialConfig(""),
    cli: {},
    ui: {
      showInformationalIssues: false
    }
  };
  private controller?: PluginCommandController;

  public override async onload(): Promise<void> {
    const vaultRoot = resolveVaultRoot(this);
    const pluginRoot = resolvePluginRoot(this, vaultRoot);

    this.shell = new PublisherPluginShell(createExternalCliBackendFactory(vaultRoot, pluginRoot, () => this.settings.cli));
    const loadedSettings = await loadPluginSettings(this, this.shell, vaultRoot);

    this.settings = loadedSettings;
    this.registerWorkspaceViews();
    this.controller = new PluginCommandController(
      this.shell,
      {
        registerCommand: (definition, callback) => {
          this.addCommand({
            id: definition.id,
            name: definition.name,
            callback: async () => callback()
          });
        },
        setStatus: () => {},
        beginProgress: () => () => {},
        showNotice: (message) => {
          new Notice(message);
        },
        revealIssueListView: async () => this.revealPluginView(ISSUE_LIST_VIEW_TYPE),
        revealBuildLogView: async () => this.revealPluginView(BUILD_LOG_VIEW_TYPE),
        refreshViews: () => this.refreshPluginViews()
      },
      () => this.settings.config
    );

    this.controller.registerCommands();
    this.addRibbonIcon(CONTROL_PANEL_VIEW_ICON, "打开站点发布面板", () => {
      void this.revealPluginView(CONTROL_PANEL_VIEW_TYPE);
    });
    this.addSettingTab(new PublisherPluginSettingTab(this.app, this));
  }

  public override onunload(): void {
    void this.shell.dispose();
    this.app.workspace.detachLeavesOfType(CONTROL_PANEL_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(ISSUE_LIST_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(BUILD_LOG_VIEW_TYPE);
  }

  public async updateSettings(nextSettings: PublisherPluginSettings): Promise<void> {
    this.settings = nextSettings;
    await savePluginSettings(this, this.settings);
    this.refreshPluginViews();
  }

  public getSettings(): PublisherPluginSettings {
    return this.settings;
  }

  public getConfig(): PublisherPluginSettings["config"] {
    return this.settings.config;
  }

  public async updateSettingsWith(updater: (currentSettings: PublisherPluginSettings) => PublisherPluginSettings): Promise<void> {
    await this.updateSettings(updater(this.settings));
  }

  private registerWorkspaceViews(): void {
    this.registerView(
      CONTROL_PANEL_VIEW_TYPE,
      (leaf) =>
        new PublisherControlView(
          leaf,
          () => this.shell.getState(),
          () => this.settings.ui,
          () => this.controller?.getActiveCommand(),
          async (command) => {
            if (this.controller === undefined) {
              throw new Error("插件控制器尚未准备就绪。");
            }

            await this.controller.runCommand(command);
          }
        )
    );
    this.registerView(ISSUE_LIST_VIEW_TYPE, (leaf) => new IssueListView(leaf, () => this.shell.getState(), () => this.settings.ui));
    this.registerView(BUILD_LOG_VIEW_TYPE, (leaf) => new BuildLogView(leaf, () => this.shell.getState()));
  }

  private async revealPluginView(viewType: string): Promise<void> {
    const leaf = this.getOrCreateViewLeaf(viewType);

    await leaf.setViewState({
      type: viewType,
      active: true
    });
    await this.app.workspace.revealLeaf(leaf);
  }

  private refreshPluginViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(CONTROL_PANEL_VIEW_TYPE)) {
      if (leaf.view instanceof PublisherControlView) {
        leaf.view.refresh();
      }
    }

    for (const leaf of this.app.workspace.getLeavesOfType(ISSUE_LIST_VIEW_TYPE)) {
      if (leaf.view instanceof IssueListView) {
        leaf.view.refresh();
      }
    }

    for (const leaf of this.app.workspace.getLeavesOfType(BUILD_LOG_VIEW_TYPE)) {
      if (leaf.view instanceof BuildLogView) {
        leaf.view.refresh();
      }
    }
  }

  private getOrCreateViewLeaf(viewType: string): WorkspaceLeaf {
    return this.app.workspace.getLeavesOfType(viewType)[0] ?? this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
  }
}

function resolveVaultRoot(plugin: Plugin): string {
  if (plugin.app.vault.adapter instanceof FileSystemAdapter) {
    return plugin.app.vault.adapter.getBasePath();
  }

  throw new Error("Obsidian Site Publisher requires FileSystemAdapter and desktop vault access.");
}

function resolvePluginRoot(plugin: Plugin, vaultRoot: string): string {
  return path.join(vaultRoot, plugin.app.vault.configDir, "plugins", pluginManifest.id);
}

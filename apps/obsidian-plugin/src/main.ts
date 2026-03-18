import { FileSystemAdapter, Notice, Plugin, type WorkspaceLeaf } from "obsidian";

import { createBundledPluginCliBackendFactory } from "./bundled-cli.js";
import { PluginCommandController } from "./plugin-controller.js";
import { PublisherPluginSettingTab } from "./plugin-settings-tab.js";
import { BuildLogView, BUILD_LOG_VIEW_TYPE, IssueListView, ISSUE_LIST_VIEW_TYPE } from "./plugin-views.js";
import { pluginManifest, PublisherPluginShell } from "./plugin-shell.js";
import { loadPluginSettings, savePluginSettings } from "./settings.js";

export { pluginManifest } from "./plugin-shell.js";
export * from "./plugin-controller.js";
export * from "./plugin-settings-tab.js";
export * from "./plugin-shell.js";
export * from "./bundled-cli.js";
export * from "./plugin-view-model.js";
export * from "./plugin-views.js";
export * from "./settings.js";

export default class ObsidianSitePublisherPlugin extends Plugin {
  private shell = new PublisherPluginShell();
  private settings = this.shell.createInitialConfig("");
  private statusBarEl?: HTMLElement;
  private controller?: PluginCommandController;

  public override async onload(): Promise<void> {
    const vaultRoot = resolveVaultRoot(this);

    this.shell = new PublisherPluginShell(createBundledPluginCliBackendFactory(vaultRoot, {
      dir: this.manifest.dir,
      id: this.manifest.id
    }));
    const loadedSettings = await loadPluginSettings(this, this.shell, vaultRoot);

    this.settings = loadedSettings.config;
    this.registerWorkspaceViews();
    this.statusBarEl = this.addStatusBarItem();
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
        setStatus: (message) => this.statusBarEl?.setText(message),
        showNotice: (message) => {
          new Notice(message);
        },
        revealIssueListView: async () => this.revealPluginView(ISSUE_LIST_VIEW_TYPE),
        revealBuildLogView: async () => this.revealPluginView(BUILD_LOG_VIEW_TYPE),
        refreshViews: () => this.refreshPluginViews()
      },
      () => this.settings
    );

    this.controller.registerCommands();
    this.statusBarEl.setText("Obsidian Site Publisher ready.");
    this.addSettingTab(new PublisherPluginSettingTab(this.app, this));
  }

  public override onunload(): void {
    void this.shell.dispose();
    this.app.workspace.detachLeavesOfType(ISSUE_LIST_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(BUILD_LOG_VIEW_TYPE);
  }

  public async updateConfig(nextConfig: typeof this.settings): Promise<void> {
    this.settings = nextConfig;
    await savePluginSettings(this, {
      config: this.settings
    });
    this.statusBarEl?.setText("Publisher settings saved.");
  }

  public getConfig(): typeof this.settings {
    return this.settings;
  }

  public async updateConfigWith(updater: (currentConfig: typeof this.settings) => typeof this.settings): Promise<void> {
    await this.updateConfig(updater(this.settings));
  }

  private registerWorkspaceViews(): void {
    this.registerView(ISSUE_LIST_VIEW_TYPE, (leaf) => new IssueListView(leaf, () => this.shell.getState()));
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

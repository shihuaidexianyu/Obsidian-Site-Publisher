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
    this.registerVaultChangeListeners();
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
        openUrl: (url) => {
          const openUrl = (globalThis as {
            open?: (href: string, target?: string, features?: string) => unknown;
          }).open;

          openUrl?.(url, "_blank", "noopener,noreferrer");
        },
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
    this.shell.invalidateReusableBuild();
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
          () => this.controller?.getActiveCommand(),
          async (command) => {
            if (this.controller === undefined) {
              throw new Error("插件控制器尚未准备就绪。");
            }

            await this.controller.runCommand(command);
          },
          async () => {
            if (this.controller?.getActiveCommand() !== undefined) {
              new Notice("当前已有任务正在运行，请等待后再停止预览。");
              return;
            }

            const stopped = await this.shell.stopPreview();

            if (!stopped) {
              new Notice("当前没有正在运行的预览。");
              return;
            }

            new Notice("预览已停止。");
            this.refreshPluginViews();
          }
        )
    );
    this.registerView(ISSUE_LIST_VIEW_TYPE, (leaf) => new IssueListView(leaf, () => this.shell.getState(), () => this.settings.ui));
    this.registerView(BUILD_LOG_VIEW_TYPE, (leaf) => new BuildLogView(leaf, () => this.shell.getState()));
  }

  private registerVaultChangeListeners(): void {
    const invalidate = (): void => {
      this.shell.invalidateReusableBuild();
      this.refreshPluginViews();
    };

    this.registerEvent(this.app.vault.on("modify", invalidate));
    this.registerEvent(this.app.vault.on("create", invalidate));
    this.registerEvent(this.app.vault.on("delete", invalidate));
    this.registerEvent(this.app.vault.on("rename", invalidate));
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

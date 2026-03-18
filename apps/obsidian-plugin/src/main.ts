import { FileSystemAdapter, Notice, Plugin, PluginSettingTab, Setting, type WorkspaceLeaf } from "obsidian";

import { createBundledPluginCliBackendFactory } from "./bundled-runtime.js";
import { PluginCommandController } from "./plugin-controller.js";
import { BuildLogView, BUILD_LOG_VIEW_TYPE, IssueListView, ISSUE_LIST_VIEW_TYPE } from "./plugin-views.js";
import { pluginManifest, PublisherPluginShell } from "./plugin-shell.js";
import { loadPluginSettings, savePluginSettings } from "./settings.js";

export * from "./bundled-runtime.js";
export * from "./cli-backend.js";
export { pluginManifest } from "./plugin-shell.js";
export * from "./plugin-backend.js";
export * from "./plugin-controller.js";
export * from "./plugin-shell.js";
export * from "./plugin-view-model.js";
export * from "./plugin-views.js";
export * from "./settings.js";

const deployTargetOptions = [
  { value: "none", label: "None" },
  { value: "local-export", label: "Local export" },
  { value: "git-branch", label: "Git branch" },
  { value: "github-pages", label: "GitHub Pages" }
] as const;

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

class PublisherPluginSettingTab extends PluginSettingTab {
  public constructor(app: Plugin["app"], private readonly plugin: ObsidianSitePublisherPlugin) {
    super(app, plugin);
  }

  public display(): void {
    const { containerEl } = this;
    const config = this.plugin.getConfig();

    containerEl.empty();
    containerEl.createEl("h2", {
      text: "Obsidian Site Publisher"
    });

    new Setting(containerEl)
      .setName("Publish mode")
      .setDesc("Choose whether published notes are selected by frontmatter or by folder.")
      .addDropdown((dropdown) => {
        dropdown.addOption("frontmatter", "Frontmatter");
        dropdown.addOption("folder", "Folder");
        dropdown.setValue(config.publishMode);
        dropdown.onChange(async (value) => {
          await this.plugin.updateConfigWith((currentConfig) => ({
            ...currentConfig,
            publishMode: value === "folder" ? "folder" : "frontmatter"
          }));
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Publish root")
      .setDesc("Optional folder root used when publish mode is folder.")
      .addText((text) => {
        text.setPlaceholder("Public");
        text.setValue(config.publishRoot ?? "");
        text.onChange(async (value) => {
          await this.plugin.updateConfigWith((currentConfig) => {
            const nextConfig = { ...currentConfig };

            if (value.trim() === "") {
              delete nextConfig.publishRoot;
            } else {
              nextConfig.publishRoot = value.trim();
            }

            return nextConfig;
          });
        });
      });

    new Setting(containerEl)
      .setName("Output directory")
      .setDesc("Where generated site output should be written.")
      .addText((text) => {
        text.setValue(config.outputDir);
        text.onChange(async (value) => {
          await this.plugin.updateConfigWith((currentConfig) => ({
            ...currentConfig,
            outputDir: value.trim()
          }));
        });
      });

    new Setting(containerEl)
      .setName("Deploy target")
      .setDesc("Choose where the Publish command should deploy the built site.")
      .addDropdown((dropdown) => {
        for (const option of deployTargetOptions) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown.setValue(config.deployTarget);
        dropdown.onChange(async (value) => {
          await this.plugin.updateConfigWith((currentConfig) => ({
            ...currentConfig,
            deployTarget: normalizeDeployTarget(value)
          }));
          this.display();
        });
      });

    if (config.deployTarget === "local-export") {
      addOptionalTextSetting(
        containerEl,
        "Deploy output directory",
        "Optional target directory used by local export deploys.",
        config.deployOutputDir,
        "published-site",
        async (value) => {
          await this.plugin.updateConfigWith((currentConfig) => updateOptionalConfigValue(currentConfig, "deployOutputDir", value));
        }
      );
    }

    if (config.deployTarget === "git-branch" || config.deployTarget === "github-pages") {
      addOptionalTextSetting(
        containerEl,
        "Deploy repository URL",
        "Optional remote repository URL to publish into, for example a GitHub Pages repository.",
        config.deployRepositoryUrl,
        "https://github.com/owner/repo",
        async (value) => {
          await this.plugin.updateConfigWith((currentConfig) =>
            updateOptionalConfigValue(currentConfig, "deployRepositoryUrl", value)
          );
        }
      );
      addOptionalTextSetting(
        containerEl,
        "Deploy branch",
        "Optional branch override. Leave empty to use the target default.",
        config.deployBranch,
        config.deployTarget === "github-pages" ? "main or gh-pages" : "gh-pages",
        async (value) => {
          await this.plugin.updateConfigWith((currentConfig) => updateOptionalConfigValue(currentConfig, "deployBranch", value));
        }
      );
      addOptionalTextSetting(
        containerEl,
        "Deploy commit message",
        "Optional commit message used for git-backed deploys.",
        config.deployCommitMessage,
        "Deploy static site",
        async (value) => {
          await this.plugin.updateConfigWith((currentConfig) =>
            updateOptionalConfigValue(currentConfig, "deployCommitMessage", value)
          );
        }
      );
    }

    addToggleSetting(containerEl, "Strict mode", "Block preview and build on warnings too.", config.strictMode, async (value) => {
      await this.plugin.updateConfigWith((currentConfig) => ({
        ...currentConfig,
        strictMode: value
      }));
    });
    addToggleSetting(containerEl, "Enable search", "Expose Quartz search UI on the generated site.", config.enableSearch, async (value) => {
      await this.plugin.updateConfigWith((currentConfig) => ({
        ...currentConfig,
        enableSearch: value
      }));
    });
    addToggleSetting(containerEl, "Enable backlinks", "Expose backlinks on generated note pages.", config.enableBacklinks, async (value) => {
      await this.plugin.updateConfigWith((currentConfig) => ({
        ...currentConfig,
        enableBacklinks: value
      }));
    });
    addToggleSetting(containerEl, "Enable graph", "Expose the Quartz graph view.", config.enableGraph, async (value) => {
      await this.plugin.updateConfigWith((currentConfig) => ({
        ...currentConfig,
        enableGraph: value
      }));
    });
  }
}

function addToggleSetting(
  containerEl: HTMLElement,
  name: string,
  description: string,
  value: boolean,
  onChange: (value: boolean) => Promise<void>
): void {
  new Setting(containerEl)
    .setName(name)
    .setDesc(description)
    .addToggle((toggle) => {
      toggle.setValue(value);
      toggle.onChange(async (nextValue) => {
        await onChange(nextValue);
      });
    });
}

function addOptionalTextSetting(
  containerEl: HTMLElement,
  name: string,
  description: string,
  value: string | undefined,
  placeholder: string,
  onChange: (value: string) => Promise<void>
): void {
  new Setting(containerEl)
    .setName(name)
    .setDesc(description)
    .addText((text) => {
      text.setPlaceholder(placeholder);
      text.setValue(value ?? "");
      text.onChange(async (nextValue) => {
        await onChange(nextValue);
      });
    });
}

function normalizeDeployTarget(value: string): typeof deployTargetOptions[number]["value"] {
  return deployTargetOptions.some((option) => option.value === value) ? value as typeof deployTargetOptions[number]["value"] : "none";
}

function updateOptionalConfigValue<TKey extends "deployOutputDir" | "deployRepositoryUrl" | "deployBranch" | "deployCommitMessage">(
  currentConfig: ObsidianSitePublisherPlugin["getConfig"] extends () => infer TConfig ? TConfig : never,
  key: TKey,
  value: string
): ObsidianSitePublisherPlugin["getConfig"] extends () => infer TConfig ? TConfig : never {
  const nextConfig = { ...currentConfig };

  if (value.trim() === "") {
    delete nextConfig[key];
  } else {
    nextConfig[key] = value.trim();
  }

  return nextConfig;
}

function resolveVaultRoot(plugin: Plugin): string {
  if (plugin.app.vault.adapter instanceof FileSystemAdapter) {
    return plugin.app.vault.adapter.getBasePath();
  }

  throw new Error("Obsidian Site Publisher requires FileSystemAdapter and desktop vault access.");
}

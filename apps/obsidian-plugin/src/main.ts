import { FileSystemAdapter, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";

import { PluginCommandController } from "./plugin-controller.js";
import { pluginManifest, PublisherPluginShell } from "./plugin-shell.js";
import { loadPluginSettings, savePluginSettings } from "./settings.js";

export { pluginManifest } from "./plugin-shell.js";
export * from "./plugin-controller.js";
export * from "./plugin-shell.js";
export * from "./settings.js";

export default class ObsidianSitePublisherPlugin extends Plugin {
  private readonly shell = new PublisherPluginShell();
  private settings = this.shell.createInitialConfig("");
  private statusBarEl?: HTMLElement;
  private controller?: PluginCommandController;

  public override async onload(): Promise<void> {
    const vaultRoot = resolveVaultRoot(this);
    const loadedSettings = await loadPluginSettings(this, this.shell, vaultRoot);

    this.settings = loadedSettings.config;
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
        }
      },
      () => this.settings
    );

    this.controller.registerCommands();
    this.statusBarEl.setText("Obsidian Site Publisher ready.");
    this.addSettingTab(new PublisherPluginSettingTab(this.app, this));
  }

  public override onunload(): void {
    void this.shell.dispose();
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

function resolveVaultRoot(plugin: Plugin): string {
  if (plugin.app.vault.adapter instanceof FileSystemAdapter) {
    return plugin.app.vault.adapter.getBasePath();
  }

  throw new Error("Obsidian Site Publisher requires FileSystemAdapter and desktop vault access.");
}

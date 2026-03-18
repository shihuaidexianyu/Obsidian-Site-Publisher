import type { PublisherConfig } from "@osp/shared";
import { PluginSettingTab, Setting, type Plugin } from "obsidian";

const deployTargetOptions = [
  { value: "none", label: "None" },
  { value: "local-export", label: "Local export" },
  { value: "git-branch", label: "Git branch" },
  { value: "github-pages", label: "GitHub Pages" }
] as const;

type PluginSettingsHost = Plugin & {
  getConfig(): PublisherConfig;
  updateConfigWith(updater: (currentConfig: PublisherConfig) => PublisherConfig): Promise<void>;
};

export class PublisherPluginSettingTab extends PluginSettingTab {
  public constructor(app: Plugin["app"], private readonly plugin: PluginSettingsHost) {
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

    addOptionalTextSetting(
      containerEl,
      "Publish root",
      "Optional folder root used when publish mode is folder.",
      config.publishRoot,
      "Public",
      async (value) => {
        await this.plugin.updateConfigWith((currentConfig) => updateOptionalConfigValue(currentConfig, "publishRoot", value));
      }
    );

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

function normalizeDeployTarget(value: string): PublisherConfig["deployTarget"] {
  return deployTargetOptions.some((option) => option.value === value) ? (value as PublisherConfig["deployTarget"]) : "none";
}

function updateOptionalConfigValue<TKey extends "publishRoot" | "deployOutputDir" | "deployRepositoryUrl" | "deployBranch" | "deployCommitMessage">(
  currentConfig: PublisherConfig,
  key: TKey,
  value: string
): PublisherConfig {
  const nextConfig = { ...currentConfig };

  if (value.trim() === "") {
    delete nextConfig[key];
  } else {
    nextConfig[key] = value.trim();
  }

  return nextConfig;
}

import type { PublisherConfig } from "@osp/shared";
import { PluginSettingTab, Setting, type Plugin } from "obsidian";

import {
  deployTargetOptions,
  normalizeDeployTarget,
  updateOptionalCliSetting,
  updateOptionalConfigValue,
  updatePreviewPortSetting
} from "./plugin-settings-helpers.js";
import type { PublisherPluginSettings } from "./settings.js";

type PluginSettingsHost = Plugin & {
  getSettings(): PublisherPluginSettings;
  updateSettingsWith(updater: (currentSettings: PublisherPluginSettings) => PublisherPluginSettings): Promise<void>;
};

export class PublisherPluginSettingTab extends PluginSettingTab {
  public constructor(app: Plugin["app"], private readonly plugin: PluginSettingsHost) {
    super(app, plugin);
  }

  public display(): void {
    const { containerEl } = this;
    const settings = this.plugin.getSettings();
    const { config, cli } = settings;

    containerEl.empty();
    containerEl.createEl("h2", {
      text: "站点发布设置"
    });

    new Setting(containerEl)
      .setName("发布模式")
      .setDesc("选择通过 frontmatter 或文件夹来决定哪些笔记会被发布。")
      .addDropdown((dropdown) => {
        dropdown.addOption("frontmatter", "属性模式");
        dropdown.addOption("folder", "文件夹模式");
        dropdown.setValue(config.publishMode);
        dropdown.onChange(async (value) => {
          await this.plugin.updateSettingsWith((currentSettings) => ({
            ...currentSettings,
            config: {
              ...currentSettings.config,
              publishMode: value === "folder" ? "folder" : "frontmatter"
            }
          }));
          this.display();
        });
      });

    addOptionalTextSetting(
      containerEl,
      "发布根目录",
      "文件夹模式下可选的发布根目录。",
      config.publishRoot,
      "公开内容",
      async (value) => {
        await this.plugin.updateSettingsWith((currentSettings) => ({
          ...currentSettings,
          config: updateOptionalConfigValue(currentSettings.config, "publishRoot", value)
        }));
      }
    );

    new Setting(containerEl)
      .setName("站点输出目录")
      .setDesc("生成后的静态站点会写入这里。")
      .addText((text) => {
        text.setValue(config.outputDir);
        text.onChange(async (value) => {
          await this.plugin.updateSettingsWith((currentSettings) => ({
            ...currentSettings,
            config: {
              ...currentSettings.config,
              outputDir: value.trim()
            }
          }));
        });
      });

    new Setting(containerEl)
      .setName("发布目标")
      .setDesc("选择“发布站点”命令应把构建结果发到哪里。")
      .addDropdown((dropdown) => {
        for (const option of deployTargetOptions) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown.setValue(config.deployTarget);
        dropdown.onChange(async (value) => {
          await this.plugin.updateSettingsWith((currentSettings) => ({
            ...currentSettings,
            config: {
              ...currentSettings.config,
              deployTarget: normalizeDeployTarget(value)
            }
          }));
          this.display();
        });
      });

    if (config.deployTarget === "local-export") {
      addOptionalTextSetting(
        containerEl,
        "导出目标目录",
        "本地导出模式下可选的目标目录。",
        config.deployOutputDir,
        "已发布站点",
        async (value) => {
          await this.plugin.updateSettingsWith((currentSettings) => ({
            ...currentSettings,
            config: updateOptionalConfigValue(currentSettings.config, "deployOutputDir", value)
          }));
        }
      );
    }

    if (config.deployTarget === "git-branch" || config.deployTarget === "github-pages") {
      addOptionalTextSetting(
        containerEl,
        "发布仓库地址",
        "例如 GitHub Pages 仓库地址。",
        config.deployRepositoryUrl,
        "https://github.com/owner/repo",
        async (value) => {
          await this.plugin.updateSettingsWith((currentSettings) => ({
            ...currentSettings,
            config: updateOptionalConfigValue(currentSettings.config, "deployRepositoryUrl", value)
          }));
        }
      );
      addOptionalTextSetting(
        containerEl,
        "发布分支",
        "留空时使用默认分支。",
        config.deployBranch,
        config.deployTarget === "github-pages" ? "main 或 gh-pages" : "gh-pages",
        async (value) => {
          await this.plugin.updateSettingsWith((currentSettings) => ({
            ...currentSettings,
            config: updateOptionalConfigValue(currentSettings.config, "deployBranch", value)
          }));
        }
      );
      addOptionalTextSetting(
        containerEl,
        "发布提交说明",
        "Git 发布时使用的提交说明。",
        config.deployCommitMessage,
        "发布静态站点",
        async (value) => {
          await this.plugin.updateSettingsWith((currentSettings) => ({
            ...currentSettings,
            config: updateOptionalConfigValue(currentSettings.config, "deployCommitMessage", value)
          }));
        }
      );
    }

    addOptionalTextSetting(
      containerEl,
      "CLI 可执行文件路径",
      "留空时使用系统 PATH 中的 publisher-cli。",
      cli.executablePath,
      "publisher-cli",
      async (value) => {
        await this.plugin.updateSettingsWith((currentSettings) => ({
          ...currentSettings,
          cli: updateOptionalCliSetting(currentSettings.cli, "executablePath", value)
        }));
      }
    );
    addOptionalTextSetting(
      containerEl,
      "CLI 日志目录",
      "留空时使用 vault/.osp/logs。",
      cli.logDirectory,
      ".osp/logs",
      async (value) => {
        await this.plugin.updateSettingsWith((currentSettings) => ({
          ...currentSettings,
          cli: updateOptionalCliSetting(currentSettings.cli, "logDirectory", value)
        }));
      }
    );
    new Setting(containerEl)
      .setName("预览端口")
      .setDesc("留空时由 CLI 使用默认预览端口。")
      .addText((text) => {
        text.setPlaceholder("8080");
        text.setValue(cli.previewPort === undefined ? "" : `${cli.previewPort}`);
        text.onChange(async (value) => {
          await this.plugin.updateSettingsWith((currentSettings) => ({
            ...currentSettings,
            cli: updatePreviewPortSetting(currentSettings.cli, value)
          }));
        });
      });

    addToggleSetting(containerEl, "严格模式", "warning 也会阻断预览和构建。", config.strictMode, async (value) => {
      await this.plugin.updateSettingsWith((currentSettings) => ({
        ...currentSettings,
        config: {
          ...currentSettings.config,
          strictMode: value
        }
      }));
    });
    addToggleSetting(containerEl, "启用搜索", "在生成站点中展示 Quartz 搜索。", config.enableSearch, async (value) => {
      await this.plugin.updateSettingsWith((currentSettings) => ({
        ...currentSettings,
        config: {
          ...currentSettings.config,
          enableSearch: value
        }
      }));
    });
    addToggleSetting(containerEl, "启用反向链接", "在页面中展示反向链接。", config.enableBacklinks, async (value) => {
      await this.plugin.updateSettingsWith((currentSettings) => ({
        ...currentSettings,
        config: {
          ...currentSettings.config,
          enableBacklinks: value
        }
      }));
    });
    addToggleSetting(containerEl, "启用知识图谱", "在站点中展示 Quartz 图谱视图。", config.enableGraph, async (value) => {
      await this.plugin.updateSettingsWith((currentSettings) => ({
        ...currentSettings,
        config: {
          ...currentSettings.config,
          enableGraph: value
        }
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

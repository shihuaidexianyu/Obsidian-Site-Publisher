import type { PublisherConfig } from "@osp/shared";

import type { PublisherPluginSettings } from "./settings.js";

export const deployTargetOptions = [
  { value: "none", label: "不部署" },
  { value: "local-export", label: "导出到本地目录" },
  { value: "git-branch", label: "发布到 Git 分支" },
  { value: "github-pages", label: "发布到 GitHub Pages" }
] as const;

export function normalizeDeployTarget(value: string): PublisherConfig["deployTarget"] {
  return deployTargetOptions.some((option) => option.value === value) ? (value as PublisherConfig["deployTarget"]) : "none";
}

export function updateOptionalConfigValue<
  TKey extends "publishRoot" | "deployOutputDir" | "deployRepositoryUrl" | "deployBranch" | "deployCommitMessage"
>(currentConfig: PublisherConfig, key: TKey, value: string): PublisherConfig {
  const nextConfig = { ...currentConfig };

  if (value.trim() === "") {
    delete nextConfig[key];
  } else {
    nextConfig[key] = value.trim();
  }

  return nextConfig;
}

export function updateOptionalCliSetting<TKey extends "executablePath" | "logDirectory">(
  currentSettings: PublisherPluginSettings["cli"],
  key: TKey,
  value: string
): PublisherPluginSettings["cli"] {
  const nextSettings = { ...currentSettings };

  if (value.trim() === "") {
    delete nextSettings[key];
  } else {
    nextSettings[key] = value.trim();
  }

  return nextSettings;
}

export function updatePreviewPortSetting(
  currentSettings: PublisherPluginSettings["cli"],
  value: string
): PublisherPluginSettings["cli"] {
  const nextSettings = { ...currentSettings };
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    delete nextSettings.previewPort;
    return nextSettings;
  }

  const parsedPort = Number.parseInt(trimmedValue, 10);

  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    nextSettings.previewPort = parsedPort;
  }

  return nextSettings;
}

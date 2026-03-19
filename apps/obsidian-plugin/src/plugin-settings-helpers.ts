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
  const normalizedValue = key === "executablePath" ? normalizeExecutablePath(value) : value.trim();

  if (normalizedValue === "") {
    delete nextSettings[key];
  } else {
    nextSettings[key] = normalizedValue;
  }

  return nextSettings;
}

export function formatGlobList(patterns: string[]): string {
  return patterns.join("\n");
}

export function parseGlobList(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

export function updateGlobListSetting<TKey extends "includeGlobs" | "excludeGlobs">(
  currentConfig: PublisherConfig,
  key: TKey,
  value: string
): PublisherConfig {
  return {
    ...currentConfig,
    [key]: parseGlobList(value)
  };
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

function normalizeExecutablePath(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length >= 2) {
    const firstCharacter = trimmedValue[0];
    const lastCharacter = trimmedValue.at(-1);

    if ((firstCharacter === "\"" || firstCharacter === "'") && firstCharacter === lastCharacter) {
      return trimmedValue.slice(1, -1).trim();
    }
  }

  return trimmedValue;
}

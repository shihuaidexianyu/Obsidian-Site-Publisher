import { existsSync } from "node:fs";
import path from "node:path";

import { CliPluginBackend } from "./cli-backend.js";
import type { PluginExecutionBackend } from "./plugin-backend.js";
import type { PublisherPluginCliSettings } from "./settings.js";

export function createExternalCliBackendFactory(
  vaultRoot: string,
  pluginRoot: string,
  readCliSettings: () => PublisherPluginCliSettings
): () => PluginExecutionBackend {
  return () => {
    const cliSettings = readCliSettings();
    const logDirectory = resolveCliLogDirectory(vaultRoot, cliSettings);
    const quartzPackageRoot = resolveBundledQuartzPackageRoot(pluginRoot, cliSettings);

    return new CliPluginBackend({
      cliCommand: resolveCliCommand(vaultRoot, pluginRoot, cliSettings),
      ...(logDirectory === undefined ? {} : { logDirectory }),
      ...(cliSettings.previewPort === undefined ? {} : { previewPort: cliSettings.previewPort }),
      ...(quartzPackageRoot === undefined ? {} : { quartzPackageRoot })
    });
  };
}

export function resolveCliCommand(vaultRoot: string, pluginRoot: string, settings: PublisherPluginCliSettings): string {
  if (settings.executablePath !== undefined && settings.executablePath.trim() !== "") {
    return path.isAbsolute(settings.executablePath)
      ? settings.executablePath
      : path.resolve(vaultRoot, settings.executablePath);
  }

  const bundledCommand = resolveBundledCliCommand(pluginRoot);

  if (bundledCommand !== undefined) {
    return bundledCommand;
  }

  return process.platform === "win32" ? "publisher-cli.cmd" : "publisher-cli";
}

export function resolveCliLogDirectory(vaultRoot: string, settings: PublisherPluginCliSettings): string | undefined {
  if (settings.logDirectory === undefined || settings.logDirectory.trim() === "") {
    return undefined;
  }

  return path.isAbsolute(settings.logDirectory)
    ? settings.logDirectory
    : path.resolve(vaultRoot, settings.logDirectory);
}

export function resolveBundledCliCommand(pluginRoot: string): string | undefined {
  const candidates =
    process.platform === "win32"
      ? [path.join(pluginRoot, "bin", "publisher-cli.exe"), path.join(pluginRoot, "bin", "publisher-cli.cmd")]
      : [path.join(pluginRoot, "bin", "publisher-cli")];

  return candidates.find((candidate) => existsSync(candidate));
}

export function resolveBundledQuartzPackageRoot(
  pluginRoot: string,
  settings: PublisherPluginCliSettings
): string | undefined {
  if (settings.executablePath !== undefined && settings.executablePath.trim() !== "") {
    return undefined;
  }

  const bundledCommand = resolveBundledCliCommand(pluginRoot);

  if (bundledCommand === undefined) {
    return undefined;
  }

  const bundledQuartzPackageRoot = path.join(pluginRoot, "bin", "runtime", "app", "node_modules", "@jackyzha0", "quartz");

  return existsSync(path.join(bundledQuartzPackageRoot, "package.json")) ? bundledQuartzPackageRoot : undefined;
}

import path from "node:path";

import { CliPluginBackend } from "./cli-backend.js";
import type { PluginExecutionBackend } from "./plugin-backend.js";
import type { PublisherPluginCliSettings } from "./settings.js";

export function createExternalCliBackendFactory(
  vaultRoot: string,
  readCliSettings: () => PublisherPluginCliSettings
): () => PluginExecutionBackend {
  return () => {
    const cliSettings = readCliSettings();
    const logDirectory = resolveCliLogDirectory(vaultRoot, cliSettings);

    return new CliPluginBackend({
      cliCommand: resolveCliCommand(vaultRoot, cliSettings),
      ...(logDirectory === undefined ? {} : { logDirectory }),
      ...(cliSettings.previewPort === undefined ? {} : { previewPort: cliSettings.previewPort })
    });
  };
}

export function resolveCliCommand(vaultRoot: string, settings: PublisherPluginCliSettings): string {
  if (settings.executablePath === undefined || settings.executablePath.trim() === "") {
    return process.platform === "win32" ? "publisher-cli.cmd" : "publisher-cli";
  }

  return path.isAbsolute(settings.executablePath)
    ? settings.executablePath
    : path.resolve(vaultRoot, settings.executablePath);
}

export function resolveCliLogDirectory(vaultRoot: string, settings: PublisherPluginCliSettings): string | undefined {
  if (settings.logDirectory === undefined || settings.logDirectory.trim() === "") {
    return undefined;
  }

  return path.isAbsolute(settings.logDirectory)
    ? settings.logDirectory
    : path.resolve(vaultRoot, settings.logDirectory);
}

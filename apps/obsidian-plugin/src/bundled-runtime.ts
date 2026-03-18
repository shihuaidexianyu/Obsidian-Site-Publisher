import path from "node:path";
import { accessSync } from "node:fs";
import { createRequire } from "node:module";

import { createDefaultPublisherRuntime, type DefaultPublisherRuntime } from "@osp/core";
import { pluginManifest } from "./plugin-shell.js";

type PluginManifestLike = {
  dir: string | undefined;
  id: string;
};

export function createBundledPluginRuntimeFactory(
  vaultRoot: string,
  manifest: PluginManifestLike
): () => DefaultPublisherRuntime {
  const pluginInstallRoot = resolvePluginInstallRoot(vaultRoot, manifest);
  const quartzPackageRoot = resolveBundledQuartzPackageRoot(pluginInstallRoot);

  return () =>
    createDefaultPublisherRuntime({
      ...(quartzPackageRoot === undefined ? {} : { builder: { quartzPackageRoot } })
    });
}

export function resolvePluginInstallRoot(vaultRoot: string, manifest: PluginManifestLike): string {
  return path.resolve(vaultRoot, manifest.dir ?? path.join(".obsidian", "plugins", manifest.id || pluginManifest.id));
}

export function resolveBundledQuartzPackageRoot(pluginInstallRoot: string): string | undefined {
  const runtimePackageJsonPath = path.join(pluginInstallRoot, "runtime", "package.json");

  try {
    accessSync(runtimePackageJsonPath);
    const runtimeRequire = createRequire(runtimePackageJsonPath);

    return path.dirname(runtimeRequire.resolve("@jackyzha0/quartz/package.json"));
  } catch {
    return undefined;
  }
}

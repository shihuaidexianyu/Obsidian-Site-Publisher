import path from "node:path";
import { accessSync, readdirSync } from "node:fs";
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
    const pnpmQuartzPackageRoot = resolveVendoredPnpmQuartzPackageRoot(path.dirname(runtimePackageJsonPath));

    if (pnpmQuartzPackageRoot !== undefined) {
      return pnpmQuartzPackageRoot;
    }

    const runtimeRequire = createRequire(runtimePackageJsonPath);
    return path.dirname(runtimeRequire.resolve("@jackyzha0/quartz/package.json"));
  } catch {
    return undefined;
  }
}

function resolveVendoredPnpmQuartzPackageRoot(runtimeRoot: string): string | undefined {
  const pnpmRoot = path.join(runtimeRoot, "node_modules", ".pnpm");

  try {
    for (const entry of readdirSync(pnpmRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("@jackyzha0+quartz@")) {
        continue;
      }

      const candidatePackageJsonPath = path.join(pnpmRoot, entry.name, "node_modules", "@jackyzha0", "quartz", "package.json");

      try {
        accessSync(candidatePackageJsonPath);
        return path.dirname(candidatePackageJsonPath);
      } catch {
        // Keep scanning alternative pnpm package directories.
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

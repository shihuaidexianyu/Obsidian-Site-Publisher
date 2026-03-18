import { findMatchingAsset, normalizeVaultPath } from "@osp/shared";
import type { AssetRef, BuildIssue, VaultManifest } from "@osp/shared";

import { normalizePath } from "./reference-resolution.js";

export function analyzeMissingAssets(manifest: VaultManifest, sourceNotePaths?: ReadonlySet<string>): BuildIssue[] {
  const availableAssets = new Map<string, AssetRef>(
    manifest.assetFiles.map((asset) => [normalizeVaultPath(asset.path), asset] as const)
  );
  const issues: BuildIssue[] = [];

  for (const note of manifest.notes) {
    if (sourceNotePaths !== undefined && !sourceNotePaths.has(normalizePath(note.path))) {
      continue;
    }

    for (const asset of note.assets) {
      if (findMatchingAsset(availableAssets, note.path, asset.path, manifest.vaultSettings) !== undefined) {
        continue;
      }

      issues.push({
        code: "MISSING_ASSET",
        severity: "error",
        file: note.path,
        message: `Asset "${asset.path}" referenced from ${note.path} could not be found in the vault.`,
        suggestion: "Add the missing file, fix the asset path, or remove the stale embed/link."
      });
    }
  }

  return issues;
}

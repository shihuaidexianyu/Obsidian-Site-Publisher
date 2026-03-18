import type { BuildIssue, VaultManifest } from "@osp/shared";

import { normalizePath, resolveAssetTarget } from "./reference-resolution";

export function analyzeMissingAssets(manifest: VaultManifest, sourceNotePaths?: ReadonlySet<string>): BuildIssue[] {
  const availableAssets = new Set(manifest.assetFiles.map((asset) => normalizePath(asset.path)));
  const issues: BuildIssue[] = [];

  for (const note of manifest.notes) {
    if (sourceNotePaths !== undefined && !sourceNotePaths.has(normalizePath(note.path))) {
      continue;
    }

    for (const asset of note.assets) {
      const resolvedAssetPath = resolveAssetTarget(note.path, asset.path);

      if (availableAssets.has(resolvedAssetPath)) {
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

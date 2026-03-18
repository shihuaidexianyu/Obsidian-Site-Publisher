import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { findMatchingAsset, normalizeVaultPath, selectPublishedNotes } from "@osp/shared";
import type { AssetRef, NoteRecord, PreparedWorkspace, VaultManifest } from "@osp/shared";

import type { PrepareStagingInput, StagingService } from "./contracts.js";

export class FileSystemStagingService implements StagingService {
  public async prepare(input: PrepareStagingInput): Promise<PreparedWorkspace> {
    const rootDir = input.stagingRoot ?? path.join(input.config.vaultRoot, ".osp", input.mode);
    const contentDir = path.join(rootDir, "content");
    const outputDir = path.join(rootDir, "dist");
    const manifestPath = path.join(rootDir, "manifest.json");
    const publishedNotes = selectPublishedNotes(input.manifest, input.config);
    const referencedAssets = collectReferencedAssets(input.manifest, publishedNotes, input.manifest.assetFiles);
    const stagedManifest = createStagedManifest(input.manifest, publishedNotes, referencedAssets);

    await rm(rootDir, { recursive: true, force: true });
    await mkdir(contentDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await copyVaultFiles(input.config.vaultRoot, contentDir, publishedNotes.map((note) => note.path));
    await copyVaultFiles(input.config.vaultRoot, contentDir, referencedAssets.map((asset) => asset.path));
    await writeFile(manifestPath, JSON.stringify(stagedManifest, null, 2), "utf8");

    return {
      mode: input.mode,
      rootDir,
      contentDir,
      outputDir,
      manifestPath
    };
  }
}

function collectReferencedAssets(manifest: VaultManifest, notes: NoteRecord[], availableAssets: AssetRef[]): AssetRef[] {
  const availableAssetsByPath = new Map(availableAssets.map((asset) => [normalizeVaultPath(asset.path), asset] as const));
  const selectedAssets: AssetRef[] = [];
  const seenPaths = new Set<string>();

  for (const note of notes) {
    for (const asset of note.assets) {
      const matchedAsset = findMatchingAsset(availableAssetsByPath, note.path, asset.path, manifest.vaultSettings);

      if (matchedAsset === undefined || seenPaths.has(matchedAsset.path)) {
        continue;
      }

      seenPaths.add(matchedAsset.path);
      selectedAssets.push(matchedAsset);
    }
  }

  return selectedAssets;
}

function createStagedManifest(
  manifest: VaultManifest,
  notes: NoteRecord[],
  assetFiles: AssetRef[]
): VaultManifest {
  return {
    ...manifest,
    notes,
    assetFiles,
    unsupportedObjects: []
  };
}

async function copyVaultFiles(vaultRoot: string, targetRoot: string, relativePaths: string[]): Promise<void> {
  for (const relativePath of relativePaths) {
    const sourcePath = path.join(vaultRoot, relativePath);
    const destinationPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }
}

function normalizePath(targetPath: string): string {
  return targetPath.replace(/\\/g, "/");
}

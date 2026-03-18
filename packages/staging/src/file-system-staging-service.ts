import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { selectPublishedNotes } from "@osp/shared";
import type { AssetRef, NoteRecord, PreparedWorkspace, VaultManifest } from "@osp/shared";

import type { PrepareStagingInput, StagingService } from "./contracts";

export class FileSystemStagingService implements StagingService {
  public async prepare(input: PrepareStagingInput): Promise<PreparedWorkspace> {
    const rootDir = input.stagingRoot ?? path.join(input.config.vaultRoot, ".osp", input.mode);
    const contentDir = path.join(rootDir, "content");
    const outputDir = path.join(rootDir, "dist");
    const manifestPath = path.join(rootDir, "manifest.json");
    const publishedNotes = selectPublishedNotes(input.manifest, input.config);
    const referencedAssets = collectReferencedAssets(publishedNotes, input.manifest.assetFiles);
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

function collectReferencedAssets(notes: NoteRecord[], availableAssets: AssetRef[]): AssetRef[] {
  const availableAssetsByPath = new Map(availableAssets.map((asset) => [normalizeRelativePath(asset.path) ?? asset.path, asset]));
  const selectedAssets: AssetRef[] = [];
  const seenPaths = new Set<string>();

  for (const note of notes) {
    for (const asset of note.assets) {
      const resolvedPath = resolveAssetTarget(note.path, asset.path);

      if (resolvedPath === undefined || seenPaths.has(resolvedPath)) {
        continue;
      }

      const matchedAsset = availableAssetsByPath.get(resolvedPath);

      if (matchedAsset === undefined) {
        continue;
      }

      seenPaths.add(resolvedPath);
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

function resolveAssetTarget(sourcePath: string, assetPath: string): string | undefined {
  const noteTarget = splitAnchor(assetPath);
  const normalizedTarget = normalizeRelativePath(noteTarget);

  if (normalizedTarget === undefined) {
    return undefined;
  }

  if (normalizedTarget.startsWith("/")) {
    return normalizeRelativePath(normalizedTarget.slice(1));
  }

  const sourceDirectory = path.posix.dirname(normalizePath(sourcePath));
  const resolvedPath =
    sourceDirectory === "." ? path.posix.normalize(normalizedTarget) : path.posix.normalize(path.posix.join(sourceDirectory, normalizedTarget));

  return normalizeRelativePath(resolvedPath);
}

function splitAnchor(target: string): string {
  const anchorIndex = target.indexOf("#");

  if (anchorIndex === -1) {
    return target;
  }

  return target.slice(0, anchorIndex);
}

function normalizeRelativePath(targetPath: string | undefined): string | undefined {
  if (targetPath === undefined) {
    return undefined;
  }

  const normalizedPath = normalizePath(targetPath).replace(/\/+$/u, "");

  if (normalizedPath === "" || normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return undefined;
  }

  return normalizedPath;
}

function normalizePath(targetPath: string): string {
  return targetPath.replace(/\\/g, "/");
}

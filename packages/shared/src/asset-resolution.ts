import path from "node:path";

import type { AssetRef, VaultSettings } from "./types.js";

export function resolveAssetCandidates(
  sourceNotePath: string,
  assetPath: string,
  vaultSettings?: VaultSettings
): string[] {
  const noteTarget = splitAnchor(assetPath);
  const directTarget = normalizeRelativePath(noteTarget);

  if (directTarget === undefined) {
    return [];
  }

  const sourceDirectory = path.posix.dirname(normalizePath(sourceNotePath));
  const candidates: string[] = [];
  const fileName = path.posix.basename(directTarget);
  const isBareFileName = directTarget === fileName;

  pushCandidate(
    candidates,
    directTarget.startsWith("/") ? normalizeRelativePath(directTarget.slice(1)) : resolveFromDirectory(sourceDirectory, directTarget)
  );

  if (isBareFileName) {
    pushCandidate(candidates, resolveAttachmentFolderTarget(sourceDirectory, fileName, vaultSettings?.attachmentFolderPath));
    pushCandidate(candidates, resolveNoteAssetFolderTarget(sourceNotePath, sourceDirectory, fileName));
  }

  return candidates;
}

export function findMatchingAsset(
  availableAssetsByPath: ReadonlyMap<string, AssetRef>,
  sourceNotePath: string,
  assetPath: string,
  vaultSettings?: VaultSettings
): AssetRef | undefined {
  for (const candidate of resolveAssetCandidates(sourceNotePath, assetPath, vaultSettings)) {
    const matchedAsset = availableAssetsByPath.get(candidate);

    if (matchedAsset !== undefined) {
      return matchedAsset;
    }
  }

  return undefined;
}

function resolveAttachmentFolderTarget(
  sourceDirectory: string,
  fileName: string,
  attachmentFolderPath: string | undefined
): string | undefined {
  if (attachmentFolderPath === undefined || attachmentFolderPath.trim() === "") {
    return undefined;
  }

  const normalizedAttachmentPath = normalizePath(attachmentFolderPath.trim());

  if (normalizedAttachmentPath === "./" || normalizedAttachmentPath === ".") {
    return resolveFromDirectory(sourceDirectory, fileName);
  }

  if (normalizedAttachmentPath.startsWith("./")) {
    return resolveFromDirectory(sourceDirectory, `${normalizedAttachmentPath.slice(2)}/${fileName}`);
  }

  if (normalizedAttachmentPath.startsWith("/")) {
    return normalizeRelativePath(`${normalizedAttachmentPath.slice(1)}/${fileName}`);
  }

  return normalizeRelativePath(`${normalizedAttachmentPath}/${fileName}`);
}

function resolveNoteAssetFolderTarget(sourceNotePath: string, sourceDirectory: string, fileName: string): string | undefined {
  const noteBaseName = path.posix.basename(normalizePath(sourceNotePath), ".md");

  return resolveFromDirectory(sourceDirectory, `${noteBaseName}.assets/${fileName}`);
}

function resolveFromDirectory(sourceDirectory: string, targetPath: string): string | undefined {
  if (sourceDirectory === ".") {
    return normalizeRelativePath(path.posix.normalize(targetPath));
  }

  return normalizeRelativePath(path.posix.normalize(path.posix.join(sourceDirectory, targetPath)));
}

function splitAnchor(target: string): string {
  const anchorIndex = target.indexOf("#");

  if (anchorIndex === -1) {
    return target;
  }

  return target.slice(0, anchorIndex);
}

function pushCandidate(candidates: string[], candidate: string | undefined): void {
  if (candidate !== undefined && !candidates.includes(candidate)) {
    candidates.push(candidate);
  }
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

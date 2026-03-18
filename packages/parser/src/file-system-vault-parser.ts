import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { AssetRef, PublisherConfig, UnsupportedObjectRecord, VaultManifest } from "@osp/shared";

import type { ScanInput, ScanResult, VaultParser } from "./contracts.js";
import { parseFrontmatterFields } from "./frontmatter.js";
import { analyzeMarkdownContent } from "./markdown-analysis.js";
import { slugify } from "./slug.js";

export class FileSystemVaultParser implements VaultParser {
  public async scanVault(input: ScanInput): Promise<ScanResult> {
    const scanState = createScanState(input.config);

    await scanDirectory(input.vaultRoot, input.vaultRoot, scanState);

    return {
      manifest: {
        generatedAt: new Date().toISOString(),
        vaultRoot: input.vaultRoot,
        notes: scanState.notes,
        assetFiles: scanState.assetFiles,
        unsupportedObjects: scanState.unsupportedObjects
      }
    };
  }
}

type ScanState = {
  notes: VaultManifest["notes"];
  assetFiles: AssetRef[];
  unsupportedObjects: UnsupportedObjectRecord[];
  ignoredRelativePrefixes: string[];
};

async function scanDirectory(
  vaultRoot: string,
  currentDirectory: string,
  scanState: ScanState
): Promise<void> {
  const directoryEntries = (await readdir(currentDirectory, {
    withFileTypes: true
  })).sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of directoryEntries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = toRelativeVaultPath(vaultRoot, absolutePath);

    if (shouldIgnorePath(relativePath, scanState.ignoredRelativePrefixes)) {
      continue;
    }

    if (entry.isDirectory()) {
      await scanDirectory(vaultRoot, absolutePath, scanState);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (isMarkdownFile(relativePath)) {
      scanState.notes.push(await createNoteRecord(absolutePath, relativePath));
      continue;
    }

    if (isUnsupportedObject(relativePath)) {
      scanState.unsupportedObjects.push(createUnsupportedObjectRecord(relativePath));
      continue;
    }

    if (isAssetFile(relativePath)) {
      scanState.assetFiles.push({
        path: relativePath,
        kind: inferAssetKind(relativePath)
      });
    }
  }
}

function createScanState(config: PublisherConfig): ScanState {
  return {
    notes: [],
    assetFiles: [],
    unsupportedObjects: [],
    ignoredRelativePrefixes: createIgnoredRelativePrefixes(config)
  };
}

async function createNoteRecord(
  absolutePath: string,
  relativePath: string
): Promise<VaultManifest["notes"][number]> {
  const markdownSource = await readFile(absolutePath, "utf8");
  const fileName = path.posix.basename(relativePath, ".md");
  const frontmatterFields = parseFrontmatterFields(markdownSource);
  const markdownAnalysis = analyzeMarkdownContent(markdownSource);

  const noteRecord: VaultManifest["notes"][number] = {
    id: relativePath,
    path: relativePath,
    title: fileName,
    slug: slugify(fileName),
    aliases: frontmatterFields.aliases,
    headings: markdownAnalysis.headings,
    blockIds: markdownAnalysis.blockIds,
    properties: frontmatterFields.properties,
    links: markdownAnalysis.links,
    embeds: markdownAnalysis.embeds,
    assets: markdownAnalysis.assets,
    publish: frontmatterFields.publish
  };

  if (frontmatterFields.frontmatterError !== undefined) {
    noteRecord.frontmatterError = frontmatterFields.frontmatterError;
  }

  if (frontmatterFields.permalink !== undefined) {
    noteRecord.permalink = frontmatterFields.permalink;
  }

  if (frontmatterFields.description !== undefined) {
    noteRecord.description = frontmatterFields.description;
  }

  return noteRecord;
}

function createUnsupportedObjectRecord(relativePath: string): UnsupportedObjectRecord {
  return {
    kind: relativePath.endsWith(".canvas") ? "canvas" : "base",
    path: relativePath
  };
}

function createIgnoredRelativePrefixes(config: PublisherConfig): string[] {
  // These folders are vault-local metadata or deleted content, not publishable material.
  const prefixes = [".git", ".obsidian", ".osp", ".trash", "node_modules"];
  const relativeOutputPath = toOptionalRelativeVaultPath(config.vaultRoot, config.outputDir);

  if (relativeOutputPath !== undefined) {
    prefixes.push(relativeOutputPath);
  }

  return prefixes.map(normalizePath);
}

function toOptionalRelativeVaultPath(vaultRoot: string, targetPath: string): string | undefined {
  const relativePath = normalizePath(path.relative(vaultRoot, targetPath));

  if (relativePath === "" || relativePath.startsWith("..")) {
    return undefined;
  }

  return relativePath;
}

function toRelativeVaultPath(vaultRoot: string, targetPath: string): string {
  return normalizePath(path.relative(vaultRoot, targetPath));
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function shouldIgnorePath(relativePath: string, ignoredPrefixes: string[]): boolean {
  return ignoredPrefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`));
}

function isMarkdownFile(relativePath: string): boolean {
  return relativePath.endsWith(".md");
}

function isUnsupportedObject(relativePath: string): boolean {
  return relativePath.endsWith(".canvas") || relativePath.endsWith(".base");
}

function isAssetFile(relativePath: string): boolean {
  return !isMarkdownFile(relativePath) && !isUnsupportedObject(relativePath);
}

function inferAssetKind(relativePath: string): AssetRef["kind"] {
  const extension = path.posix.extname(relativePath).toLowerCase();

  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif"].includes(extension)) {
    return "image";
  }

  if ([".mp3", ".wav", ".ogg", ".m4a", ".flac"].includes(extension)) {
    return "audio";
  }

  if ([".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(extension)) {
    return "video";
  }

  if (extension === ".pdf") {
    return "pdf";
  }

  return "other";
}

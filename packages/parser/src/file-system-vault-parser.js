import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatterFields } from "./frontmatter";
import { analyzeMarkdownContent } from "./markdown-analysis";
import { slugify } from "./slug";
export class FileSystemVaultParser {
    async scanVault(input) {
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
async function scanDirectory(vaultRoot, currentDirectory, scanState) {
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
function createScanState(config) {
    return {
        notes: [],
        assetFiles: [],
        unsupportedObjects: [],
        ignoredRelativePrefixes: createIgnoredRelativePrefixes(config)
    };
}
async function createNoteRecord(absolutePath, relativePath) {
    const markdownSource = await readFile(absolutePath, "utf8");
    const fileName = path.posix.basename(relativePath, ".md");
    const frontmatterFields = parseFrontmatterFields(markdownSource);
    const markdownAnalysis = analyzeMarkdownContent(markdownSource);
    const noteRecord = {
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
    if (frontmatterFields.permalink !== undefined) {
        noteRecord.permalink = frontmatterFields.permalink;
    }
    if (frontmatterFields.description !== undefined) {
        noteRecord.description = frontmatterFields.description;
    }
    return noteRecord;
}
function createUnsupportedObjectRecord(relativePath) {
    return {
        kind: relativePath.endsWith(".canvas") ? "canvas" : "base",
        path: relativePath
    };
}
function createIgnoredRelativePrefixes(config) {
    // These folders are vault-local metadata or deleted content, not publishable material.
    const prefixes = [".git", ".obsidian", ".trash", "node_modules"];
    const relativeOutputPath = toOptionalRelativeVaultPath(config.vaultRoot, config.outputDir);
    if (relativeOutputPath !== undefined) {
        prefixes.push(relativeOutputPath);
    }
    return prefixes.map(normalizePath);
}
function toOptionalRelativeVaultPath(vaultRoot, targetPath) {
    const relativePath = normalizePath(path.relative(vaultRoot, targetPath));
    if (relativePath === "" || relativePath.startsWith("..")) {
        return undefined;
    }
    return relativePath;
}
function toRelativeVaultPath(vaultRoot, targetPath) {
    return normalizePath(path.relative(vaultRoot, targetPath));
}
function normalizePath(filePath) {
    return filePath.replace(/\\/g, "/");
}
function shouldIgnorePath(relativePath, ignoredPrefixes) {
    return ignoredPrefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`));
}
function isMarkdownFile(relativePath) {
    return relativePath.endsWith(".md");
}
function isUnsupportedObject(relativePath) {
    return relativePath.endsWith(".canvas") || relativePath.endsWith(".base");
}
function isAssetFile(relativePath) {
    return !isMarkdownFile(relativePath) && !isUnsupportedObject(relativePath);
}
function inferAssetKind(relativePath) {
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
//# sourceMappingURL=file-system-vault-parser.js.map
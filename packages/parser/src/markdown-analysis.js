import { stripLeadingFrontmatter } from "./frontmatter";
import { slugify } from "./slug";
const wikilinkPattern = /(!)?\[\[([^[\]]+?)\]\]/g;
const markdownLinkPattern = /(!)?\[[^\]]*?\]\(([^)]+)\)/g;
const codeFencePattern = /^\s*(```|~~~)/;
const headingPattern = /^(#{1,6})[ \t]+(.+?)\s*$/;
const trailingHeadingMarkerPattern = /\s+#+\s*$/;
const blockIdPattern = /\^([A-Za-z0-9-]+)\s*$/;
const externalTargetPattern = /^[a-z][a-z0-9+.-]*:/i;
export function analyzeMarkdownContent(markdownSource) {
    const content = stripLeadingFrontmatter(markdownSource);
    const headings = [];
    const blockIds = [];
    const links = [];
    const embeds = [];
    const assets = [];
    const seenAssetPaths = new Set();
    let activeFenceMarker;
    for (const [index, line] of content.split(/\r?\n/).entries()) {
        const lineNumber = index + 1;
        const fenceMatch = line.match(codeFencePattern);
        if (fenceMatch !== null) {
            const fenceMarker = fenceMatch[1];
            if (activeFenceMarker === undefined) {
                activeFenceMarker = fenceMarker;
            }
            else if (activeFenceMarker === fenceMarker) {
                activeFenceMarker = undefined;
            }
            continue;
        }
        if (activeFenceMarker !== undefined) {
            continue;
        }
        const heading = extractHeading(line);
        if (heading !== undefined) {
            headings.push(heading);
        }
        const blockId = extractBlockId(line);
        if (blockId !== undefined && !blockIds.includes(blockId)) {
            blockIds.push(blockId);
        }
        collectWikilinks(line, lineNumber, links, embeds, assets, seenAssetPaths);
        collectMarkdownLinks(line, lineNumber, links, embeds, assets, seenAssetPaths);
    }
    return {
        headings,
        blockIds,
        links,
        embeds,
        assets
    };
}
function extractHeading(line) {
    const match = line.match(headingPattern);
    if (match === null) {
        return undefined;
    }
    const depthMarker = match[1];
    const rawText = match[2];
    if (depthMarker === undefined || rawText === undefined) {
        return undefined;
    }
    const depth = depthMarker.length;
    const text = rawText.replace(trailingHeadingMarkerPattern, "").trim();
    if (text === "") {
        return undefined;
    }
    return {
        text,
        slug: slugify(text),
        depth
    };
}
function extractBlockId(line) {
    const match = line.match(blockIdPattern);
    return match?.[1];
}
function collectWikilinks(line, lineNumber, links, embeds, assets, seenAssetPaths) {
    wikilinkPattern.lastIndex = 0;
    for (const match of line.matchAll(wikilinkPattern)) {
        const isEmbed = match[1] === "!";
        const matchedTarget = match[2];
        if (matchedTarget === undefined) {
            continue;
        }
        const rawTarget = matchedTarget.split("|")[0]?.trim() ?? "";
        if (rawTarget === "") {
            continue;
        }
        const normalizedTarget = normalizeInternalTarget(rawTarget);
        const location = createLocation(lineNumber, match.index ?? 0);
        if (isEmbed) {
            embeds.push({
                raw: match[0],
                target: normalizedTarget,
                kind: inferEmbedKind(normalizedTarget),
                location
            });
        }
        else {
            links.push({
                raw: match[0],
                target: normalizedTarget,
                kind: inferLinkKind(normalizedTarget, "wikilink"),
                location
            });
        }
        maybeCollectAsset(normalizedTarget, assets, seenAssetPaths);
    }
}
function collectMarkdownLinks(line, lineNumber, links, embeds, assets, seenAssetPaths) {
    markdownLinkPattern.lastIndex = 0;
    for (const match of line.matchAll(markdownLinkPattern)) {
        const isEmbed = match[1] === "!";
        const matchedTarget = match[2];
        if (matchedTarget === undefined) {
            continue;
        }
        const extractedTarget = extractMarkdownTarget(matchedTarget);
        if (extractedTarget === undefined) {
            continue;
        }
        const normalizedTarget = normalizeMarkdownTarget(extractedTarget);
        const location = createLocation(lineNumber, match.index ?? 0);
        if (isEmbed) {
            embeds.push({
                raw: match[0],
                target: normalizedTarget,
                kind: inferEmbedKind(normalizedTarget),
                location
            });
        }
        else {
            links.push({
                raw: match[0],
                target: normalizedTarget,
                kind: inferLinkKind(normalizedTarget, "markdown"),
                location
            });
        }
        maybeCollectAsset(normalizedTarget, assets, seenAssetPaths);
    }
}
function createLocation(line, zeroBasedColumn) {
    return {
        line,
        column: zeroBasedColumn + 1
    };
}
function inferLinkKind(target, defaultKind) {
    if (externalTargetPattern.test(target)) {
        return "external";
    }
    if (target.includes("#^")) {
        return "block";
    }
    if (target.includes("#")) {
        return "heading";
    }
    return defaultKind;
}
function inferEmbedKind(target) {
    return isAssetTarget(target) ? "asset" : "note";
}
function maybeCollectAsset(target, assets, seenAssetPaths) {
    if (!isAssetTarget(target)) {
        return;
    }
    const assetPath = stripAnchor(target);
    if (assetPath === "" || seenAssetPaths.has(assetPath)) {
        return;
    }
    seenAssetPaths.add(assetPath);
    assets.push({
        path: assetPath,
        kind: inferAssetKind(assetPath)
    });
}
function extractMarkdownTarget(rawTarget) {
    const trimmedTarget = rawTarget.trim();
    if (trimmedTarget === "") {
        return undefined;
    }
    if (trimmedTarget.startsWith("<")) {
        const closingIndex = trimmedTarget.indexOf(">");
        if (closingIndex > 1) {
            return trimmedTarget.slice(1, closingIndex);
        }
    }
    const whitespaceIndex = trimmedTarget.search(/\s/);
    if (whitespaceIndex === -1) {
        return trimmedTarget;
    }
    return trimmedTarget.slice(0, whitespaceIndex);
}
function normalizeMarkdownTarget(target) {
    if (externalTargetPattern.test(target)) {
        return target;
    }
    return normalizeInternalTarget(safelyDecodeTarget(target));
}
function normalizeInternalTarget(target) {
    return target.replace(/\\/g, "/");
}
function safelyDecodeTarget(target) {
    try {
        return decodeURIComponent(target);
    }
    catch {
        return target;
    }
}
function isAssetTarget(target) {
    if (externalTargetPattern.test(target)) {
        return false;
    }
    const extension = getTargetExtension(target);
    return extension !== "" && extension !== ".md";
}
function inferAssetKind(target) {
    const extension = getTargetExtension(target);
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
function getTargetExtension(target) {
    const assetPath = stripAnchor(target);
    const lastDotIndex = assetPath.lastIndexOf(".");
    const lastSlashIndex = assetPath.lastIndexOf("/");
    if (lastDotIndex === -1 || lastDotIndex < lastSlashIndex) {
        return "";
    }
    return assetPath.slice(lastDotIndex).toLowerCase();
}
function stripAnchor(target) {
    const anchorIndex = target.indexOf("#");
    if (anchorIndex === -1) {
        return target;
    }
    return target.slice(0, anchorIndex);
}
//# sourceMappingURL=markdown-analysis.js.map
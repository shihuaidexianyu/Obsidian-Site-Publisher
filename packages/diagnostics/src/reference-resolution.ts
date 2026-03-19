import path from "node:path";

import type { NoteRecord } from "@osp/shared";

const knownBareAssetExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif",
  ".mp3", ".wav", ".ogg", ".m4a", ".flac",
  ".mp4", ".webm", ".mov", ".avi", ".mkv",
  ".pdf", ".csv", ".tsv", ".json", ".txt", ".zip", ".gz", ".tar",
  ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".ipynb"
]);

export type NoteIndex = {
  byAliasOrName: Map<string, NoteRecord[]>;
  byPath: Map<string, NoteRecord>;
};

export function createNoteIndex(notes: NoteRecord[]): NoteIndex {
  const byPath = new Map<string, NoteRecord>();
  const byAliasOrName = new Map<string, NoteRecord[]>();

  for (const note of notes) {
    const normalizedPath = normalizePath(note.path);
    const normalizedPathWithoutExtension = stripMarkdownExtension(normalizedPath);
    const baseName = path.posix.basename(normalizedPathWithoutExtension);

    byPath.set(normalizedPath, note);
    addNameCandidate(byAliasOrName, normalizedPathWithoutExtension, note);
    addNameCandidate(byAliasOrName, baseName, note);
    addNameCandidate(byAliasOrName, note.title, note);

    for (const alias of note.aliases) {
      addNameCandidate(byAliasOrName, alias, note);
    }
  }

  return {
    byAliasOrName,
    byPath
  };
}

export function resolveNoteTarget(
  sourceNote: NoteRecord,
  noteTarget: string,
  noteIndex: NoteIndex
): NoteRecord | undefined {
  if (noteTarget === "") {
    return noteIndex.byPath.get(normalizePath(sourceNote.path));
  }

  const normalizedTarget = normalizeInternalNoteTarget(sourceNote.path, noteTarget);
  const directPathMatch = noteIndex.byPath.get(normalizedTarget);

  if (directPathMatch !== undefined) {
    return directPathMatch;
  }

  const withMarkdownExtensionMatch = noteIndex.byPath.get(`${normalizedTarget}.md`);

  if (withMarkdownExtensionMatch !== undefined) {
    return withMarkdownExtensionMatch;
  }

  const aliasMatches = noteIndex.byAliasOrName.get(normalizeLookupKey(noteTarget));

  return aliasMatches?.[0];
}

export function splitLinkTarget(target: string): { noteTarget: string; anchorTarget?: string } {
  const blockSeparatorIndex = target.indexOf("#^");

  if (blockSeparatorIndex !== -1) {
    return {
      noteTarget: target.slice(0, blockSeparatorIndex),
      anchorTarget: target.slice(blockSeparatorIndex + 1)
    };
  }

  const headingSeparatorIndex = target.indexOf("#");

  if (headingSeparatorIndex !== -1) {
    return {
      noteTarget: target.slice(0, headingSeparatorIndex),
      anchorTarget: target.slice(headingSeparatorIndex + 1)
    };
  }

  return { noteTarget: target };
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function stripMarkdownExtension(target: string): string {
  return target.endsWith(".md") ? target.slice(0, -3) : target;
}

export function normalizeInternalNoteTarget(sourcePath: string, target: string): string {
  const normalizedTarget = normalizePath(target);

  if (normalizedTarget.startsWith("/")) {
    return normalizedTarget.slice(1);
  }

  const sourceDirectory = path.posix.dirname(normalizePath(sourcePath));

  if (sourceDirectory === ".") {
    return path.posix.normalize(normalizedTarget);
  }

  return path.posix.normalize(path.posix.join(sourceDirectory, normalizedTarget));
}

export function resolveAssetTarget(sourcePath: string, assetPath: string): string {
  return normalizeInternalNoteTarget(sourcePath, splitLinkTarget(assetPath).noteTarget);
}

export function isAssetTarget(target: string): boolean {
  const noteTarget = splitLinkTarget(target).noteTarget;
  const extension = path.posix.extname(noteTarget).toLowerCase();

  if (extension === "" || extension === ".md") {
    return false;
  }

  return knownBareAssetExtensions.has(extension);
}

export function slugifyAnchor(anchor: string): string {
  const normalized = anchor
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized === "" ? "note" : normalized;
}

function addNameCandidate(index: Map<string, NoteRecord[]>, candidate: string, note: NoteRecord): void {
  const key = normalizeLookupKey(candidate);
  const existing = index.get(key);

  if (existing === undefined) {
    index.set(key, [note]);
    return;
  }

  if (!existing.some((entry) => entry.path === note.path)) {
    existing.push(note);
  }
}

function normalizeLookupKey(value: string): string {
  return normalizePath(value).toLowerCase();
}

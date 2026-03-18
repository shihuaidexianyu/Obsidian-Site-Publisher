import path from "node:path";

import type { BuildIssue, LinkRef, NoteRecord, VaultManifest } from "@osp/shared";

export function analyzeBrokenLinks(manifest: VaultManifest): BuildIssue[] {
  const noteIndex = createNoteIndex(manifest.notes);
  const issues: BuildIssue[] = [];

  for (const note of manifest.notes) {
    for (const link of note.links) {
      if (link.kind === "external" || isAssetTarget(link.target)) {
        continue;
      }

      const resolution = resolveLinkTarget(note, link, noteIndex);

      if (resolution.success) {
        continue;
      }

      const issue: BuildIssue = {
        code: "BROKEN_LINK",
        severity: "error",
        file: note.path,
        message: resolution.message,
        suggestion: resolution.suggestion
      };

      if (link.location !== undefined) {
        issue.location = link.location;
      }

      issues.push(issue);
    }
  }

  return issues;
}

type NoteIndex = {
  byAliasOrName: Map<string, NoteRecord[]>;
  byPath: Map<string, NoteRecord>;
};

type LinkResolution =
  | { success: true }
  | { success: false; message: string; suggestion: string };

function createNoteIndex(notes: NoteRecord[]): NoteIndex {
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

function resolveLinkTarget(sourceNote: NoteRecord, link: LinkRef, noteIndex: NoteIndex): LinkResolution {
  const { noteTarget, anchorTarget } = splitLinkTarget(link.target);
  const resolvedNote = resolveNoteTarget(sourceNote, noteTarget, noteIndex);

  if (resolvedNote === undefined) {
    return {
      success: false,
      message: `Link target "${link.target}" could not be resolved from ${sourceNote.path}.`,
      suggestion: "Rename the target note, fix the link text, or create the missing note."
    };
  }

  if (anchorTarget === undefined) {
    return { success: true };
  }

  if (anchorTarget.startsWith("^")) {
    if (resolvedNote.blockIds.includes(anchorTarget.slice(1))) {
      return { success: true };
    }

    return {
      success: false,
      message: `Block reference "${link.target}" does not exist in ${resolvedNote.path}.`,
      suggestion: "Update the block id or remove the stale block reference."
    };
  }

  const normalizedAnchor = slugifyAnchor(anchorTarget);

  if (resolvedNote.headings.some((heading) => heading.slug === normalizedAnchor)) {
    return { success: true };
  }

  return {
    success: false,
    message: `Heading reference "${link.target}" does not exist in ${resolvedNote.path}.`,
    suggestion: "Update the heading link to an existing section title."
  };
}

function resolveNoteTarget(
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

  const withoutExtensionMatch = noteIndex.byPath.get(`${normalizedTarget}.md`);

  if (withoutExtensionMatch !== undefined) {
    return withoutExtensionMatch;
  }

  const aliasMatches = noteIndex.byAliasOrName.get(normalizeLookupKey(noteTarget));

  return aliasMatches?.[0];
}

function normalizeInternalNoteTarget(sourcePath: string, target: string): string {
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

function splitLinkTarget(target: string): { noteTarget: string; anchorTarget?: string } {
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

function normalizeLookupKey(value: string): string {
  return normalizePath(value).toLowerCase();
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function stripMarkdownExtension(target: string): string {
  return target.endsWith(".md") ? target.slice(0, -3) : target;
}

function isAssetTarget(target: string): boolean {
  const noteTarget = splitLinkTarget(target).noteTarget;
  const extension = path.posix.extname(noteTarget).toLowerCase();

  return extension !== "" && extension !== ".md";
}

function slugifyAnchor(anchor: string): string {
  const normalized = anchor
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized === "" ? "note" : normalized;
}

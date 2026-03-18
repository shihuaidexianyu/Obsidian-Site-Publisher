import type { BuildIssue, NoteRecord, VaultManifest } from "@osp/shared";

import { createNoteIndex, normalizePath, resolveNoteTarget, splitLinkTarget } from "./reference-resolution";

export function analyzeCircularEmbeds(manifest: VaultManifest, publishedNotePaths?: ReadonlySet<string>): BuildIssue[] {
  const noteIndex = createNoteIndex(manifest.notes);
  const activeNotes = filterNotes(manifest.notes, publishedNotePaths);
  const adjacency = createEmbedAdjacency(activeNotes, noteIndex, publishedNotePaths);
  const visited = new Set<string>();
  const activeStack: string[] = [];
  const activeSet = new Set<string>();
  const cycleKeys = new Set<string>();
  const issues: BuildIssue[] = [];

  for (const note of activeNotes) {
    if (!visited.has(note.path)) {
      walk(note.path, adjacency, visited, activeStack, activeSet, cycleKeys, issues);
    }
  }

  return issues;
}

function createEmbedAdjacency(
  notes: NoteRecord[],
  noteIndex: ReturnType<typeof createNoteIndex>,
  publishedNotePaths?: ReadonlySet<string>
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const note of notes) {
    const targets = note.embeds
      .filter((embed) => embed.kind === "note")
      .map((embed) => resolveNoteTarget(note, splitLinkTarget(embed.target).noteTarget, noteIndex)?.path)
      .filter((targetPath): targetPath is string => targetPath !== undefined)
      .filter((targetPath) => publishedNotePaths === undefined || publishedNotePaths.has(normalizePath(targetPath)));

    adjacency.set(note.path, [...new Set(targets)]);
  }

  return adjacency;
}

function walk(
  notePath: string,
  adjacency: Map<string, string[]>,
  visited: Set<string>,
  activeStack: string[],
  activeSet: Set<string>,
  cycleKeys: Set<string>,
  issues: BuildIssue[]
): void {
  visited.add(notePath);
  activeStack.push(notePath);
  activeSet.add(notePath);

  for (const targetPath of adjacency.get(notePath) ?? []) {
    if (!visited.has(targetPath)) {
      walk(targetPath, adjacency, visited, activeStack, activeSet, cycleKeys, issues);
      continue;
    }

    if (!activeSet.has(targetPath)) {
      continue;
    }

    const cycleStartIndex = activeStack.indexOf(targetPath);
    const cyclePath = [...activeStack.slice(cycleStartIndex), targetPath];
    const cycleKey = createCycleKey(cyclePath);

    if (cycleKeys.has(cycleKey)) {
      continue;
    }

    cycleKeys.add(cycleKey);
    issues.push({
      code: "CIRCULAR_EMBED",
      severity: "error",
      file: targetPath,
      message: `Circular embed detected: ${cyclePath.join(" -> ")}.`,
      suggestion: "Break the embed loop by removing or replacing one of the note embeds."
    });
  }

  activeSet.delete(notePath);
  activeStack.pop();
}

function createCycleKey(cyclePath: string[]): string {
  const uniqueNodes = [...new Set(cyclePath.slice(0, -1))].sort();

  return uniqueNodes.join("|");
}

function filterNotes(notes: NoteRecord[], publishedNotePaths?: ReadonlySet<string>): NoteRecord[] {
  if (publishedNotePaths === undefined) {
    return notes;
  }

  return notes.filter((note) => publishedNotePaths.has(normalizePath(note.path)));
}

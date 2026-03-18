import type { BuildIssue, LinkRef, NoteRecord, VaultManifest } from "@osp/shared";

import { createNoteIndex, isAssetTarget, resolveNoteTarget, splitLinkTarget } from "./reference-resolution";

export function analyzeUnpublishedReferences(manifest: VaultManifest): BuildIssue[] {
  const noteIndex = createNoteIndex(manifest.notes);
  const issues: BuildIssue[] = [];

  for (const note of manifest.notes) {
    if (!note.publish) {
      continue;
    }

    for (const link of note.links) {
      if (shouldIgnoreLink(link)) {
        continue;
      }

      const targetNote = resolveLinkedNote(note, link.target, noteIndex);

      if (targetNote === undefined || targetNote.publish) {
        continue;
      }

      issues.push(createIssue(note.path, targetNote.path, link.target, link.location));
    }

    for (const embed of note.embeds) {
      if (embed.kind !== "note") {
        continue;
      }

      const targetNote = resolveLinkedNote(note, embed.target, noteIndex);

      if (targetNote === undefined || targetNote.publish) {
        continue;
      }

      issues.push(createIssue(note.path, targetNote.path, embed.target, embed.location));
    }
  }

  return issues;
}

function shouldIgnoreLink(link: LinkRef): boolean {
  return link.kind === "external" || isAssetTarget(link.target);
}

function resolveLinkedNote(
  sourceNote: NoteRecord,
  target: string,
  noteIndex: ReturnType<typeof createNoteIndex>
): NoteRecord | undefined {
  return resolveNoteTarget(sourceNote, splitLinkTarget(target).noteTarget, noteIndex);
}

function createIssue(
  sourcePath: string,
  targetPath: string,
  target: string,
  location?: BuildIssue["location"]
): BuildIssue {
  const issue: BuildIssue = {
    code: "UNPUBLISHED_REFERENCE",
    severity: "warning",
    file: sourcePath,
    message: `Published note ${sourcePath} references unpublished note "${targetPath}" via "${target}".`,
    suggestion: "Publish the target note as well, or remove the private reference from public content."
  };

  if (location !== undefined) {
    issue.location = location;
  }

  return issue;
}

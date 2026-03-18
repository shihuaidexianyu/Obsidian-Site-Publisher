import type { BuildIssue, LinkRef, NoteRecord, VaultManifest } from "@osp/shared";

import type { NoteIndex } from "./reference-resolution";
import { createNoteIndex, isAssetTarget, resolveNoteTarget, slugifyAnchor, splitLinkTarget } from "./reference-resolution";

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

type LinkResolution =
  | { success: true }
  | { success: false; message: string; suggestion: string };

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

import { createPublishedNotePathSet, selectPublishedNotes } from "@osp/shared";
import type { BuildIssue, PublisherConfig, UnsupportedObjectRecord, VaultManifest } from "@osp/shared";

import type { DiagnosticsEngine } from "./contracts";
import { analyzeBrokenLinks } from "./broken-link-analysis";
import { analyzeCircularEmbeds } from "./circular-embed-analysis";
import { analyzeInvalidFrontmatter } from "./invalid-frontmatter-analysis";
import { analyzeMissingAssets } from "./missing-asset-analysis";
import { analyzeUnpublishedReferences } from "./unpublished-reference-analysis";

export class DefaultDiagnosticsEngine implements DiagnosticsEngine {
  public analyze(manifest: VaultManifest, config: PublisherConfig): BuildIssue[] {
    const publishedNotePaths = createPublishedNotePathSet(manifest, config);
    const publishedNotes = selectPublishedNotes(manifest, config);

    return [
      ...analyzeBrokenLinks(manifest, publishedNotePaths),
      ...analyzeInvalidFrontmatter(manifest),
      ...analyzeMissingAssets(manifest, publishedNotePaths),
      ...analyzeUnpublishedReferences(manifest, publishedNotePaths),
      ...analyzeDuplicateSlugs(publishedNotes),
      ...analyzeDuplicatePermalinks(publishedNotes),
      ...analyzeCircularEmbeds(manifest, publishedNotePaths),
      ...analyzeUnsupportedObjects(manifest.unsupportedObjects)
    ];
  }
}

export function analyzeDuplicateSlugs(notes: VaultManifest["notes"]): BuildIssue[] {
  const seen = new Map<string, string>();
  const issues: BuildIssue[] = [];

  for (const note of notes) {
    const previousPath = seen.get(note.slug);

    if (previousPath !== undefined) {
      issues.push({
        code: "DUPLICATE_SLUG",
        severity: "error",
        file: note.path,
        message: `Slug "${note.slug}" is already used by ${previousPath}.`,
        suggestion: "Add a custom permalink or rename one of the notes."
      });
      continue;
    }

    seen.set(note.slug, note.path);
  }

  return issues;
}

export function analyzeDuplicatePermalinks(notes: VaultManifest["notes"]): BuildIssue[] {
  const seen = new Map<string, string>();
  const issues: BuildIssue[] = [];

  for (const note of notes) {
    if (note.permalink === undefined) {
      continue;
    }

    const previousPath = seen.get(note.permalink);

    if (previousPath !== undefined) {
      issues.push({
        code: "DUPLICATE_PERMALINK",
        severity: "error",
        file: note.path,
        message: `Permalink "${note.permalink}" is already used by ${previousPath}.`,
        suggestion: "Keep permalinks unique across published notes."
      });
      continue;
    }

    seen.set(note.permalink, note.path);
  }

  return issues;
}

function analyzeUnsupportedObjects(objects: UnsupportedObjectRecord[]): BuildIssue[] {
  return objects.map((object) => ({
    code: object.kind === "canvas" ? "UNSUPPORTED_CANVAS" : "UNSUPPORTED_BASE",
    severity: "info",
    file: object.path,
    message: `Detected official ${object.kind} file "${object.path}", but v1 only reports it and does not render it.`,
    suggestion: "Keep a link to the source file or exclude it from the public slice."
  }));
}

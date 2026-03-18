import type { BuildIssue, VaultManifest } from "@osp/shared";

export function analyzeInvalidFrontmatter(manifest: VaultManifest): BuildIssue[] {
  return manifest.notes.flatMap((note) => {
    if (note.frontmatterError === undefined) {
      return [];
    }

    return [
      {
        code: "INVALID_FRONTMATTER",
        severity: "error",
        file: note.path,
        message: `Frontmatter in ${note.path} is invalid: ${note.frontmatterError}`,
        suggestion: "Fix the YAML frontmatter syntax so publish metadata can be parsed."
      }
    ];
  });
}

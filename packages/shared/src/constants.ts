export const issueCodes = [
  "BROKEN_LINK",
  "MISSING_ASSET",
  "UNSUPPORTED_CANVAS",
  "UNSUPPORTED_BASE",
  "DUPLICATE_SLUG",
  "DUPLICATE_PERMALINK",
  "CIRCULAR_EMBED",
  "INVALID_FRONTMATTER",
  "UNPUBLISHED_REFERENCE"
] as const;

export const unsupportedObjectKinds = ["canvas", "base"] as const;

export const builderKinds = ["quartz"] as const;

export const deployTargets = ["none", "local-export", "git-branch", "github-pages"] as const;

export const publishModes = ["folder", "frontmatter"] as const;

export const severities = ["info", "warning", "error"] as const;

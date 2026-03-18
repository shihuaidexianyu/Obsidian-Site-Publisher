import type { NoteRecord, PublisherConfig, VaultManifest } from "./types";

export function selectPublishedNotes(manifest: VaultManifest, config: PublisherConfig): NoteRecord[] {
  return manifest.notes.filter((note) => isNotePublished(note, config));
}

export function createPublishedNotePathSet(manifest: VaultManifest, config: PublisherConfig): Set<string> {
  return new Set(selectPublishedNotes(manifest, config).map((note) => normalizeVaultPath(note.path)));
}

export function isNotePublished(note: NoteRecord, config: PublisherConfig): boolean {
  const normalizedPath = normalizeVaultPath(note.path);

  if (!matchesPublishMode(note, config.publishMode)) {
    return false;
  }

  if (!matchesPublishRoot(normalizedPath, config.publishRoot)) {
    return false;
  }

  if (!matchesIncludeGlobs(normalizedPath, config.includeGlobs)) {
    return false;
  }

  return !matchesAnyGlob(normalizedPath, config.excludeGlobs);
}

export function normalizeVaultPath(targetPath: string): string {
  const normalizedPath = targetPath.replace(/\\/g, "/").replace(/^\.\//u, "").replace(/\/+$/u, "");

  return normalizedPath === "" ? "." : normalizedPath;
}

function matchesPublishMode(note: NoteRecord, publishMode: PublisherConfig["publishMode"]): boolean {
  if (publishMode === "folder") {
    return true;
  }

  return note.publish;
}

function matchesPublishRoot(notePath: string, publishRoot: string | undefined): boolean {
  const normalizedRoot = normalizeOptionalRoot(publishRoot);

  if (normalizedRoot === undefined) {
    return true;
  }

  return notePath === normalizedRoot || notePath.startsWith(`${normalizedRoot}/`);
}

function matchesIncludeGlobs(notePath: string, includeGlobs: string[]): boolean {
  if (includeGlobs.length === 0) {
    return true;
  }

  return matchesAnyGlob(notePath, includeGlobs);
}

function matchesAnyGlob(notePath: string, globs: string[]): boolean {
  return globs.some((glob) => matchesGlob(notePath, glob));
}

function matchesGlob(notePath: string, glob: string): boolean {
  const normalizedGlob = normalizeVaultPath(glob);

  if (normalizedGlob === ".") {
    return notePath === ".";
  }

  return createGlobPattern(normalizedGlob).test(notePath);
}

function createGlobPattern(glob: string): RegExp {
  let pattern = "^";
  let index = 0;

  while (index < glob.length) {
    const currentCharacter = glob[index];
    const nextCharacter = glob[index + 1];
    const thirdCharacter = glob[index + 2];

    if (currentCharacter === undefined) {
      break;
    }

    if (currentCharacter === "*" && nextCharacter === "*" && thirdCharacter === "/") {
      pattern += "(?:[^/]+/)*";
      index += 3;
      continue;
    }

    if (currentCharacter === "*" && nextCharacter === "*") {
      pattern += ".*";
      index += 2;
      continue;
    }

    if (currentCharacter === "*") {
      pattern += "[^/]*";
      index += 1;
      continue;
    }

    if (currentCharacter === "?") {
      pattern += "[^/]";
      index += 1;
      continue;
    }

    pattern += escapeForRegularExpression(currentCharacter);
    index += 1;
  }

  return new RegExp(`${pattern}$`, "u");
}

function escapeForRegularExpression(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function normalizeOptionalRoot(publishRoot: string | undefined): string | undefined {
  if (publishRoot === undefined) {
    return undefined;
  }

  const normalizedRoot = normalizeVaultPath(publishRoot);

  if (normalizedRoot === "." || normalizedRoot === ".." || normalizedRoot.startsWith("../")) {
    return undefined;
  }

  return normalizedRoot;
}

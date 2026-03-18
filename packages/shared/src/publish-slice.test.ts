import path from "node:path";

import type { PublisherConfig, VaultManifest } from "./types";
import { createPublishedNotePathSet, normalizeVaultPath, selectPublishedNotes } from "./publish-slice";

import { describe, expect, it } from "vitest";

describe("publish-slice", () => {
  it("selects only frontmatter-published notes in frontmatter mode", () => {
    const manifest = createManifest([
      createNote("Public.md", { publish: true }),
      createNote("Draft.md", { publish: false })
    ]);

    expect(selectPublishedNotes(manifest, createConfig()).map((note) => note.path)).toEqual(["Public.md"]);
  });

  it("selects notes by folder root in folder mode", () => {
    const manifest = createManifest([
      createNote("Public/Guide.md"),
      createNote("Private/Draft.md")
    ]);

    expect(
      selectPublishedNotes(
        manifest,
        createConfig({
          publishMode: "folder",
          publishRoot: "Public"
        })
      ).map((note) => note.path)
    ).toEqual(["Public/Guide.md"]);
  });

  it("applies publishRoot even in frontmatter mode", () => {
    const manifest = createManifest([
      createNote("Public/Guide.md", { publish: true }),
      createNote("Private/Guide.md", { publish: true })
    ]);

    expect(
      selectPublishedNotes(
        manifest,
        createConfig({
          publishRoot: "Public"
        })
      ).map((note) => note.path)
    ).toEqual(["Public/Guide.md"]);
  });

  it("applies include and exclude globs to the selected slice", () => {
    const manifest = createManifest([
      createNote("Public/Guide.md"),
      createNote("Public/Drafts/Wip.md"),
      createNote("Public/Notes/Keep.md"),
      createNote("Private/Skip.md")
    ]);

    expect(
      selectPublishedNotes(
        manifest,
        createConfig({
          publishMode: "folder",
          includeGlobs: ["Public/**/*.md"],
          excludeGlobs: ["**/Drafts/**", "**/Skip.md"]
        })
      ).map((note) => note.path)
    ).toEqual(["Public/Guide.md", "Public/Notes/Keep.md"]);
  });

  it("builds a normalized published note path set", () => {
    const manifest = createManifest([
      createNote("Public\\Guide.md"),
      createNote("Draft.md")
    ]);

    expect(
      createPublishedNotePathSet(
        manifest,
        createConfig({
          publishMode: "folder",
          includeGlobs: ["Public/**"]
        })
      )
    ).toEqual(new Set(["Public/Guide.md"]));
    expect(normalizeVaultPath("./Public\\Guide.md")).toBe("Public/Guide.md");
  });
});

function createConfig(overrides: Partial<PublisherConfig> = {}): PublisherConfig {
  return {
    vaultRoot: path.resolve("fixtures"),
    publishMode: "frontmatter",
    includeGlobs: [],
    excludeGlobs: [],
    outputDir: path.resolve(".osp/dist"),
    builder: "quartz",
    deployTarget: "none",
    enableSearch: true,
    enableBacklinks: true,
    enableGraph: true,
    strictMode: false,
    ...overrides
  };
}

function createManifest(notes: VaultManifest["notes"]): VaultManifest {
  return {
    generatedAt: "2026-03-18T00:00:00.000Z",
    vaultRoot: path.resolve("fixtures"),
    notes,
    assetFiles: [],
    unsupportedObjects: []
  };
}

function createNote(
  notePath: string,
  overrides: Partial<VaultManifest["notes"][number]> = {}
): VaultManifest["notes"][number] {
  return {
    id: notePath,
    path: notePath,
    title: path.posix.basename(notePath.replace(/\\/g, "/"), ".md"),
    slug: path.posix.basename(notePath.replace(/\\/g, "/"), ".md").toLowerCase(),
    aliases: [],
    headings: [],
    blockIds: [],
    properties: {},
    links: [],
    embeds: [],
    assets: [],
    publish: false,
    ...overrides
  };
}

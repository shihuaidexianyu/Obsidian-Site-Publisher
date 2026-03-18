import { describe, expect, it } from "vitest";

import type { NoteRecord, VaultManifest } from "@osp/shared";

import { analyzeBrokenLinks } from "./broken-link-analysis";

describe("analyzeBrokenLinks", () => {
  it("reports missing note, heading, and block targets while ignoring valid and external links", () => {
    const manifest: VaultManifest = {
      generatedAt: new Date().toISOString(),
      vaultRoot: "/vault",
      notes: [
        createNote({
          path: "Broken.md",
          links: [
            createLink("[[Missing Note]]", "Missing Note", "wikilink", 3),
            createLink("[[Source#Missing Heading]]", "Source#Missing Heading", "heading", 4),
            createLink("[[Source#^missing-block]]", "Source#^missing-block", "block", 5),
            createLink("[Section](#present-heading)", "#present-heading", "heading", 6),
            createLink("[External](https://example.com)", "https://example.com", "external", 7)
          ],
          headings: [{ text: "Present Heading", slug: "present-heading", depth: 1 }]
        }),
        createNote({
          path: "Source.md",
          headings: [{ text: "Existing Heading", slug: "existing-heading", depth: 1 }],
          blockIds: ["existing-block"]
        }),
        createNote({
          path: "Target.md",
          aliases: ["Second Note"],
          links: [
            createLink("[Markdown Link](./Source.md)", "./Source.md", "markdown", 4),
            createLink("[Alias Link](Second Note)", "Second Note", "markdown", 5),
            createLink("[Existing Heading](Source#Existing Heading)", "Source#Existing Heading", "heading", 6),
            createLink("[Existing Block](Source#^existing-block)", "Source#^existing-block", "block", 7),
            createLink("[PDF](guide.pdf)", "guide.pdf", "markdown", 8)
          ]
        })
      ],
      assetFiles: [],
      unsupportedObjects: []
    };

    const issues = analyzeBrokenLinks(manifest);

    expect(issues).toHaveLength(3);
    expect(issues.map((issue) => issue.code)).toEqual([
      "BROKEN_LINK",
      "BROKEN_LINK",
      "BROKEN_LINK"
    ]);
    expect(issues.map((issue) => issue.location?.line)).toEqual([3, 4, 5]);
    expect(issues[0]?.message).toContain('Link target "Missing Note" could not be resolved');
    expect(issues[1]?.message).toContain('Heading reference "Source#Missing Heading"');
    expect(issues[2]?.message).toContain('Block reference "Source#^missing-block"');
  });
});

function createNote(overrides: Partial<NoteRecord> & Pick<NoteRecord, "path">): NoteRecord {
  const title = pathToTitle(overrides.path);

  const note: NoteRecord = {
    id: overrides.path,
    path: overrides.path,
    title,
    slug: title.toLowerCase(),
    aliases: overrides.aliases ?? [],
    headings: overrides.headings ?? [],
    blockIds: overrides.blockIds ?? [],
    properties: overrides.properties ?? {},
    links: overrides.links ?? [],
    embeds: overrides.embeds ?? [],
    assets: overrides.assets ?? [],
    publish: overrides.publish ?? true
  };

  if (overrides.permalink !== undefined) {
    note.permalink = overrides.permalink;
  }

  if (overrides.description !== undefined) {
    note.description = overrides.description;
  }

  return note;
}

function createLink(
  raw: string,
  target: string,
  kind: "wikilink" | "markdown" | "heading" | "block" | "external",
  line: number
) {
  return {
    raw,
    target,
    kind,
    location: {
      line,
      column: 1
    }
  } as const;
}

function pathToTitle(notePath: string): string {
  const fileName = notePath.split("/").at(-1) ?? notePath;

  return fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName;
}

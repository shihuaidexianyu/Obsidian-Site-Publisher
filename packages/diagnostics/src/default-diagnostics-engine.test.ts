import { describe, expect, it } from "vitest";

import type { PublisherConfig, VaultManifest } from "@osp/shared";

import { DefaultDiagnosticsEngine } from "./default-diagnostics-engine";

const config: PublisherConfig = {
  vaultRoot: "/vault",
  publishMode: "frontmatter",
  includeGlobs: [],
  excludeGlobs: [],
  outputDir: "/vault/.osp/dist",
  builder: "quartz",
  deployTarget: "none",
  enableSearch: true,
  enableBacklinks: true,
  enableGraph: true,
  strictMode: false
};

describe("DefaultDiagnosticsEngine", () => {
  it("reports broken links, invalid frontmatter, missing assets, duplicate slugs, circular embeds, and unsupported objects", () => {
    const manifest: VaultManifest = {
      generatedAt: new Date().toISOString(),
      vaultRoot: "/vault",
      notes: [
        {
          id: "1",
          path: "Notes/A.md",
          title: "A",
          slug: "shared-slug",
          aliases: [],
          headings: [],
          blockIds: [],
          properties: {},
          links: [
            {
              raw: "[[Missing]]",
              target: "Missing",
              kind: "wikilink",
              location: {
                line: 3,
                column: 1
              }
            }
          ],
          embeds: [
            {
              raw: "![[C]]",
              target: "C",
              kind: "note"
            }
          ],
          assets: [
            {
              path: "missing.png",
              kind: "image"
            }
          ],
          publish: true,
          frontmatterError: "Frontmatter could not be parsed as YAML."
        },
        {
          id: "2",
          path: "Notes/B.md",
          title: "B",
          slug: "shared-slug",
          aliases: [],
          headings: [],
          blockIds: [],
          properties: {},
          links: [],
          embeds: [
            {
              raw: "![[A]]",
              target: "A",
              kind: "note"
            }
          ],
          assets: [],
          publish: true
        },
        {
          id: "3",
          path: "Notes/C.md",
          title: "C",
          slug: "c",
          aliases: [],
          headings: [],
          blockIds: [],
          properties: {},
          links: [],
          embeds: [
            {
              raw: "![[B]]",
              target: "B",
              kind: "note"
            }
          ],
          assets: [],
          publish: true
        }
      ],
      assetFiles: [],
      unsupportedObjects: [
        {
          kind: "canvas",
          path: "Maps/Idea.canvas"
        }
      ]
    };

    const issues = new DefaultDiagnosticsEngine().analyze(manifest, config);

    expect(issues).toHaveLength(6);
    expect(issues.map((issue) => issue.code)).toEqual([
      "BROKEN_LINK",
      "INVALID_FRONTMATTER",
      "MISSING_ASSET",
      "DUPLICATE_SLUG",
      "CIRCULAR_EMBED",
      "UNSUPPORTED_CANVAS"
    ]);
  });

  it("uses the configured publish slice instead of raw note.publish flags", () => {
    const manifest: VaultManifest = {
      generatedAt: new Date().toISOString(),
      vaultRoot: "/vault",
      notes: [
        {
          id: "1",
          path: "Public/Home.md",
          title: "Home",
          slug: "shared-slug",
          aliases: [],
          headings: [],
          blockIds: [],
          properties: {},
          links: [
            {
              raw: "[[Missing]]",
              target: "Missing",
              kind: "wikilink"
            },
            {
              raw: "[[../Private/Secret]]",
              target: "../Private/Secret",
              kind: "wikilink"
            }
          ],
          embeds: [],
          assets: [],
          publish: false
        },
        {
          id: "2",
          path: "Private/Secret.md",
          title: "Secret",
          slug: "shared-slug",
          aliases: [],
          headings: [],
          blockIds: [],
          properties: {},
          links: [
            {
              raw: "[[Ghost]]",
              target: "Ghost",
              kind: "wikilink"
            }
          ],
          embeds: [],
          assets: [],
          publish: false
        }
      ],
      assetFiles: [],
      unsupportedObjects: []
    };

    const issues = new DefaultDiagnosticsEngine().analyze(manifest, {
      ...config,
      publishMode: "folder",
      publishRoot: "Public"
    });

    expect(issues.map((issue) => issue.code)).toEqual(["BROKEN_LINK", "UNPUBLISHED_REFERENCE"]);
    expect(issues[0]?.file).toBe("Public/Home.md");
    expect(issues[1]?.message).toContain('references unpublished note "Private/Secret.md"');
  });

  it("warns when the publish slice is empty", () => {
    const manifest: VaultManifest = {
      generatedAt: new Date().toISOString(),
      vaultRoot: "/vault",
      notes: [
        {
          id: "1",
          path: "Drafts/Only.md",
          title: "Only",
          slug: "only",
          aliases: [],
          headings: [],
          blockIds: [],
          properties: {},
          links: [],
          embeds: [],
          assets: [],
          publish: false
        }
      ],
      assetFiles: [],
      unsupportedObjects: []
    };

    const issues = new DefaultDiagnosticsEngine().analyze(manifest, config);

    expect(issues).toEqual([
      {
        code: "EMPTY_PUBLISH_SLICE",
        severity: "warning",
        file: "/vault",
        message: "No notes matched the current publish selection, so the generated site will be effectively empty.",
        suggestion: 'Switch to folder mode, adjust publishRoot/includeGlobs, or add `publish: true` to at least one note.'
      }
    ]);
  });
});

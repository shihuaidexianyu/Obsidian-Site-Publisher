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
  it("reports duplicate slugs and unsupported objects", () => {
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
          links: [],
          embeds: [],
          assets: [],
          publish: true
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
          embeds: [],
          assets: [],
          publish: true
        }
      ],
      unsupportedObjects: [
        {
          kind: "canvas",
          path: "Maps/Idea.canvas"
        }
      ]
    };

    const issues = new DefaultDiagnosticsEngine().analyze(manifest, config);

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.code)).toEqual(["DUPLICATE_SLUG", "UNSUPPORTED_CANVAS"]);
  });
});

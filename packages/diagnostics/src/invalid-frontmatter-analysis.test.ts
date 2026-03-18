import type { VaultManifest } from "@osp/shared";
import { describe, expect, it } from "vitest";

import { analyzeInvalidFrontmatter } from "./invalid-frontmatter-analysis";

describe("analyzeInvalidFrontmatter", () => {
  it("reports notes whose frontmatter could not be parsed", () => {
    const manifest: VaultManifest = {
      generatedAt: new Date().toISOString(),
      vaultRoot: "/vault",
      notes: [
        {
          id: "Invalid.md",
          path: "Invalid.md",
          title: "Invalid",
          slug: "invalid",
          aliases: [],
          headings: [],
          blockIds: [],
          properties: {},
          links: [],
          embeds: [],
          assets: [],
          publish: false,
          frontmatterError: "Frontmatter could not be parsed as YAML."
        }
      ],
      assetFiles: [],
      unsupportedObjects: []
    };

    const issues = analyzeInvalidFrontmatter(manifest);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "INVALID_FRONTMATTER",
      severity: "error",
      file: "Invalid.md"
    });
  });
});

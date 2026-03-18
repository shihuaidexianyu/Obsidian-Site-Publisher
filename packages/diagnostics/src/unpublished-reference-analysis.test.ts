import path from "node:path";

import type { PublisherConfig } from "@osp/shared";
import { FileSystemVaultParser } from "../../parser/src/file-system-vault-parser";
import { describe, expect, it } from "vitest";

import { analyzeUnpublishedReferences } from "./unpublished-reference-analysis";

describe("analyzeUnpublishedReferences", () => {
  it("reports published notes that link to unpublished notes", async () => {
    const vaultRoot = path.resolve("fixtures/vault-unpublished-ref");
    const manifest = (
      await new FileSystemVaultParser().scanVault({
        vaultRoot,
        config: createConfig(vaultRoot)
      })
    ).manifest;

    const issues = analyzeUnpublishedReferences(manifest);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "UNPUBLISHED_REFERENCE",
      severity: "warning",
      file: "Public.md"
    });
    expect(issues[0]?.message).toContain('references unpublished note "Private.md"');
  });
});

function createConfig(vaultRoot: string): PublisherConfig {
  return {
    vaultRoot,
    publishMode: "frontmatter",
    includeGlobs: [],
    excludeGlobs: [],
    outputDir: path.join(vaultRoot, ".osp", "dist"),
    builder: "quartz",
    deployTarget: "none",
    enableSearch: true,
    enableBacklinks: true,
    enableGraph: true,
    strictMode: false
  };
}

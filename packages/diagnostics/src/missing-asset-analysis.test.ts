import path from "node:path";

import type { PublisherConfig } from "@osp/shared";
import { FileSystemVaultParser } from "../../parser/src/file-system-vault-parser";
import { describe, expect, it } from "vitest";

import { analyzeMissingAssets } from "./missing-asset-analysis";

describe("analyzeMissingAssets", () => {
  it("reports note-level asset references that do not exist in the vault", async () => {
    const vaultRoot = path.resolve("fixtures/vault-broken-links");
    const manifest = (
      await new FileSystemVaultParser().scanVault({
        vaultRoot,
        config: createConfig(vaultRoot)
      })
    ).manifest;

    const issues = analyzeMissingAssets(manifest);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "MISSING_ASSET",
      severity: "error",
      file: "Broken.md"
    });
    expect(issues[0]?.message).toContain('Asset "missing.png"');
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

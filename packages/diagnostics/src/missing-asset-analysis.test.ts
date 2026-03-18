import path from "node:path";

import type { VaultManifest } from "@osp/shared";
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

  it("resolves Obsidian attachment folders before reporting missing assets", () => {
    const manifest = createManifest({
      vaultSettings: {
        attachmentFolderPath: "./assets"
      },
      notes: [
        createNote("Topic/Guide.md", {
          assets: [{ path: "diagram.png", kind: "image" }]
        })
      ],
      assetFiles: [{ path: "Topic/assets/diagram.png", kind: "image" }]
    });

    expect(analyzeMissingAssets(manifest)).toEqual([]);
  });

  it("resolves sibling .assets folders used by imported markdown", () => {
    const manifest = createManifest({
      notes: [
        createNote("Legacy/Guide.md", {
          assets: [{ path: "image.png", kind: "image" }]
        })
      ],
      assetFiles: [{ path: "Legacy/Guide.assets/image.png", kind: "image" }]
    });

    expect(analyzeMissingAssets(manifest)).toEqual([]);
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

function createManifest(overrides: Partial<VaultManifest>): VaultManifest {
  return {
    generatedAt: "2026-03-18T00:00:00.000Z",
    vaultRoot: "/vault",
    notes: [],
    assetFiles: [],
    unsupportedObjects: [],
    ...overrides
  };
}

function createNote(
  notePath: string,
  overrides: Partial<VaultManifest["notes"][number]> = {}
): VaultManifest["notes"][number] {
  return {
    id: notePath,
    path: notePath,
    title: path.posix.basename(notePath, ".md"),
    slug: path.posix.basename(notePath, ".md").toLowerCase(),
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

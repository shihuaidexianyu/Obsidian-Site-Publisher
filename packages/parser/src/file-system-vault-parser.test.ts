import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { VaultManifestSchema } from "@osp/shared";
import type { PublisherConfig } from "@osp/shared";
import { afterEach, describe, expect, it } from "vitest";

import { FileSystemVaultParser } from "./file-system-vault-parser";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
});

describe("FileSystemVaultParser", () => {
  it("scans markdown, asset, and unsupported files from fixtures", async () => {
    const parser = new FileSystemVaultParser();
    const propertiesVaultRoot = path.resolve("fixtures/vault-properties");
    const canvasVaultRoot = path.resolve("fixtures/vault-canvas-base");

    const propertiesResult = await parser.scanVault({
      vaultRoot: propertiesVaultRoot,
      config: createConfig(propertiesVaultRoot)
    });
    const canvasResult = await parser.scanVault({
      vaultRoot: canvasVaultRoot,
      config: createConfig(canvasVaultRoot)
    });

    expect(VaultManifestSchema.parse(propertiesResult.manifest)).toBeTruthy();
    expect(propertiesResult.manifest.notes.map((note) => note.path)).toEqual(["Publishable.md"]);
    expect(propertiesResult.manifest.notes[0]).toMatchObject({
      path: "Publishable.md",
      publish: true,
      permalink: "/publishable/",
      description: "Properties fixture",
      aliases: ["Published Fixture", "Alias Example"],
      properties: {
        publish: true,
        permalink: "/publishable/",
        description: "Properties fixture",
        aliases: ["Published Fixture", "Alias Example"],
        image: "./cover.png"
      }
    });
    expect(propertiesResult.manifest.assetFiles).toEqual([
      {
        path: "cover.png",
        kind: "image"
      }
    ]);
    expect(canvasResult.manifest.unsupportedObjects).toEqual([
      {
        kind: "base",
        path: "Database.base"
      },
      {
        kind: "canvas",
        path: "Map.canvas"
      }
    ]);
  });

  it("extracts headings, block ids, links, embeds, and note assets from fixtures", async () => {
    const parser = new FileSystemVaultParser();
    const linksVaultRoot = path.resolve("fixtures/vault-links");
    const headingVaultRoot = path.resolve("fixtures/vault-heading-block-links");
    const embedsVaultRoot = path.resolve("fixtures/vault-embeds");

    const linksResult = await parser.scanVault({
      vaultRoot: linksVaultRoot,
      config: createConfig(linksVaultRoot)
    });
    const headingResult = await parser.scanVault({
      vaultRoot: headingVaultRoot,
      config: createConfig(headingVaultRoot)
    });
    const embedsResult = await parser.scanVault({
      vaultRoot: embedsVaultRoot,
      config: createConfig(embedsVaultRoot)
    });

    expect(linksResult.manifest.notes.find((note) => note.path === "Home.md")).toMatchObject({
      links: [
        {
          kind: "wikilink",
          target: "Second Note"
        },
        {
          kind: "markdown",
          target: "Second Note.md"
        }
      ]
    });
    expect(headingResult.manifest.notes.find((note) => note.path === "Source.md")).toMatchObject({
      headings: [
        {
          text: "Source Heading",
          slug: "source-heading",
          depth: 1
        }
      ],
      blockIds: ["source-block"]
    });
    expect(headingResult.manifest.notes.find((note) => note.path === "Target.md")).toMatchObject({
      links: [
        {
          kind: "heading",
          target: "Source#Source Heading"
        },
        {
          kind: "block",
          target: "Source#^source-block"
        }
      ]
    });
    expect(embedsResult.manifest.notes.find((note) => note.path === "Host.md")).toMatchObject({
      embeds: [
        {
          kind: "note",
          target: "Embedded"
        },
        {
          kind: "asset",
          target: "diagram.png"
        }
      ],
      assets: [
        {
          path: "diagram.png",
          kind: "image"
        }
      ]
    });
  });

  it("ignores .git, .obsidian, .osp, .trash, node_modules, and outputDir content", async () => {
    const vaultRoot = await createTempVault();

    await mkdir(path.join(vaultRoot, ".git"), { recursive: true });
    await mkdir(path.join(vaultRoot, ".obsidian"), { recursive: true });
    await mkdir(path.join(vaultRoot, ".osp", "build", "content"), { recursive: true });
    await mkdir(path.join(vaultRoot, ".trash"), { recursive: true });
    await mkdir(path.join(vaultRoot, "node_modules", "pkg"), { recursive: true });
    await mkdir(path.join(vaultRoot, ".osp", "dist"), { recursive: true });
    await mkdir(path.join(vaultRoot, "assets"), { recursive: true });
    await writeFile(path.join(vaultRoot, "Visible.md"), "# Visible", "utf8");
    await writeFile(path.join(vaultRoot, ".git", "HEAD"), "ref: refs/heads/main", "utf8");
    await writeFile(path.join(vaultRoot, ".obsidian", "Hidden.md"), "# Hidden", "utf8");
    await writeFile(path.join(vaultRoot, ".osp", "build", "content", "Stale.md"), "# Stale", "utf8");
    await writeFile(path.join(vaultRoot, ".trash", "Deleted.md"), "# Deleted", "utf8");
    await writeFile(path.join(vaultRoot, "node_modules", "pkg", "Ignored.md"), "# Ignored", "utf8");
    await writeFile(path.join(vaultRoot, ".osp", "dist", "Generated.md"), "# Generated", "utf8");
    await writeFile(path.join(vaultRoot, "assets", "logo.png"), "not-a-real-png", "utf8");

    const result = await new FileSystemVaultParser().scanVault({
      vaultRoot,
      config: createConfig(vaultRoot)
    });

    expect(result.manifest.notes.map((note) => note.path)).toEqual(["Visible.md"]);
    expect(result.manifest.assetFiles).toEqual([
      {
        path: "assets/logo.png",
        kind: "image"
      }
    ]);
    expect(result.manifest.unsupportedObjects).toEqual([]);
  });

  it("only treats a leading yaml block as frontmatter", async () => {
    const vaultRoot = await createTempVault();

    await writeFile(
      path.join(vaultRoot, "BodyDivider.md"),
      "# Heading\n\n---\n\nThis is a thematic break, not frontmatter.\n",
      "utf8"
    );

    const result = await new FileSystemVaultParser().scanVault({
      vaultRoot,
      config: createConfig(vaultRoot)
    });

    expect(result.manifest.notes[0]).toMatchObject({
      path: "BodyDivider.md",
      publish: false,
      aliases: [],
      properties: {}
    });
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

async function createTempVault(): Promise<string> {
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), "osp-parser-"));

  temporaryDirectories.push(directoryPath);
  return directoryPath;
}

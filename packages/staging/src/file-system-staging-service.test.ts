import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { VaultManifestSchema } from "@osp/shared";
import type { PublisherConfig, VaultManifest } from "@osp/shared";
import { afterEach, describe, expect, it } from "vitest";

import { FileSystemStagingService } from "./file-system-staging-service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
});

describe("FileSystemStagingService", () => {
  it("copies only published notes and their referenced assets into the staging workspace", async () => {
    const vaultRoot = await createTempDirectory("osp-staging-vault-");
    const stagingRoot = await createTempDirectory("osp-staging-root-");

    await writeVaultFile(vaultRoot, "Published.md", "---\npublish: true\n---\n![[assets/diagram.png]]\n");
    await writeVaultFile(vaultRoot, "Draft.md", "# Draft\n");
    await writeVaultFile(vaultRoot, "assets/diagram.png", "fake-png");
    await writeVaultFile(stagingRoot, "content/stale.md", "stale");

    const manifest = createManifest(vaultRoot, {
      notes: [
        createNote("Published.md", {
          publish: true,
          assets: [{ path: "assets/diagram.png", kind: "image" }]
        }),
        createNote("Draft.md")
      ],
      assetFiles: [{ path: "assets/diagram.png", kind: "image" }]
    });

    const workspace = await new FileSystemStagingService().prepare({
      config: createConfig(vaultRoot),
      manifest,
      mode: "build",
      stagingRoot
    });

    await expectFileToExist(path.join(workspace.contentDir, "Published.md"));
    await expectFileToExist(path.join(workspace.contentDir, "assets", "diagram.png"));
    await expectFileToBeMissing(path.join(workspace.contentDir, "Draft.md"));
    await expectFileToBeMissing(path.join(workspace.contentDir, "stale.md"));

    const stagedManifest = VaultManifestSchema.parse(
      JSON.parse(await readFile(workspace.manifestPath, "utf8")) as unknown
    );

    expect(stagedManifest.notes.map((note) => note.path)).toEqual(["Published.md"]);
    expect(stagedManifest.assetFiles).toEqual([{ path: "assets/diagram.png", kind: "image" }]);
    expect(stagedManifest.unsupportedObjects).toEqual([]);
  });

  it("uses publishRoot when folder mode is active", async () => {
    const vaultRoot = await createTempDirectory("osp-staging-folder-vault-");
    const stagingRoot = await createTempDirectory("osp-staging-folder-root-");

    await writeVaultFile(vaultRoot, "Public/Guide.md", "# Guide\n");
    await writeVaultFile(vaultRoot, "Private/Draft.md", "# Draft\n");

    const manifest = createManifest(vaultRoot, {
      notes: [createNote("Public/Guide.md"), createNote("Private/Draft.md")],
      assetFiles: []
    });

    const workspace = await new FileSystemStagingService().prepare({
      config: createConfig(vaultRoot, {
        publishMode: "folder",
        publishRoot: "Public"
      }),
      manifest,
      mode: "preview",
      stagingRoot
    });

    await expectFileToExist(path.join(workspace.contentDir, "Public", "Guide.md"));
    await expectFileToBeMissing(path.join(workspace.contentDir, "Private", "Draft.md"));
  });
});

function createConfig(
  vaultRoot: string,
  overrides: Partial<PublisherConfig> = {}
): PublisherConfig {
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
    strictMode: false,
    ...overrides
  };
}

function createManifest(
  vaultRoot: string,
  overrides: Pick<VaultManifest, "notes" | "assetFiles">
): VaultManifest {
  return {
    generatedAt: "2026-03-18T00:00:00.000Z",
    vaultRoot,
    notes: overrides.notes,
    assetFiles: overrides.assetFiles,
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

async function createTempDirectory(prefix: string): Promise<string> {
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), prefix));

  temporaryDirectories.push(directoryPath);
  return directoryPath;
}

async function writeVaultFile(vaultRoot: string, relativePath: string, contents: string): Promise<void> {
  const absolutePath = path.join(vaultRoot, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await rm(absolutePath, { force: true });
  await writeFile(absolutePath, contents, "utf8");
}

async function expectFileToExist(filePath: string): Promise<void> {
  await expect(access(filePath)).resolves.toBeUndefined();
}

async function expectFileToBeMissing(filePath: string): Promise<void> {
  await expect(access(filePath)).rejects.toThrow();
}

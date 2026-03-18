import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { PublisherConfig } from "@osp/shared";
import { afterEach, describe, expect, it } from "vitest";

import { createDefaultPublisherRuntime } from "./default-publisher-runtime";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
});

describe("createDefaultPublisherRuntime", () => {
  it(
    "builds a minimal publishable vault through the full default pipeline",
    async () => {
      const vaultRoot = await createTempVault();

      await writeVaultFile(
        vaultRoot,
        "index.md",
        ["---", "publish: true", "---", "", "# Home", "", "Welcome to the site."].join("\n")
      );

      const runtime = createDefaultPublisherRuntime();

      try {
        const result = await runtime.orchestrator.build(createConfig(vaultRoot));

        expect(result.success).toBe(true);
        expect(result.outputDir).toBeDefined();
        await expect(access(path.join(result.outputDir ?? "", "index.html"))).resolves.toBeUndefined();
      } finally {
        await runtime.stop();
      }
    },
    60_000
  );
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
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), "osp-core-"));

  temporaryDirectories.push(directoryPath);
  return directoryPath;
}

async function writeVaultFile(vaultRoot: string, relativePath: string, contents: string): Promise<void> {
  const absolutePath = path.join(vaultRoot, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
}

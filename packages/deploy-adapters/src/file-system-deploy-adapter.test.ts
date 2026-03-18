import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BuildResult, PublisherConfig } from "@osp/shared";
import { afterEach, describe, expect, it } from "vitest";

import { FileSystemDeployAdapter } from "./file-system-deploy-adapter.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
});

describe("FileSystemDeployAdapter", () => {
  it("copies build output into the configured deploy directory", async () => {
    const workspaceRoot = await createTempDirectory();
    const buildOutputDir = path.join(workspaceRoot, "dist");
    const deployOutputDir = path.join(workspaceRoot, "published-site");

    await mkdir(buildOutputDir, { recursive: true });
    await writeFile(path.join(buildOutputDir, "index.html"), "<html>hello</html>", "utf8");

    const adapter = new FileSystemDeployAdapter();
    const result = await adapter.deploy(createBuildResult(buildOutputDir), createConfig(workspaceRoot, deployOutputDir));

    expect(result).toEqual({
      success: true,
      target: "local-export",
      destination: deployOutputDir,
      message: "Local export completed successfully."
    });
    await expect(access(path.join(deployOutputDir, "index.html"))).resolves.toBeUndefined();
    await expect(readFile(path.join(deployOutputDir, "index.html"), "utf8")).resolves.toBe("<html>hello</html>");
  });

  it("fails cleanly when build output is missing", async () => {
    const workspaceRoot = await createTempDirectory();
    const adapter = new FileSystemDeployAdapter();

    const result = await adapter.deploy(
      {
        success: true,
        manifestPath: path.join(workspaceRoot, "manifest.json"),
        issues: [],
        logs: [],
        durationMs: 1
      },
      createConfig(workspaceRoot)
    );

    expect(result).toEqual({
      success: false,
      target: "local-export",
      message: "Build output directory is missing, so local export cannot proceed."
    });
  });
});

function createBuildResult(outputDir: string): BuildResult {
  return {
    success: true,
    outputDir,
    manifestPath: path.join(outputDir, "..", "manifest.json"),
    issues: [],
    logs: [],
    durationMs: 1
  };
}

function createConfig(vaultRoot: string, deployOutputDir?: string): PublisherConfig {
  return {
    vaultRoot,
    publishMode: "frontmatter",
    includeGlobs: [],
    excludeGlobs: [],
    outputDir: path.join(vaultRoot, ".osp", "dist"),
    builder: "quartz",
    deployTarget: "local-export",
    ...(deployOutputDir === undefined ? {} : { deployOutputDir }),
    enableSearch: true,
    enableBacklinks: true,
    enableGraph: true,
    strictMode: false
  };
}

async function createTempDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), "osp-deploy-"));

  temporaryDirectories.push(directoryPath);
  return directoryPath;
}

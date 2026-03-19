import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BuildResult, PublisherConfig } from "@osp/shared";
import { afterEach, describe, expect, it } from "vitest";

import { GitHubPagesDeployAdapter } from "./github-pages-deploy-adapter.js";
import { runGit } from "./git-client.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
});

describe("GitHubPagesDeployAdapter", () => {
  it(
    "pushes to main for a user pages repository URL",
    async () => {
      const sourceRoot = await createTempDirectory();
      const remoteRoot = await createTempDirectory("shihuaidexianyu.github.io-");
      const buildOutputDir = path.join(sourceRoot, ".osp-build-dist");

      await initializeSourceRepository(sourceRoot);
      await initializeBareRepository(remoteRoot);
      await mkdir(buildOutputDir, { recursive: true });
      await writeFile(path.join(buildOutputDir, "index.html"), "<html>github pages</html>", "utf8");

      const adapter = new GitHubPagesDeployAdapter();
      const result = await adapter.deploy(
        createBuildResult(buildOutputDir),
        createConfig(sourceRoot, {
          deployRepositoryUrl: remoteRoot
        })
      );

      expect(result).toEqual({
        success: true,
        target: "github-pages",
        destination: "refs/heads/main",
        message: "Git branch deploy completed successfully to main."
      });
      await expect(readBareGitFile(remoteRoot, "main", "index.html")).resolves.toBe("<html>github pages</html>");
    },
    20_000
  );
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

function createConfig(vaultRoot: string, overrides: Partial<PublisherConfig> = {}): PublisherConfig {
  return {
    vaultRoot,
    publishMode: "frontmatter",
    includeGlobs: [],
    excludeGlobs: [],
    outputDir: path.join(vaultRoot, ".osp", "dist"),
    builder: "quartz",
    deployTarget: "github-pages",
    enableSearch: true,
    enableBacklinks: true,
    enableGraph: true,
    strictMode: false,
    ...overrides
  };
}

async function createTempDirectory(prefix = "osp-gh-pages-"): Promise<string> {
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), prefix));

  temporaryDirectories.push(directoryPath);
  return directoryPath;
}

async function initializeSourceRepository(repoRoot: string): Promise<void> {
  await runGit(["init"], repoRoot);
  await runGit(["config", "user.name", "OSP Test"], repoRoot);
  await runGit(["config", "user.email", "osp@example.com"], repoRoot);
  await writeFile(path.join(repoRoot, "README.md"), "# source repo\n", "utf8");
  await runGit(["add", "README.md"], repoRoot);
  await runGit(["commit", "-m", "Initial commit"], repoRoot);
  await runGit(["branch", "-M", "main"], repoRoot);
}

async function initializeBareRepository(repoRoot: string): Promise<void> {
  await runGit(["init", "--bare"], repoRoot);
}

async function readBareGitFile(repoRoot: string, branch: string, filePath: string): Promise<string> {
  const result = await runGit(["show", `${branch}:${filePath}`], repoRoot);

  return result.stdout;
}

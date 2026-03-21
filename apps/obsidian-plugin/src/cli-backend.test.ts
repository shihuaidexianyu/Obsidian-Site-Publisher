import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { PublisherConfig } from "@osp/shared";
import { afterEach, describe, expect, it } from "vitest";

import { CliPluginBackend } from "./cli-backend.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
});

describe("CliPluginBackend", () => {
  it("runs one-shot commands through the external CLI and parses JSON output", async () => {
    const pluginRoot = await createTempDirectory();
    const cliEntrypoint = path.join(pluginRoot, "cli.js");

    await writeFile(cliEntrypoint, createFakeCliScript(), "utf8");

    const backend = new CliPluginBackend({
      cliCommand: cliEntrypoint,
      logDirectory: path.join(pluginRoot, ".osp", "logs"),
      previewPort: 43180
    });

    const result = await backend.build(createConfig(pluginRoot));

    expect(result.result.success).toBe(true);
    expect(result.result.outputDir).toBe(path.join(pluginRoot, ".osp", "dist"));
    expect(result.logPath).toBe(path.join(pluginRoot, ".osp", "logs", "build.log"));
  });

  it("accepts a quoted external CLI path", async () => {
    const pluginRoot = await createTempDirectory();
    const cliEntrypoint = path.join(pluginRoot, "cli.js");

    await writeFile(cliEntrypoint, createFakeCliScript(), "utf8");

    const backend = new CliPluginBackend({
      cliCommand: `"${cliEntrypoint}"`,
      logDirectory: path.join(pluginRoot, ".osp", "logs"),
      previewPort: 43180
    });

    const result = await backend.build(createConfig(pluginRoot));

    expect(result.result.success).toBe(true);
    expect(result.logPath).toBe(path.join(pluginRoot, ".osp", "logs", "build.log"));
  });

  it("keeps preview alive until the backend is disposed", async () => {
    const pluginRoot = await createTempDirectory();
    const cliEntrypoint = path.join(pluginRoot, "cli.js");

    await writeFile(cliEntrypoint, createFakeCliScript(), "utf8");

    const backend = new CliPluginBackend({
      cliCommand: cliEntrypoint,
      logDirectory: path.join(pluginRoot, ".osp", "logs")
    });

    const preview = await backend.preview(createConfig(pluginRoot));

    expect(preview.session.url).toBe("http://127.0.0.1:43180");
    expect(preview.logPath).toBe(path.join(pluginRoot, ".osp", "logs", "preview.log"));

    await backend.dispose();
  });

  it("can preview from an existing build result without triggering a rebuild", async () => {
    const pluginRoot = await createTempDirectory();
    const cliEntrypoint = path.join(pluginRoot, "cli.js");

    await writeFile(cliEntrypoint, createFakeCliScript(), "utf8");

    const backend = new CliPluginBackend({
      cliCommand: cliEntrypoint,
      logDirectory: path.join(pluginRoot, ".osp", "logs")
    });

    const preview = await backend.previewBuilt(
      {
        success: true,
        outputDir: path.join(pluginRoot, ".osp", "dist"),
        manifestPath: path.join(pluginRoot, ".osp", "manifest.json"),
        issues: [],
        logs: [],
        durationMs: 1
      },
      createConfig(pluginRoot)
    );

    expect(preview.session.url).toBe("http://127.0.0.1:43180");
    await backend.dispose();
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

async function createTempDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), "osp-plugin-cli-"));

  temporaryDirectories.push(directoryPath);
  await mkdir(directoryPath, { recursive: true });
  return directoryPath;
}

function createFakeCliScript(): string {
  return `
const fs = require("node:fs");
const path = require("node:path");

const argv = process.argv.slice(2);
const command = argv[0];
const configPath = argv[2];
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

if (command === "preview") {
  const buildResultFlagIndex = argv.indexOf("--build-result");
  const buildResultPath = buildResultFlagIndex === -1 ? undefined : argv[buildResultFlagIndex + 1];
  const buildResult = buildResultPath === undefined ? undefined : JSON.parse(fs.readFileSync(buildResultPath, "utf8"));
  console.log(JSON.stringify({
    command: "preview",
    success: true,
    logPath: path.join(config.vaultRoot, ".osp", "logs", "preview.log"),
    session: {
      url: "http://127.0.0.1:43180",
      workspaceRoot: buildResult?.outputDir ?? path.join(config.vaultRoot, ".osp", "preview"),
      startedAt: new Date().toISOString()
    }
  }));
  setInterval(() => {}, 1000);
  return;
}

if (command === "build") {
  console.log(JSON.stringify({
    command: "build",
    success: true,
    logPath: path.join(config.vaultRoot, ".osp", "logs", "build.log"),
    result: {
      success: true,
      outputDir: config.outputDir,
      manifestPath: path.join(config.vaultRoot, ".osp", "manifest.json"),
      issues: [],
      logs: [],
      durationMs: 1
    }
  }));
  return;
}

if (command === "scan") {
  console.log(JSON.stringify({
    command: "scan",
    success: true,
    logPath: path.join(config.vaultRoot, ".osp", "logs", "scan.log"),
    manifest: {
      generatedAt: new Date().toISOString(),
      vaultRoot: config.vaultRoot,
      notes: [],
      assetFiles: [],
      unsupportedObjects: []
    },
    issues: []
  }));
  return;
}

const buildResultFlagIndex = argv.indexOf("--build-result");
const buildResultPath = buildResultFlagIndex === -1 ? undefined : argv[buildResultFlagIndex + 1];
const buildResult = buildResultPath === undefined ? undefined : JSON.parse(fs.readFileSync(buildResultPath, "utf8"));

console.log(JSON.stringify({
  command: "deploy",
  success: true,
  logPath: path.join(config.vaultRoot, ".osp", "logs", "deploy.log"),
  build: buildResult ?? {
    success: true,
    outputDir: config.outputDir,
    manifestPath: path.join(config.vaultRoot, ".osp", "manifest.json"),
    issues: [],
    logs: [],
    durationMs: 1
  },
  deploy: {
    success: true,
    target: "none",
    destination: buildResult?.outputDir ?? config.outputDir,
    message: "Published."
  }
}));
`;
}

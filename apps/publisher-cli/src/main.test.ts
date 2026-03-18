import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BuildResult, DeployResult, PreviewSession, PublisherConfig, VaultManifest } from "@osp/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "./main";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
});

describe("runCli", () => {
  it("prints help when no command is provided", async () => {
    const output = createCapturedOutput();

    const exitCode = await runCli([], {
      output
    });

    expect(exitCode).toBe(0);
    expect(output.logs.join("\n")).toContain("publisher-cli <scan|build|preview|deploy>");
  });

  it("runs scan with default config resolved from --vault-root", async () => {
    const output = createCapturedOutput();
    const runtime = createStubRuntime();

    const exitCode = await runCli(["scan", "--vault-root", "./test_vault/hw"], {
      cwd: "c:\\workspace",
      output,
      createRuntime: () => runtime
    });

    expect(exitCode).toBe(0);
    expect(runtime.orchestrator.scan).toHaveBeenCalledWith(
      expect.objectContaining({
        vaultRoot: path.resolve("c:\\workspace", "test_vault/hw"),
        outputDir: path.join(path.resolve("c:\\workspace", "test_vault/hw"), ".osp", "dist")
      })
    );
    expect(output.logs.join("\n")).toContain("Scan complete.");
  });

  it("merges partial config from osp.config.json", async () => {
    const cwd = await createTempDirectory();
    const output = createCapturedOutput();
    const runtime = createStubRuntime();

    await writeFile(
      path.join(cwd, "osp.config.json"),
      JSON.stringify(
        {
          publishMode: "folder",
          publishRoot: "Public",
          strictMode: true
        },
        null,
        2
      ),
      "utf8"
    );

    const exitCode = await runCli(["scan"], {
      cwd,
      output,
      createRuntime: () => runtime
    });

    expect(exitCode).toBe(0);
    expect(runtime.orchestrator.scan).toHaveBeenCalledWith(
      expect.objectContaining({
        vaultRoot: cwd,
        publishMode: "folder",
        publishRoot: "Public",
        strictMode: true
      })
    );
    expect(output.logs.join("\n")).toContain("Using config");
  });

  it("returns exit code 1 when build fails", async () => {
    const output = createCapturedOutput();
    const runtime = createStubRuntime({
      buildResult: {
        success: false,
        manifestPath: "/workspace/manifest.json",
        issues: [],
        logs: [],
        durationMs: 12
      }
    });

    const exitCode = await runCli(["build", "--vault-root", "./vault"], {
      cwd: "c:\\workspace",
      output,
      createRuntime: () => runtime
    });

    expect(exitCode).toBe(1);
    expect(output.logs.join("\n")).toContain("Build failed.");
  });

  it("builds and deploys when deploy command is used", async () => {
    const output = createCapturedOutput();
    const runtime = createStubRuntime();

    const exitCode = await runCli(["deploy", "--vault-root", "./vault"], {
      cwd: "c:\\workspace",
      output,
      createRuntime: () => runtime
    });

    expect(exitCode).toBe(0);
    expect(runtime.orchestrator.build).toHaveBeenCalledOnce();
    expect(runtime.orchestrator.deployFromBuild).toHaveBeenCalledOnce();
    expect(output.logs.join("\n")).toContain("Deploy succeeded.");
  });

  it("starts preview and waits for shutdown signal hook", async () => {
    const output = createCapturedOutput();
    const runtime = createStubRuntime();
    const waitForPreviewShutdown = vi.fn(async () => {});

    const exitCode = await runCli(["preview", "--vault-root", "./vault"], {
      cwd: "c:\\workspace",
      output,
      createRuntime: () => runtime,
      waitForPreviewShutdown
    });

    expect(exitCode).toBe(0);
    expect(runtime.orchestrator.preview).toHaveBeenCalledOnce();
    expect(waitForPreviewShutdown).toHaveBeenCalledOnce();
    expect(output.logs.join("\n")).toContain("Preview ready at http://localhost:8080");
  });
});

function createStubRuntime(options: {
  buildResult?: BuildResult;
  previewSession?: PreviewSession;
  deployResult?: DeployResult;
} = {}) {
  return {
    orchestrator: {
      scan: vi.fn(async (config: PublisherConfig) => ({
        manifest: createManifest(config.vaultRoot),
        issues: []
      })),
      build: vi.fn(async () => options.buildResult ?? createBuildResult()),
      preview: vi.fn(async () => options.previewSession ?? createPreviewSession()),
      deployFromBuild: vi.fn(async () => options.deployResult ?? createDeployResult())
    },
    stop: vi.fn(async () => {})
  };
}

function createCapturedOutput() {
  return {
    logs: [] as string[],
    errors: [] as string[],
    log(message: string) {
      this.logs.push(message);
    },
    error(message: string) {
      this.errors.push(message);
    }
  };
}

function createManifest(vaultRoot: string): VaultManifest {
  return {
    generatedAt: new Date().toISOString(),
    vaultRoot,
    notes: [],
    assetFiles: [],
    unsupportedObjects: []
  };
}

function createBuildResult(): BuildResult {
  return {
    success: true,
    outputDir: "/workspace/dist",
    manifestPath: "/workspace/manifest.json",
    issues: [],
    logs: [],
    durationMs: 12
  };
}

function createPreviewSession(): PreviewSession {
  return {
    url: "http://localhost:8080",
    workspaceRoot: "/workspace",
    startedAt: new Date().toISOString()
  };
}

function createDeployResult(): DeployResult {
  return {
    success: true,
    target: "none",
    destination: "/workspace/dist",
    message: "Deployed."
  };
}

async function createTempDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), "osp-cli-"));

  temporaryDirectories.push(directoryPath);
  return directoryPath;
}
